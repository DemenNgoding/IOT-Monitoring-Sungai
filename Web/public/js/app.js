/* ==========================================
   IoT Water Level Dashboard - JavaScript
   ========================================== */

// ==========================================
// KONFIGURASI SUPABASE
// ==========================================
// Ganti dengan kredensial Supabase Anda
const SUPABASE_URL = 'https://sravjzvbepyrbbzwuooo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYXZqenZiZXB5cmJiend1b29vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyMDQ2MzMsImV4cCI6MjA4MDc4MDYzM30.fQHfy_Url5VDa24SXpKWiM33H9clNGhHsy90f_4yN70';

// Nama bucket untuk foto
const PHOTO_BUCKET = 'Camera';

// Nama bucket untuk data ketinggian air (jika ingin menggunakan database)
const WATER_LEVEL_TABLE = 'water_levels';

// ==========================================
// INISIALISASI
// ==========================================
let supabaseClient = null;
let waterLevelChart = null;

// Dummy data untuk demo
let waterLevelData = {
    labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
    values: [42, 45, 48, 52, 55, 53, 50, 47, 45, 45]
};

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    initWaterLevelChart();
    loadPhotos();
    updateWaterLevel();

    // Update setiap 30 detik (untuk demo)
    setInterval(updateWaterLevel, 30000);

    // Update foto setiap 60 detik
    setInterval(loadPhotos, 60000);
});

// ==========================================
// SUPABASE CLIENT
// ==========================================
function initSupabase() {
    try {
        // Cek apakah Supabase client tersedia
        if (typeof supabase !== 'undefined' && SUPABASE_URL !== 'https://your-project.supabase.co') {
            supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('✅ Supabase client initialized');
        } else {
            console.log('ℹ️ Supabase not configured - using demo mode');
        }
    } catch (error) {
        console.error('❌ Failed to initialize Supabase:', error);
    }
}

// ==========================================
// SECTION 1: WATER LEVEL CHART
// ==========================================
function initWaterLevelChart() {
    const ctx = document.getElementById('waterLevelChart').getContext('2d');

    // Gradient untuk area chart
    const gradient = ctx.createLinearGradient(0, 0, 0, 250);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

    waterLevelChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: waterLevelData.labels,
            datasets: [{
                label: 'Ketinggian Air (cm)',
                data: waterLevelData.values,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: {
                        size: 14,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 13
                    },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        color: '#6b7280',
                        font: {
                            size: 11
                        },
                        callback: function (value) {
                            return value + ' cm';
                        }
                    },
                    min: 0,
                    suggestedMax: 100
                }
            }
        }
    });
}

function updateWaterLevel() {
    // Untuk demo, gunakan data dummy yang di-update random
    // Ganti dengan fungsi fetchWaterLevelFromSupabase() untuk data real

    const now = new Date();
    const timeString = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Generate random water level untuk demo (40-60 cm)
    const newLevel = Math.floor(Math.random() * 20) + 40;

    // Update display
    document.getElementById('water-level-number').textContent = newLevel;
    document.getElementById('last-update-time').textContent = now.toLocaleTimeString('id-ID');

    // Update status
    updateWaterStatus(newLevel);

    // Update chart data
    waterLevelData.labels.push(timeString);
    waterLevelData.values.push(newLevel);

    // Keep only last 10 data points
    if (waterLevelData.labels.length > 10) {
        waterLevelData.labels.shift();
        waterLevelData.values.shift();
    }

    // Update chart
    waterLevelChart.data.labels = waterLevelData.labels;
    waterLevelChart.data.datasets[0].data = waterLevelData.values;
    waterLevelChart.update('none');
}

function updateWaterStatus(level) {
    const statusContainer = document.getElementById('water-status');
    const indicator = statusContainer.querySelector('.status-indicator');
    const text = statusContainer.querySelector('span:last-child') || statusContainer.childNodes[1];

    // Remove existing status classes
    indicator.classList.remove('normal', 'warning', 'danger');

    if (level < 50) {
        indicator.classList.add('normal');
        statusContainer.innerHTML = '<span class="status-indicator normal"></span><span>Normal</span>';
    } else if (level < 70) {
        indicator.classList.add('warning');
        statusContainer.innerHTML = '<span class="status-indicator warning"></span><span>Waspada</span>';
    } else {
        indicator.classList.add('danger');
        statusContainer.innerHTML = '<span class="status-indicator danger"></span><span>Bahaya</span>';
    }
}

// ==========================================
// FETCH WATER LEVEL DARI SUPABASE (INSTRUKSI)
// ==========================================
/*
INSTRUKSI: Untuk mengambil data ketinggian air dari Supabase

1. Buat tabel di Supabase dengan nama 'water_levels':
   - id: int8 (primary key, auto increment)
   - level: float8 (ketinggian air dalam cm)
   - created_at: timestamp with timezone (default: now())

2. Uncomment dan gunakan fungsi berikut:

async function fetchWaterLevelFromSupabase() {
    if (!supabaseClient) {
        console.log('Supabase not configured');
        return;
    }
    
    try {
        // Ambil 10 data terakhir
        const { data, error } = await supabaseClient
            .from(WATER_LEVEL_TABLE)
            .select('level, created_at')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            // Reverse untuk urutan chronological
            const reversedData = data.reverse();
            
            // Update chart data
            waterLevelData.labels = reversedData.map(item => {
                const date = new Date(item.created_at);
                return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            });
            waterLevelData.values = reversedData.map(item => item.level);
            
            // Update display dengan data terbaru
            const latestLevel = data[data.length - 1].level;
            document.getElementById('water-level-number').textContent = Math.round(latestLevel);
            document.getElementById('last-update-time').textContent = new Date().toLocaleTimeString('id-ID');
            
            updateWaterStatus(latestLevel);
            
            // Update chart
            waterLevelChart.data.labels = waterLevelData.labels;
            waterLevelChart.data.datasets[0].data = waterLevelData.values;
            waterLevelChart.update('none');
        }
    } catch (error) {
        console.error('Error fetching water level:', error);
    }
}

3. Ganti updateWaterLevel() dengan fetchWaterLevelFromSupabase() di event listener

4. Untuk real-time updates, gunakan Supabase Realtime:

function subscribeToWaterLevelUpdates() {
    if (!supabaseClient) return;
    
    supabaseClient
        .channel('water_levels_changes')
        .on('postgres_changes', 
            { event: 'INSERT', schema: 'public', table: WATER_LEVEL_TABLE },
            (payload) => {
                console.log('New water level:', payload.new);
                fetchWaterLevelFromSupabase();
            }
        )
        .subscribe();
}
*/

// ==========================================
// SECTION 2: PHOTO GALLERY
// ==========================================
async function loadPhotos() {
    const photoGrid = document.getElementById('photo-grid');

    if (supabaseClient) {
        // Load dari Supabase
        await loadPhotosFromSupabase();
    } else {
        // Demo mode dengan placeholder
        loadDemoPhotos();
    }
}

async function loadPhotosFromSupabase() {
    const photoGrid = document.getElementById('photo-grid');

    try {
        // List files dari bucket 'Camera'
        const { data, error } = await supabaseClient
            .storage
            .from(PHOTO_BUCKET)
            .list('', {
                limit: 5,
                offset: 0,
                sortBy: { column: 'created_at', order: 'desc' }
            });

        if (error) throw error;

        if (data && data.length > 0) {
            // Filter hanya file gambar
            const imageFiles = data.filter(file =>
                file.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)
            );

            if (imageFiles.length > 0) {
                photoGrid.innerHTML = '';

                imageFiles.slice(0, 5).forEach(file => {
                    const { data: urlData } = supabaseClient
                        .storage
                        .from(PHOTO_BUCKET)
                        .getPublicUrl(file.name);

                    const photoItem = createPhotoItem(
                        urlData.publicUrl,
                        file.name,
                        file.created_at
                    );
                    photoGrid.appendChild(photoItem);
                });
            } else {
                loadDemoPhotos();
            }
        } else {
            loadDemoPhotos();
        }
    } catch (error) {
        console.error('Error loading photos:', error);
        loadDemoPhotos();
    }
}

function loadDemoPhotos() {
    const photoGrid = document.getElementById('photo-grid');

    // Demo photos menggunakan placeholder
    const demoPhotos = [
        { url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400&h=300&fit=crop', time: '10:30:15' },
        { url: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=400&h=300&fit=crop', time: '10:25:42' },
        { url: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&h=300&fit=crop', time: '10:20:08' },
        { url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop', time: '10:15:33' },
        { url: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=400&h=300&fit=crop', time: '10:10:21' }
    ];

    photoGrid.innerHTML = '';

    demoPhotos.forEach(photo => {
        const photoItem = createPhotoItem(photo.url, 'Demo Photo', photo.time);
        photoGrid.appendChild(photoItem);
    });
}

function createPhotoItem(url, name, timestamp) {
    const div = document.createElement('div');
    div.className = 'photo-item';

    const img = document.createElement('img');
    img.src = url;
    img.alt = name;
    img.loading = 'lazy';

    const timeSpan = document.createElement('span');
    timeSpan.className = 'photo-timestamp';

    // Format timestamp
    if (timestamp) {
        const date = new Date(timestamp);
        if (!isNaN(date.getTime())) {
            timeSpan.textContent = date.toLocaleString('id-ID', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit'
            });
        } else {
            timeSpan.textContent = timestamp;
        }
    }

    div.appendChild(img);
    div.appendChild(timeSpan);

    // Click to open modal
    div.addEventListener('click', () => openModal(url, timeSpan.textContent));

    return div;
}

// ==========================================
// SECTION 3: VIDEO STREAM
// ==========================================
function handleStreamError() {
    const overlay = document.getElementById('stream-overlay');
    overlay.classList.add('active');
}

function retryStream() {
    const overlay = document.getElementById('stream-overlay');
    const videoStream = document.getElementById('video-stream');

    overlay.classList.remove('active');

    // Reload stream dengan timestamp untuk bypass cache
    videoStream.src = '/video-stream?t=' + Date.now();
}

// ==========================================
// MODAL
// ==========================================
function openModal(imageUrl, timestamp) {
    const modal = document.getElementById('photo-modal');
    const modalImage = document.getElementById('modal-image');
    const modalTimestamp = document.getElementById('modal-timestamp');

    modalImage.src = imageUrl;
    modalTimestamp.textContent = timestamp ? `Diambil: ${timestamp}` : '';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    const modal = document.getElementById('photo-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Console welcome message
console.log(`
🌊 IoT Water Level Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Water Level Chart: Active
📷 Photo Gallery: ${supabaseClient ? 'Connected to Supabase' : 'Demo Mode'}
🎥 Video Stream: /video-stream

ℹ️ Untuk menghubungkan ke Supabase:
   1. Edit SUPABASE_URL dan SUPABASE_ANON_KEY di app.js
   2. Buat bucket 'Camera' di Supabase Storage
   3. Upload foto ke bucket tersebut
`);
