// Gallery State
// Gallery Modal Elements
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-img');
const modalCaption = document.getElementById('modal-caption');
const closeModal = document.getElementById('close-modal');

document.addEventListener('DOMContentLoaded', () => {
    initWaterChart();

    // Modal Events
    closeModal.addEventListener('click', () => {
        modal.classList.remove('active');
    });

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Initial Load
    refreshData();

    // Auto Refresh
    setInterval(refreshData, 5000); // 5 sec
});

let waterChartInstance;

function initWaterChart() {
    const ctx = document.getElementById('waterChart').getContext('2d');

    // Gradient for the chart area
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    // Apple Blue: #0071E3
    gradient.addColorStop(0, 'rgba(0, 113, 227, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 113, 227, 0)');

    waterChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Water Level',
                data: [],
                borderColor: '#0071E3',
                backgroundColor: gradient,
                borderWidth: 3,
                pointBackgroundColor: '#FFFFFF',
                pointBorderColor: '#0071E3',
                pointBorderWidth: 2,
                pointRadius: 0, // Clean look, show on hover usually
                pointHoverRadius: 6,
                fill: true,
                tension: 0.4, // Smooth curve (bezier)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: { family: 'Inter', size: 13 },
                    bodyFont: { family: 'Inter', size: 13 },
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#86868B',
                        font: { family: 'Inter', size: 11 },
                        maxTicksLimit: 6
                    }
                },
                y: {
                    border: { display: false },
                    grid: {
                        color: 'rgba(0,0,0,0.05)',
                        borderDash: [5, 5]
                    },
                    ticks: {
                        color: '#86868B',
                        font: { family: 'Inter' }
                    },
                    suggestedMin: 100,
                    suggestedMax: 400
                }
            }
        }
    });
}

async function refreshData() {
    // Parallel fetch, but handle independently to avoid blocking
    fetchWaterLevels();
    fetchPhotos();
}

async function fetchWaterLevels() {
    try {
        const res = await fetch('/api/water-levels');
        const data = await res.json();

        // 1. Update Number Display
        document.getElementById('current-value').textContent = data.currentLevel;

        // 2. Update Status Badge
        const badge = document.getElementById('level-status');
        badge.textContent = data.status;
        badge.className = 'badge'; // reset
        if (data.status === 'BAHAYA' || data.status === 'WASPADA') {
            badge.classList.add('alert');
        } else {
            badge.classList.add('normal');
        }

        // 3. Update Chart
        const labels = data.history.map(d => d.time);
        const values = data.history.map(d => d.level);

        waterChartInstance.data.labels = labels;
        waterChartInstance.data.datasets[0].data = values;
        waterChartInstance.update();

    } catch (e) {
        console.error("Water Data Error", e);
    }
}

async function fetchPhotos() {
    try {
        const res = await fetch('/api/photos');
        const photos = await res.json();

        const gallery = document.getElementById('photo-gallery');
        gallery.innerHTML = '';

        photos.forEach(photo => {
            const div = document.createElement('div');
            div.className = 'photo-item';
            div.innerHTML = `
                <img src="${photo.url}" loading="lazy" alt="River Snap">
                <div class="photo-timestamp">${photo.timestamp}</div>
            `;

            // Add click listener for modal
            div.addEventListener('click', () => {
                modalImg.src = photo.url;
                modalCaption.textContent = photo.timestamp;
                modal.classList.add('active');
            });

            gallery.appendChild(div);
        });

    } catch (e) {
        console.error("Photo Fetch Error", e);
    }
}
