const express = require('express');
const http = require('http');
const app = express();
const path = require('path');

const PORT = 3000;

// ==========================================
// KONFIGURASI
// ==========================================
// Ganti dengan IP Address ESP32 Anda yang muncul di Serial Monitor
const ESP32_IP = '10.145.3.157';
// Jika di kode ESP32 Anda pakai port 80, biarkan 80.
const ESP32_PORT = 81;

// Folder untuk file statis (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, 'public')));

// 1. Endpoint Utama (Halaman Web)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 2. Endpoint Proxy Streaming
// Browser akan meminta video ke sini, lalu Node.js minta ke ESP32
app.get('/video-stream', (req, res) => {
    const options = {
        hostname: ESP32_IP,
        port: ESP32_PORT,
        path: '/stream', // Path default MJPEG stream di kode ESP32 Anda
        method: 'GET'
    };

    const request = http.request(options, (response) => {
        // Cek apakah stream tersedia
        if (response.statusCode !== 200) {
            res.status(response.statusCode).send("Gagal mengambil stream dari ESP32");
            return;
        }

        // Teruskan header Content-Type dari ESP32 (multipart/x-mixed-replace...)
        res.writeHead(response.statusCode, response.headers);

        // Pipe data langsung dari ESP32 ke Browser User secara realtime
        response.pipe(res);
    });

    request.on('error', (e) => {
        console.error(`Masalah dengan request: ${e.message}`);
        res.status(500).send("ESP32 Offline atau IP Salah");
    });

    // Batalkan request ke ESP32 jika browser user ditutup/refresh
    req.on('close', () => {
        request.destroy();
    });

    request.end();
});

app.listen(PORT, () => {
    console.log(`🌊 IoT Water Level Dashboard`);
    console.log(`📡 Web Server berjalan di http://localhost:${PORT}`);
    console.log(`📷 Mengambil stream dari http://${ESP32_IP}:${ESP32_PORT}`);
});
