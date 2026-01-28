require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = 3000;

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

// ... (Sisa kode API Photos dan Proxy Stream biarkan tetap sama) ...

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});