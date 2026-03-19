require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware untuk membaca JSON dari ESP32
app.use(express.json({
    verify: (req, res, buf) => {
        try {
            JSON.parse(buf);
        } catch (e) {
            console.log("[FATAL] JSON Rusak diterima:", buf.toString());
            res.status(400).send("JSON Invalid");
            throw new Error('Invalid JSON');
        }
    }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// VARIABLE PENYIMPANAN SEMENTARA (IN-MEMORY)
// ==========================================
// Ini akan menyimpan data terakhir yang dikirim oleh ESP32
let sensorData = {
    level: 0,
    updatedAt: new Date()
};

// History array sederhana (opsional, agar grafik terlihat bergerak)
let historyData = [];

// ==========================================
// 1. ENDPOINT UNTUK MENERIMA DATA DARI ESP32 (POST)
// ==========================================
app.post('/api/water-levels', (req, res) => {
    // ESP32 akan mengirim JSON: { "level": 150 }

    console.log("---------------------------------");
    console.log("[DEBUG] Headers:", req.headers);
    console.log("[DEBUG] Body:", req.body);
    console.log("---------------------------------");

    const { level } = req.body;
    
    if (level === undefined) {
        console.log("[ERROR] Level undefined. Body kosong?");
        return res.status(400).send("Data level tidak ditemukan");
    }

    const now = new Date();
    
    // Update data terkini
    sensorData = {
        level: parseInt(level),
        updatedAt: now
    };

    // Tambahkan ke history (maksimal simpan 12 data terakhir)
    historyData.push({
        time: now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        level: parseInt(level)
    });

    if (historyData.length > 12) {
        historyData.shift(); // Hapus data terlama jika lebih dari 12
    }

    console.log(`[DATA MASUK] Level Air: ${level} cm pada jam ${now.toLocaleTimeString()}`);
    res.status(200).send("Data Diterima");
});

// ==========================================
// 2. ENDPOINT UNTUK FRONTEND (GET)
// ==========================================
app.get('/api/water-levels', (req, res) => {
    // Kirimkan data yang ada di variable, BUKAN generate dummy baru
    res.json({
        currentLevel: sensorData.level,
        status: sensorData.level > 200 ? 'BAHAYA' : (sensorData.level > 100 ? 'WASPADA' : 'AMAN'),
        lastUpdate: sensorData.updatedAt,
        history: historyData // Kirim history agar grafik frontend terbentuk
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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});