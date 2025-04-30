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
let isMac = false; // Will be set from server data

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
const qrInstructions = document.getElementById('qr-instructions');
const connectionStatusArea = document.getElementById('connection-status-area');
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
    
    // Get initial server status
    fetchServerStatus();
});

/**
 * Fetch initial server status
 */
function fetchServerStatus() {
    fetch('/api/status')
        .then(response => response.json())
        .then(data => {
            console.log('Server status:', data);
            isMac = data.is_mac;
            
            // If on macOS, enable QR code generation
            if (isMac) {
                generateQrButton.disabled = false;
                
                // If connection_info is already available, show QR code
                if (data.connection_info && data.connection_info.qr_code) {
                    displayQRCode(data.connection_info);
                }
            } else {
                generateQrButton.disabled = true;
                qrInstructions.textContent = "QR code generation is only available on macOS";
            }
            
            // Update detector status
            if (data.detector_ready) {
                showStatusMessage('success', 'Object detector loaded successfully');
            }
            
            if (data.depth_ready) {
                showStatusMessage('success', 'Depth estimator loaded successfully');
            }
        })
        .catch(error => {
            console.error('Error fetching server status:', error);
            showStatusMessage('error', 'Failed to connect to server');
        });
}

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
        console.log('Received detection results:', data);
        
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
    
    // Model initialization status messages
    socket.on('initialization_status', (data) => {
        console.log('Initialization status:', data);
        
        if (data.status === 'starting') {
            showStatusMessage('info', data.message);
        } else if (data.status === 'progress') {
            showStatusMessage('info', `${data.component}: ${data.message}`);
        } else if (data.status === 'complete') {
            showStatusMessage('success', data.message);
        } else if (data.status === 'error') {
            showStatusMessage('error', data.message);
        }
    });
}

/**
 * Show status message in the connection status area
 */
function showStatusMessage(type, message) {
    const msgElement = document.createElement('div');
    msgElement.className = `status-message ${type}`;
    
    // Add appropriate icon based on message type
    let icon = '';
    switch (type) {
        case 'success':
            icon = '<i class="fas fa-check-circle"></i>';
            break;
        case 'error':
            icon = '<i class="fas fa-exclamation-circle"></i>';
            break;
        case 'info':
            icon = '<i class="fas fa-info-circle"></i>';
            break;
        case 'warning':
            icon = '<i class="fas fa-exclamation-triangle"></i>';
            break;
    }
    
    msgElement.innerHTML = `${icon} ${message}`;
    
    // Add to status area and remove after timeout
    connectionStatusArea.appendChild(msgElement);
    
    // Auto-remove after 5 seconds for success messages
    if (type === 'success' || type === 'info') {
        setTimeout(() => {
            msgElement.remove();
        }, 5000);
    }
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
    
    saveCalibrationButton.addEventListener('click', () => {
        saveCalibration();
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
                showStatusMessage('success', 'Calibration point set! Press "Save Calibration" to save it.');
                // Visual feedback for calibration
                showCalibrationFeedback();
                break;
            case 'Equal': // + key
            case 'NumpadAdd':
            case 'Plus':
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
 * Save calibration data to server
 */
function saveCalibration() {
    if (!socketConnected) {
        showStatusMessage('error', 'Cannot save calibration: Server not connected');
        return;
    }
    
    const calibrationDistance = parseFloat(calibDistanceElement.textContent);
    
    // Send calibration data to server
    socket.emit('save_calibration', {
        distance: calibrationDistance
    });
    
    showStatusMessage('success', `Calibration saved at ${calibrationDistance.toFixed(1)}m`);
    toggleCalibrationMode(false);
}

/**
 * Show visual feedback for calibration
 */
function showCalibrationFeedback() {
    // Create a pulsing circle to indicate calibration point is set
    const feedbackElement = document.createElement('div');
    feedbackElement.style.position = 'absolute';
    feedbackElement.style.top = '50%';
    feedbackElement.style.left = '50%';
    feedbackElement.style.width = '60px';
    feedbackElement.style.height = '60px';
    feedbackElement.style.borderRadius = '50%';
    feedbackElement.style.border = '3px solid var(--status-success)';
    feedbackElement.style.transform = 'translate(-50%, -50%)';
    feedbackElement.style.boxShadow = '0 0 15px var(--status-success)';
    feedbackElement.className = 'pulse';
    
    // Append to video overlay
    document.querySelector('.video-overlay').appendChild(feedbackElement);
    
    // Remove after a few seconds
    setTimeout(() => {
        feedbackElement.remove();
    }, 3000);
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
    if (!showLabels || !detections || detections.length === 0) {
        detectionInfoElement.innerHTML = '';
        return;
    }
    
    let html = '';
    
    detections.forEach(detection => {
        const pos = detection.position_3d;
        let posText = '';
        
        if (pos && Array.isArray(pos) && pos.length >= 3) {
            // Focus on the depth (Z) value which is most useful
            posText = `${pos[2].toFixed(1)}m`;
        }
        
        // Build CSS class for label based on object type
        let labelClass = 'detection-label';
        const label = detection.label || 'unknown';
        
        html += `<div class="detection-item">
            <div>
                <span class="${labelClass}">${label}</span>
                <span class="detection-confidence">${(detection.confidence * 100).toFixed(0)}%</span>
            </div>
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
        showStatusMessage('info', 'Calibration mode activated. Position crosshair on object at known distance and press SPACE.');
    } else {
        calibrationUI.classList.add('hidden');
        saveCalibrationButton.disabled = true;
        startCalibrationButton.disabled = false;
        showStatusMessage('info', 'Calibration mode deactivated');
    }
}

/**
 * Generate QR code for connection
 */
function generateConnectionQR() {
    if (!socketConnected) {
        showStatusMessage('error', 'Server not connected. Please wait for server connection.');
        return;
    }
    
    if (!isMac) {
        showStatusMessage('warning', 'QR code generation is only available on macOS');
        return;
    }
    
    // Show loading state
    qrCodeContainer.innerHTML = `
        <div class="loading-indicator">
            <div class="loading-spinner"></div>
            <span>Generating QR code...</span>
        </div>
    `;
    
    // Fetch QR code from server
    fetch('/api/qrcode')
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to generate QR code');
            }
            return response.json();
        })
        .then(data => {
            if (data && data.qr_code) {
                displayQRCode({
                    qr_code: data.qr_code,
                    url: window.location.origin
                });
            } else {
                throw new Error('Invalid QR code data');
            }
        })
        .catch(error => {
            console.error('Error generating QR code:', error);
            qrCodeContainer.innerHTML = '';
            showStatusMessage('error', 'Failed to generate QR code: ' + error.message);
        });
}

/**
 * Display QR code from data
 */
function displayQRCode(data) {
    if (!data || !data.qr_code) {
        showStatusMessage('error', 'Invalid QR code data');
        return;
    }
    
    // Display the QR code
    qrCodeContainer.innerHTML = `
        <img src="data:image/png;base64,${data.qr_code}" alt="Connection QR Code">
    `;
    
    // Update instructions
    qrInstructions.innerHTML = `
        <span>Scan with your iPhone camera</span><br>
        <small>Or open this URL: ${data.url || window.location.origin}</small>
    `;
    
    showStatusMessage('success', 'QR code generated successfully! Scan with your iPhone camera to connect.');
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