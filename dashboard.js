// dashboard.js
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyAi17Nr_DVUflPmsMzpx8pptqcZxT2AfUQ",
    authDomain: "smart-plant-watering-rem-e050a.firebaseapp.com",
    databaseURL: "https://smart-plant-watering-rem-e050a-default-rtdb.firebaseio.com",
    projectId: "smart-plant-watering-rem-e050a",
    storageBucket: "smart-plant-watering-rem-e050a.firebasestorage.app",
    messagingSenderId: "658047903398",
    appId: "1:658047903398:web:f94a57849c38e3da37b667",
    measurementId: "G-LY0THX67S2"
};

// Device ID
let currentDeviceId = null;
let updateCount = 0;
let moistureHistory = [];
const MAX_HISTORY = 20;

// Chart instances
let moistureGauge = null;
let historyChart = null;

// DOM Elements
const elements = {
    moisturePercent: document.getElementById('moisturePercent'),
    statusIndicator: document.getElementById('statusIndicator'),
    temperature: document.getElementById('temperature'),
    humidity: document.getElementById('humidity'),
    rawValue: document.getElementById('rawValue'),
    updateCount: document.getElementById('updateCount'),
    deviceId: document.getElementById('deviceId'),
    lastUpdate: document.getElementById('lastUpdate')
};

// Initialize dashboard
function initDashboard() {
    initializeGauge();
    initializeHistoryChart();
    
    // Get device ID from URL or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'demo-device';
    
    elements.deviceId.textContent = currentDeviceId;
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Start periodic data fetching
    fetchData();
    setInterval(fetchData, 10000);
    
    // Add event listener for refresh button
    document.querySelector('.refresh-btn').addEventListener('click', fetchData);
}

// Initialize moisture gauge
function initializeGauge() {
    const ctx = document.getElementById('moistureGauge').getContext('2d');
    
    moistureGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#667eea', '#e9ecef'],
                borderWidth: 0,
                circumference: 180,
                rotation: 270
            }]
        },
        options: {
            cutout: '80%',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

// Initialize history chart
function initializeHistoryChart() {
    const ctx = document.getElementById('historyChart').getContext('2d');
    
    historyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Moisture %',
                data: [],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: 'rgba(0,0,0,0.05)' }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

// Update moisture gauge
function updateGauge(percentage) {
    if (moistureGauge) {
        moistureGauge.data.datasets[0].data = [percentage, 100 - percentage];
        
        let color;
        if (percentage <= 30) color = '#ff6b6b';
        else if (percentage <= 70) color = '#51cf66';
        else color = '#339af0';
        
        moistureGauge.data.datasets[0].backgroundColor = [color, '#e9ecef'];
        moistureGauge.update();
    }
}

// Update history chart
function updateHistoryChart(percentage, timestamp) {
    if (historyChart) {
        const timeLabel = new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        moistureHistory.push({percentage, time: timeLabel});
        
        if (moistureHistory.length > MAX_HISTORY) {
            moistureHistory.shift();
        }
        
        historyChart.data.labels = moistureHistory.map(item => item.time);
        historyChart.data.datasets[0].data = moistureHistory.map(item => item.percentage);
        historyChart.update();
    }
}

// Get status class based on moisture percentage
function getStatusClass(percentage) {
    if (percentage <= 30) return 'status-need-water';
    if (percentage <= 70) return 'status-ok';
    return 'status-too-wet';
}

// Get status text based on moisture percentage
function getStatusText(percentage) {
    if (percentage <= 30) return 'NEED WATER';
    if (percentage <= 70) return 'OK';
    return 'TOO WET';
}

// Update UI with sensor data
function updateUI(data) {
    if (!data) return;
    
    const percentage = data.moisture_percent || 0;
    const statusClass = getStatusClass(percentage);
    const statusText = getStatusText(percentage);
    
    // Update elements
    elements.moisturePercent.textContent = `${percentage.toFixed(1)}%`;
    elements.statusIndicator.textContent = statusText;
    elements.statusIndicator.className = `status-indicator ${statusClass}`;
    
    elements.temperature.textContent = data.temperature ? `${data.temperature.toFixed(1)}°C` : '--°C';
    elements.humidity.textContent = data.humidity ? `${data.humidity.toFixed(1)}%` : '--%';
    elements.rawValue.textContent = data.moisture_value || '--';
    
    updateCount++;
    elements.updateCount.textContent = updateCount;
    
    // Update timestamp
    const now = new Date();
    elements.lastUpdate.textContent = now.toLocaleTimeString();
    
    // Update device ID if available
    if (data.device_id && data.device_id !== currentDeviceId) {
        currentDeviceId = data.device_id;
        elements.deviceId.textContent = currentDeviceId;
        localStorage.setItem('plantDeviceId', currentDeviceId);
    }
    
    // Update charts
    updateGauge(percentage);
    updateHistoryChart(percentage, data.timestamp || Date.now());
}

// Fetch data from Firebase
async function fetchData() {
    try {
        const response = await fetch(
            `https://${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`
        );
        
        if (!response.ok) throw new Error('Failed to fetch data');
        
        const data = await response.json();
        updateUI(data);
        
    } catch (error) {
        console.error('Error fetching data:', error);
        
        // Show error in UI
        elements.moisturePercent.textContent = 'ERROR';
        elements.statusIndicator.textContent = 'CONNECTION FAILED';
        elements.statusIndicator.className = 'status-indicator status-need-water';
        
        // Try demo data as fallback
        const demoData = {
            device_id: currentDeviceId,
            moisture_value: Math.floor(Math.random() * 4096),
            moisture_percent: Math.random() * 100,
            temperature: 22 + Math.random() * 5,
            humidity: 40 + Math.random() * 30,
            timestamp: Date.now(),
            status: getStatusText(Math.random() * 100)
        };
        
        // Uncomment for demo mode
        // updateUI(demoData);
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);
