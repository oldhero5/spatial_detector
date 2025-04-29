/**
 * Main JavaScript file for Spatial Detector Web UI
 */

// Global variables
let socket;
let socketConnected = false;
let streamActive = false;
let showLabels = true;
let showDepth = true;
let showMap = false;
let currentStream = null;
let lastDetections = [];
let fps = 0;
let frameCount = 0;
let lastFpsUpdate = Date.now();

// DOM elements
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const streamView = document.getElementById('stream-view');
const toggleLabelsCheckbox = document.getElementById('toggle-labels');
const toggleDepthCheckbox = document.getElementById('toggle-depth');
const toggleGridCheckbox = document.getElementById('toggle-grid');
const toggleMapButton = document.getElementById('toggle-map');
const resetViewButton = document.getElementById('reset-view');
const exportModelButton = document.getElementById('export-model');
const startCalibrationButton = document.getElementById('start-calibration');
const saveCalibrationButton = document.getElementById('save-calibration');
const newProjectButton = document.getElementById('new-project');
const saveProjectButton = document.getElementById('save-project');
const loadProjectButton = document.getElementById('load-project');
const generateQrButton = document.getElementById('generate-qr');
const qrCodeContainer = document.getElementById('qr-code');
const detectionInfoElement = document.getElementById('detection-info');
const calibrationUI = document.getElementById('calibration-ui');
const calibDistanceElement = document.getElementById('calib-distance');
const fpsCounter = document.getElementById('fps-counter');
const setupWizard = document.getElementById('setup-wizard');

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Check for first time use and show wizard
    if (!localStorage.getItem('spatial-detector-setup-completed')) {
        showSetupWizard();
    }
    
    initSocketConnection();
    initEventListeners();
    startFpsCounter();
});

/**
 * Initialize Socket.IO connection to the server
 */
function initSocketConnection() {
    // Connect to the server
    socket = io.connect(window.location.origin, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity
    });

    // Socket event handlers
    socket.on('connect', () => {
        console.log('Connected to server');
        socketConnected = true;
        updateConnectionStatus(true);
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        socketConnected = false;
        updateConnectionStatus(false);
    });

    socket.on('detection_results', (data) => {
        // Update detection information
        lastDetections = data.detections;
        updateDetectionInfo(data.detections);
        
        // Update map if active
        if (showMap && window.mapView) {
            window.mapView.updateObjects(data.detections);
        }
        
        // Update FPS counter
        frameCount++;
    });
}

/**
 * Initialize event listeners for UI controls
 */
function initEventListeners() {
    // Visualization controls
    toggleLabelsCheckbox.addEventListener('change', (e) => {
        showLabels = e.target.checked;
        updateServerConfig();
    });

    toggleDepthCheckbox.addEventListener('change', (e) => {
        showDepth = e.target.checked;
        updateServerConfig();
    });

    toggleGridCheckbox.addEventListener('change', (e) => {
        if (window.mapView) {
            window.mapView.toggleGrid(e.target.checked);
        }
    });

    // Map controls
    toggleMapButton.addEventListener('click', () => {
        showMap = !showMap;
        const mapContainer = document.querySelector('.map-view');
        
        if (showMap) {
            toggleMapButton.textContent = 'Hide Map';
            mapContainer.style.display = 'flex';
            
            // Initialize 3D map if not already done
            if (!window.mapView) {
                window.mapView = new MapView('map-container');
            }
            
            // Update with latest detections
            if (lastDetections.length > 0) {
                window.mapView.updateObjects(lastDetections);
            }
        } else {
            toggleMapButton.textContent = 'Show Map';
            mapContainer.style.display = 'none';
        }
    });

    resetViewButton.addEventListener('click', () => {
        if (window.mapView) {
            window.mapView.resetView();
        }
    });

    // Calibration controls
    startCalibrationButton.addEventListener('click', () => {
        toggleCalibrationMode(true);
    });

    // Project controls
    newProjectButton.addEventListener('click', () => {
        showSetupWizard();
    });

    // QR Code generation
    generateQrButton.addEventListener('click', generateConnectionQR);
    
    // Keyboard controls for calibration
    document.addEventListener('keydown', (e) => {
        if (calibrationUI.classList.contains('hidden')) return;
        
        const currentDistance = parseFloat(calibDistanceElement.textContent);
        
        switch (e.code) {
            case 'Space':
                // Set calibration point
                saveCalibrationButton.disabled = false;
                break;
            case 'Equal': // + key
            case 'NumpadAdd':
                // Increase distance
                calibDistanceElement.textContent = (currentDistance + 0.1).toFixed(1);
                break;
            case 'Minus':
            case 'NumpadSubtract':
                // Decrease distance
                calibDistanceElement.textContent = Math.max(0.1, (currentDistance - 0.1)).toFixed(1);
                break;
            case 'KeyQ':
                // Exit calibration mode
                toggleCalibrationMode(false);
                break;
        }
    });
}

/**
 * Update connection status UI
 */
function updateConnectionStatus(connected) {
    if (connected) {
        statusIndicator.classList.add('connected');
        statusText.textContent = 'Connected';
    } else {
        statusIndicator.classList.remove('connected');
        statusText.textContent = 'Disconnected';
    }
}

/**
 * Update server configuration
 */
function updateServerConfig() {
    if (!socketConnected) return;
    
    socket.emit('config', {
        show_labels: showLabels,
        show_depth: showDepth
    });
    
    // Also update UI accordingly
    if (showLabels) {
        detectionInfoElement.style.display = 'block';
    } else {
        detectionInfoElement.style.display = 'none';
    }
}

/**
 * Display detection information on screen
 */
function updateDetectionInfo(detections) {
    if (!showLabels) return;
    
    let html = '';
    
    detections.forEach(detection => {
        const pos = detection.position_3d;
        const posText = pos ? `(${pos[0].toFixed(2)}, ${pos[1].toFixed(2)}, ${pos[2].toFixed(2)})` : '';
        
        html += `<div class="detection-item">
            <span class="detection-label">${detection.label}</span>
            <span class="detection-confidence">${(detection.confidence * 100).toFixed(0)}%</span>
            <span class="detection-position">${posText}</span>
        </div>`;
    });
    
    detectionInfoElement.innerHTML = html;
}

/**
 * Toggle calibration mode
 */
function toggleCalibrationMode(enabled) {
    if (enabled) {
        calibrationUI.classList.remove('hidden');
        saveCalibrationButton.disabled = true;
        startCalibrationButton.disabled = true;
    } else {
        calibrationUI.classList.add('hidden');
        saveCalibrationButton.disabled = true;
        startCalibrationButton.disabled = false;
    }
}

/**
 * Generate QR code for connection
 */
function generateConnectionQR() {
    if (!socketConnected) {
        alert('Server not connected. Please wait for server connection.');
        return;
    }
    
    // This would typically generate a unique connection code
    const connectionUrl = `${window.location.origin}/connect/${Date.now()}`;
    
    // In a real implementation, this would create an actual QR code
    // Here we'll just display the URL for demonstration
    qrCodeContainer.innerHTML = `
        <div style="padding: 10px; background: white; border: 1px solid #ccc;">
            <p style="text-align: center;">QR Code for:</p>
            <p style="text-align: center; font-size: 12px;">${connectionUrl}</p>
        </div>
    `;
}

/**
 * Start FPS counter update
 */
function startFpsCounter() {
    setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastFpsUpdate) / 1000;
        
        // Calculate FPS
        if (elapsed > 0.5) {
            fps = Math.round(frameCount / elapsed);
            fpsCounter.textContent = `${fps} FPS`;
            
            frameCount = 0;
            lastFpsUpdate = now;
        }
    }, 500);
}

/**
 * Show setup wizard
 */
function showSetupWizard() {
    setupWizard.classList.remove('hidden');
}