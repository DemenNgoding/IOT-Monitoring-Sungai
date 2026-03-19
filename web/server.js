require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Server } = require("socket.io");

const app = express();
const PORT = 3000;
const httpServer = http.createServer(app);
const io = new Server(app.listen(PORT), {
    cors: { origin: "*" }
});

const supabaseUrl = "https://sravjzvbepyrbbzwuooo.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYXZqenZiZXB5cmJiend1b29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDQ2MzMsImV4cCI6MjA4MDc4MDYzM30.fQHfy_Url5VDa24SXpKWiM33H9clNGhHsy90f_4yN70";
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(express.json({ limit: '10mb' })); // Naikkan limit untuk base64 gambar
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// HANDLE STREAMING VIDEO (WEBSOCKET)
// ==========================================
io.on("connection", (socket) => {
    console.log(`[STREAM] Client terhubung: ${socket.id}`);

    // Menangani frame gambar dari ESP32
    socket.on("stream-frame", (base64Image) => {
        // Meneruskan gambar ke semua client (Web Browser) yang mendengarkan
        // Gunakan volatille agar jika server sibuk, frame lama dibuang (bukan antri)
        socket.volatile.broadcast.emit("new-frame", base64Image);
        
        // Opsional: Log ukuran frame yang diterima
        // console.log(`[STREAM] Frame received: ${base64Image.length} bytes`);
    });

    socket.on("disconnect", () => {
        console.log(`[STREAM] Client terputus: ${socket.id}`);
    });
});

// Middleware untuk membaca JSON dari ESP32
// app.use(express.json({
//     verify: (req, res, buf) => {
//         try {
//             JSON.parse(buf);
//         } catch (e) {
//             console.log("[FATAL] JSON Rusak diterima:", buf.toString());
//             res.status(400).send("JSON Invalid");
//             throw new Error('Invalid JSON');
//         }
//     }
// }));
// app.use(express.static(path.join(__dirname, 'public')));

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