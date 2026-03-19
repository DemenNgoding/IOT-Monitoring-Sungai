require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { PassThrough } = require('stream');

const app = express();
const PORT = 3000;

const supabaseUrl = "https://sravjzvbepyrbbzwuooo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYXZqenZiZXB5cmJiend1b29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDQ2MzMsImV4cCI6MjA4MDc4MDYzM30.fQHfy_Url5VDa24SXpKWiM33H9clNGhHsy90f_4yN70";
const supabase = createClient(supabaseUrl, supabaseKey);

let latestFrame = null;
const browserClients = new Set();

app.use(express.json({ limit: '10mb' })); // Naikkan limit untuk base64 gambar
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/water-levels', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('water_level')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(12);

        if (error) throw error;

        const history = data.reverse().map(item => ({
            time: new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            level: item.level
        }));

        res.json({
            currentLevel: data.length > 0 ? data[data.length - 1].level : 0,
            status: data.length > 0 ? getStatus(data[data.length - 1].level) : 'UNKNOWN',
            history: history
        });
    } catch (err) {
        console.error("Error fetching water levels:", err);
        res.status(500).json({ error: err.message });
    }
});

// Helper untuk status
function getStatus(level) {
    if (level > 200) return 'BAHAYA';
    if (level > 100) return 'WASPADA';
    return 'AMAN';
}

// 2. DATA FOTO KAMERA (REAL SUPABASE STORAGE)
app.get('/api/photos', async (req, res) => {
    try {
        const { data, error } = await supabase.storage.from('Camera').list('', {
            limit: 5,
            sortBy: { column: 'created_at', order: 'desc' }
        });

        if (error) throw error;

        const photos = data.map(file => {
            const { data: publicUrlData } = supabase.storage.from('Camera').getPublicUrl(file.name);
            return {
                name: file.name,
                url: publicUrlData.publicUrl,
                timestamp: new Date(file.created_at).toLocaleString('id-ID')
            };
        });
        res.json(photos);

    } catch (err) {
        console.error("Server Error:", err);
        res.json(getDummyPhotos());
    }
});

function getDummyPhotos() {
    return [
        { url: 'https://images.unsplash.com/photo-1549887552-93f954d1d960', timestamp: 'Demo Photo 1' },
        { url: 'https://images.unsplash.com/photo-1506157786151-b8491531f063', timestamp: 'Demo Photo 2' },
        { url: 'https://images.unsplash.com/photo-1533228876829-d65c1cc603d1', timestamp: 'Demo Photo 3' }
    ];
}

app.post('/stream-upload', (req, res) => {
  console.log('ESP32 connected, receiving stream...');
  
  const boundary = req.headers['content-type']?.split('boundary=')[1];
  if (!boundary) {
    return res.status(400).send('Missing boundary');
  }

  let buffer = Buffer.alloc(0);
  const BOUNDARY_MARKER = Buffer.from('--' + boundary);

  req.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Parse multipart frames dari buffer
    let boundaryIdx;
    while ((boundaryIdx = buffer.indexOf(BOUNDARY_MARKER)) !== -1) {
      const afterBoundary = buffer.indexOf('\r\n\r\n', boundaryIdx);
      if (afterBoundary === -1) break;

      const headerSection = buffer.slice(boundaryIdx, afterBoundary).toString();
      const contentLengthMatch = headerSection.match(/Content-Length:\s*(\d+)/i);
      if (!contentLengthMatch) {
        buffer = buffer.slice(afterBoundary + 4);
        continue;
      }

      const frameLen = parseInt(contentLengthMatch[1]);
      const frameStart = afterBoundary + 4;

      if (buffer.length < frameStart + frameLen) break; // tunggu data lengkap

      const frame = buffer.slice(frameStart, frameStart + frameLen);
      latestFrame = frame;

      // Broadcast ke semua browser yang sedang menonton
      broadcastFrame(frame);

      buffer = buffer.slice(frameStart + frameLen);
    }
  });

  req.on('end', () => console.log('ESP32 stream ended.'));
  req.on('error', (e) => console.error('ESP32 stream error:', e.message));

  // Jangan kirim response dulu, biarkan koneksi hidup
  res.writeHead(200, { 'Content-Type': 'text/plain' });
});

// ─── Broadcast frame ke semua browser (MJPEG over HTTP) ──────────────────
function broadcastFrame(frameBuffer) {
  const header = `--frameboundary\r\nContent-Type: image/jpeg\r\nContent-Length: ${frameBuffer.length}\r\n\r\n`;
  for (const client of browserClients) {
    try {
      client.write(header);
      client.write(frameBuffer);
      client.write('\r\n');
    } catch (e) {
      browserClients.delete(client);
    }
  }
}

// ─── Endpoint: Browser menonton live stream ───────────────────────────────
app.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frameboundary',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  browserClients.add(res);
  console.log(`Browser connected. Total viewers: ${browserClients.size}`);

  // Kirim frame terakhir langsung agar tidak blank
  if (latestFrame) {
    const header = `--frameboundary\r\nContent-Type: image/jpeg\r\nContent-Length: ${latestFrame.length}\r\n\r\n`;
    res.write(header);
    res.write(latestFrame);
    res.write('\r\n');
  }

  req.on('close', () => {
    browserClients.delete(res);
    console.log(`Browser disconnected. Total viewers: ${browserClients.size}`);
  });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});