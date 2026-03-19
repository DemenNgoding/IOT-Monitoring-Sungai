require('dotenv').config();
const express = require('express');
const WebSocket = require('ws');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const supabaseUrl = "https://sravjzvbepyrbbzwuooo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYXZqenZiZXB5cmJiend1b29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDQ2MzMsImV4cCI6MjA4MDc4MDYzM30.fQHfy_Url5VDa24SXpKWiM33H9clNGhHsy90f_4yN70";
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json({ limit: '10mb' })); // Naikkan limit untuk base64 gambar
app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
    console.log('Koneksi baru masuk dari link Traefik');

    ws.on('message', (data) => {
        // Jika data berupa Buffer (Gambar dari ESP32), sebar ke browser
        if (Buffer.isBuffer(data) || data instanceof Uint8Array) {
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(data);
                }
            });
        }
    });
});

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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});