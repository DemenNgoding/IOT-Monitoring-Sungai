require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

// ==========================================
// KONFIGURASI KONEKSI
// ==========================================
// const ESP32_IP = '10.145.3.157';
const ESP32_IP = '192.168.100.75';
const ESP32_PORT = 81;

// Inisialisasi Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. DATA KETINGGIAN AIR (MODE DUMMY)
// -----------------------------------------------------------
// PERHATIAN: Saat ini menggunakan DATA DUMMY untuk demo.
// Untuk mengubah ke data REAL dari Database Supabase:
// 1. Uncomment bagian "REAL DATABASE CODE"
// 2. Comment bagian "DUMMY DATA GENERATOR"
// -----------------------------------------------------------
app.get('/api/water-levels', async (req, res) => {

    // --- [OPSI 1: REAL DATABASE CODE] ---
    /*
    try {
        // Asumsi nama table Anda adalah 'water_levels' atau 'ketinggian_air'
        const { data, error } = await supabase
            .from('water_levels')  // Ganti sesuai nama tabel Anda
            .select('*')
            .order('created_at', { ascending: false })
            .limit(24); // Ambil 24 data terakhir

        if (error) throw error;
        
        // Format data sesuai kebutuhan frontend
        const history = data.reverse().map(item => ({
             time: new Date(item.created_at).toLocaleTimeString('id-ID'),
             level: item.value // Sesuaikan dengan nama kolom nilai air di DB
        }));
        
        const latest = history[history.length - 1];
        
        res.json({
            currentLevel: latest.level,
            status: getStatus(latest.level),
            history: history
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
    */

    // --- [OPSI 2: DUMMY DATA GENERATOR (AKTIF)] ---
    const data = [];
    const now = new Date();

    // Generate 12 data per 5 menit
    for (let i = 11; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 5 * 60 * 1000);
        // Random fluctuation logic
        const baseLevel = 250;
        const randomFluctuation = Math.floor(Math.random() * 50) - 25;
        const level = baseLevel + randomFluctuation;

        data.push({
            time: time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            level: level
        });
    }

    const currentLevel = data[data.length - 1].level;

    res.json({
        currentLevel: currentLevel,
        status: currentLevel > 300 ? 'BAHAYA' : (currentLevel > 200 ? 'WASPADA' : 'AMAN'),
        history: data
    });
});


// 2. DATA FOTO KAMERA (REAL SUPABASE STORAGE)
app.get('/api/photos', async (req, res) => {
    try {
        // Listing file dari Bucket 'Camera'
        // Limit 5 file terbaru
        const { data, error } = await supabase
            .storage
            .from('Camera')
            .list('', {
                limit: 5,
                sortBy: { column: 'created_at', order: 'desc' }
            });

        if (error) {
            console.error('Supabase Storage Error:', error);
            // Fallback ke dummy jika error (misal belum setup bucket)
            return res.json(getDummyPhotos());
        }

        // Generate URL publik untuk setiap file
        const photos = data.map(file => {
            const { data: publicUrlData } = supabase
                .storage
                .from('Camera')
                .getPublicUrl(file.name);

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


// 3. PROXY STREAMING
app.get('/video-stream', (req, res) => {
    const options = {
        hostname: ESP32_IP,
        port: ESP32_PORT,
        path: '/stream',
        method: 'GET'
    };

    const request = http.request(options, (response) => {
        if (response.statusCode !== 200) {
            res.status(response.statusCode).send("Gagal mengambil stream");
            return;
        }
        res.writeHead(response.statusCode, response.headers);
        response.pipe(res);
    });

    request.on('error', (e) => {
        if (!res.headersSent) res.status(500).send("ESP32 Offline");
    });

    req.on('close', () => request.destroy());
    request.end();
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
