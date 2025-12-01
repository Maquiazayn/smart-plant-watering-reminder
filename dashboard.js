// dashboard.js - WITH ALGORITHM DATA
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

// Device ID - IMPORTANT: Get your actual device ID from ESP32 serial monitor
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
    lastUpdate: document.getElementById('lastUpdate'),
    // NEW: Algorithm data elements
    algorithmRawValue: document.getElementById('algorithmRawValue'),
    algorithmPercentage: document.getElementById('algorithmPercentage'),
    dataPoints: document.getElementById('dataPoints')
};

// Initialize dashboard
function initDashboard() {
    console.log("Dashboard initializing...");
    
    initializeGauge();
    initializeHistoryChart();
    
    // Get device ID - CRITICAL: Change this to your actual device ID
    const urlParams = new URLSearchParams(window.location.search);
    currentDeviceId = urlParams.get('device') || localStorage.getItem('plantDeviceId') || 'demo-device';
    
    // If using demo, try to get real device ID from Firebase
    if (currentDeviceId === 'demo-device') {
        discoverDeviceId();
    }
    
    elements.deviceId.textContent = currentDeviceId;
    localStorage.setItem('plantDeviceId', currentDeviceId);
    
    // Start periodic data fetching
    fetchData();
    setInterval(fetchData, 10000);
    
    // Add event listener for refresh button
    document.querySelector('.refresh-btn').addEventListener('click', fetchData);
    
    console.log("Dashboard initialized for device:", currentDeviceId);
}

// Try to discover actual device ID from Firebase
async function discoverDeviceId() {
    try {
        const response = await fetch(`${FIREBASE_CONFIG.databaseURL}/plants.json`);
        const data = await response.json();
        
        if (data && typeof data === 'object') {
            const deviceIds = Object.keys(data);
            if (deviceIds.length > 0) {
                currentDeviceId = deviceIds[0];
                elements.deviceId.textContent = currentDeviceId;
                localStorage.setItem('plantDeviceId', currentDeviceId);
                console.log("Discovered device ID:", currentDeviceId);
            }
        }
    } catch (error) {
        console.log("Could not discover device ID, using demo:", error);
    }
}

// Initialize moisture gauge
function initializeGauge() {
    const ctx = document.getElementById('moistureGauge').getContext('2d');
    
    moistureGauge = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [50, 50], // Start at 50%
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
        
        // Update data points count
        elements.dataPoints.textContent = moistureHistory.length;
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
    console.log("Updating UI with data:", data);
    
    if (!data) {
        console.warn("No data received");
        return;
    }
    
    const percentage = data.moisture_percent || 0;
    const rawValue = data.moisture_value || 0;
    const statusClass = getStatusClass(percentage);
    const statusText = getStatusText(percentage);
    
    // Update main elements
    elements.moisturePercent.textContent = `${percentage.toFixed(1)}%`;
    elements.statusIndicator.textContent = statusText;
    elements.statusIndicator.className = `status-indicator ${statusClass}`;
    
    elements.temperature.textContent = data.temperature ? `${data.temperature.toFixed(1)}°C` : '--°C';
    elements.humidity.textContent = data.humidity ? `${data.humidity.toFixed(1)}%` : '--%';
    elements.rawValue.textContent = rawValue;
    
    // NEW: Update algorithm data
    elements.algorithmRawValue.textContent = rawValue;
    elements.algorithmPercentage.textContent = `${percentage.toFixed(1)}%`;
    
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
        console.log("Updated device ID to:", currentDeviceId);
    }
    
    // Update charts
    updateGauge(percentage);
    updateHistoryChart(percentage, data.timestamp || Date.now());
    
    console.log("UI updated successfully");
}

// Fetch data from Firebase
async function fetchData() {
    console.log(`Fetching data for device: ${currentDeviceId}`);
    
    try {
        const url = `${FIREBASE_CONFIG.databaseURL}/plants/${currentDeviceId}/latest.json`;
        console.log("Fetching from URL:", url);
        
        const response = await fetch(url);
        console.log("Response status:", response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Received data:", data);
        
        if (data === null) {
            console.warn("No data found at this path");
            showDemoData();
            return;
        }
        
        updateUI(data);
        
    } catch (error) {
        console.error('Error fetching data:', error);
        
        // Show error in UI
        elements.moisturePercent.textContent = 'ERROR';
        elements.statusIndicator.textContent = 'CONNECTION FAILED';
        elements.statusIndicator.className = 'status-indicator status-need-water';
        
        // Also try demo mode
        showDemoData();
    }
}

// Show demo data for testing
function showDemoData() {
    console.log("Showing demo data");
    
    const rawValue = Math.floor(Math.random() * 4096);
    const percentage = 40 + Math.random() * 30; // Between 40-70%
    
    const demoData = {
        device_id: currentDeviceId,
        moisture_value: rawValue,
        moisture_percent: percentage,
        temperature: 22 + Math.random() * 5,
        humidity: 40 + Math.random() * 30,
        timestamp: Date.now(),
        status: 'OK'
    };
    
    // Update algorithm data with demo values
    elements.algorithmRawValue.textContent = rawValue;
    elements.algorithmPercentage.textContent = `${percentage.toFixed(1)}%`;
    
    updateUI(demoData);
    
    // Update status to show it's demo
    elements.statusIndicator.textContent = 'DEMO MODE';
    elements.deviceId.textContent = currentDeviceId + ' (DEMO)';
}

// Calculate moisture percentage (for educational purposes)
function calculateMoisturePercentage(rawValue) {
    // Sensor calibration values
    const DRY_VALUE = 4095;   // Value when sensor is dry (in air)
    const WET_VALUE = 1500;   // Value when sensor is in water
    
    // Constrain the raw value between wet and dry
    rawValue = Math.max(Math.min(rawValue, DRY_VALUE), WET_VALUE);
    
    // Map the value to percentage
    let percentage = ((rawValue - DRY_VALUE) * 100) / (WET_VALUE - DRY_VALUE);
    
    // Ensure percentage is between 0-100
    percentage = Math.max(0, Math.min(100, percentage));
    
    return percentage;
}

// Determine plant status based on moisture percentage
function getMoistureStatus(percentage) {
    if (percentage <= 30) {
        return "NEED WATER";
    } else if (percentage <= 70) {
        return "OK";
    } else {
        return "TOO WET";
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initDashboard);
