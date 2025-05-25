/**
 * Spatial Detector Application - Main Entry Point
 *
 * This is the refactored main application that uses modular components
 * for better performance and maintainability.
 */

import ConnectionManager from './modules/connection-manager.js';
import DetectionProcessor from './modules/detection-processor.js';
import UIManager from './modules/ui-manager.js';
import BoundingBoxRenderer from './modules/bbox-renderer.js';

class SpatialDetectorApp {
    constructor() {
        // Core modules
        this.connection = new ConnectionManager();
        this.detectionProcessor = new DetectionProcessor({
            minConfidence: 0.5,
            maxAge: 500,
            mergeThreshold: 50
        });
        this.ui = new UIManager();
        this.bboxRenderer = null; // Initialized after DOM ready

        // App state
        this.state = {
            camera: {
                active: false,
                deviceId: null
            },
            detection: {
                enabled: true,
                showLabels: true,
                showDepth: true
            },
            map: {
                visible: false,
                showGrid: false
            },
            calibration: {
                active: false,
                distance: 1.0
            }
        };

        // Performance tracking
        this.performance = {
            frameCount: 0,
            lastFpsUpdate: Date.now(),
            fps: 0
        };

        // Server info
        this.serverInfo = {
            isMac: false,
            detectorReady: false,
            depthReady: false
        };
    }

    /**
     * Initialize the application
     */
    async init() {
        console.log('Initializing Spatial Detector...');

        // Setup UI event listeners
        this.setupUIListeners();

        // Initialize bounding box renderer
        const videoContainer = document.getElementById('video-container');
        if (videoContainer) {
            this.bboxRenderer = new BoundingBoxRenderer(videoContainer);
        }

        // Connect to server
        await this.connectToServer();

        // Fetch initial server status
        await this.fetchServerStatus();

        // Setup connection event handlers
        this.setupConnectionHandlers();

        // Load saved preferences
        this.loadPreferences();

        // Start FPS counter
        this.startFPSCounter();

        // Check for first-time setup
        if (!localStorage.getItem('spatial-detector-setup-completed')) {
            this.showSetupWizard();
        }

        console.log('Initialization complete');
    }

    /**
     * Connect to WebSocket server
     */
    async connectToServer() {
        try {
            await this.connection.connect();
            this.ui.updateConnectionStatus(true, 'Connected');
            this.ui.showStatus('success', 'Connected to server');
        } catch (error) {
            console.error('Failed to connect:', error);
            this.ui.updateConnectionStatus(false, 'Disconnected');
            this.ui.showStatus('error', 'Failed to connect to server');
        }
    }

    /**
     * Setup connection event handlers
     */
    setupConnectionHandlers() {
        // Connection events
        this.connection.addEventListener('connected', () => {
            this.ui.updateConnectionStatus(true, 'Connected');
        });

        this.connection.addEventListener('disconnected', () => {
            this.ui.updateConnectionStatus(false, 'Disconnected');
        });

        this.connection.addEventListener('error', (event) => {
            console.error('Connection error:', event.detail);
            this.ui.showStatus('error', `Connection error: ${event.detail.message}`);
        });

        // Detection results
        this.connection.addEventListener('detection_results', (event) => {
            this.handleDetectionResults(event.detail);
        });

        // Initialization status
        this.connection.addEventListener('initialization_status', (event) => {
            this.handleInitializationStatus(event.detail);
        });

        // Processing errors
        this.connection.addEventListener('processing_error', (event) => {
            console.error('Processing error:', event.detail);
            this.ui.showStatus('error', `Processing error: ${event.detail.message || 'Unknown error'}`);
        });
    }

    /**
     * Handle detection results
     */
    handleDetectionResults(data) {
        // Update FPS
        this.updateFPS();

        // Process detections
        const processed = this.detectionProcessor.processResults(data.detections || []);

        // Update stream view if present
        if (data.image) {
            const streamView = document.getElementById('stream-view');
            if (streamView) {
                streamView.src = data.image;
                streamView.style.display = 'block';
            }
        }

        // Render bounding boxes
        if (this.bboxRenderer && this.state.detection.enabled) {
            this.bboxRenderer.render(processed.detections, {
                showLabels: this.state.detection.showLabels,
                showConfidence: true,
                show3DIndicator: true
            });
        }

        // Update detection info
        this.ui.updateDetectionInfo(
            processed.detections,
            this.state.detection.showLabels
        );

        // Update 3D map if visible
        if (window.mapView && this.state.map.visible) {
            window.mapView.updateObjects(processed.detections);
        }

        // Log metrics periodically
        if (this.performance.frameCount % 100 === 0) {
            console.log('Detection metrics:', processed.metrics);
        }
    }

    /**
     * Handle initialization status updates
     */
    handleInitializationStatus(data) {
        switch (data.status) {
            case 'starting':
                this.ui.showStatus('info', data.message, 1);
                break;
            case 'progress':
                this.ui.showStatus('info', `${data.component}: ${data.message}`, 0);
                break;
            case 'complete':
                this.ui.showStatus('success', 'Initialization complete', 2);
                if (data.component === 'detector') {
                    this.serverInfo.detectorReady = true;
                } else if (data.component === 'depth') {
                    this.serverInfo.depthReady = true;
                }
                break;
            case 'error':
                this.ui.showStatus('error', `Initialization error: ${data.message}`, 3);
                break;
        }
    }

    /**
     * Fetch server status
     */
    async fetchServerStatus() {
        try {
            const response = await fetch('/api/status');
            const data = await response.json();

            this.serverInfo = {
                isMac: data.is_mac || false,
                detectorReady: data.detector_ready || false,
                depthReady: data.depth_ready || false
            };

            // Update UI based on capabilities
            const generateQrButton = document.getElementById('generate-qr');
            if (generateQrButton) {
                generateQrButton.disabled = !this.serverInfo.isMac;
            }

            if (this.serverInfo.detectorReady) {
                this.ui.showStatus('success', 'Object detector loaded');
            }

            if (this.serverInfo.depthReady) {
                this.ui.showStatus('success', 'Depth estimator loaded');
            }
        } catch (error) {
            console.error('Failed to fetch server status:', error);
        }
    }

    /**
     * Setup UI event listeners
     */
    setupUIListeners() {
        // Visualization toggles
        const toggleLabels = document.getElementById('toggle-labels');
        if (toggleLabels) {
            toggleLabels.addEventListener('change', (e) => {
                this.state.detection.showLabels = e.target.checked;
                this.savePreferences();
            });
        }

        const toggleDepth = document.getElementById('toggle-depth');
        if (toggleDepth) {
            toggleDepth.addEventListener('change', (e) => {
                this.state.detection.showDepth = e.target.checked;
                this.updateServerConfig();
                this.savePreferences();
            });
        }

        const toggleGrid = document.getElementById('toggle-grid');
        if (toggleGrid) {
            toggleGrid.addEventListener('change', (e) => {
                this.state.map.showGrid = e.target.checked;
                if (window.mapView) {
                    window.mapView.toggleGrid(e.target.checked);
                }
                this.savePreferences();
            });
        }

        // Map toggle
        const toggleMap = document.getElementById('toggle-map');
        if (toggleMap) {
            toggleMap.addEventListener('click', () => {
                this.toggleMap();
            });
        }

        // Calibration
        const startCalibration = document.getElementById('start-calibration');
        if (startCalibration) {
            startCalibration.addEventListener('click', () => {
                this.startCalibration();
            });
        }

        // QR Code generation
        const generateQr = document.getElementById('generate-qr');
        if (generateQr) {
            generateQr.addEventListener('click', () => {
                this.generateQRCode();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyPress(e);
        });
    }

    /**
     * Toggle 3D map visibility
     */
    toggleMap() {
        this.state.map.visible = !this.state.map.visible;
        const mapContainer = document.getElementById('map-container');
        const toggleButton = document.getElementById('toggle-map');

        if (this.state.map.visible) {
            mapContainer.style.display = 'block';
            toggleButton.textContent = 'Hide Map';

            if (!window.mapView) {
                // Lazy load map view
                import('./map-view.js').then(module => {
                    window.mapView = new module.default('map-container');
                    window.mapView.toggleGrid(this.state.map.showGrid);
                });
            }
        } else {
            mapContainer.style.display = 'none';
            toggleButton.textContent = 'Show Map';
        }

        this.savePreferences();
    }

    /**
     * Handle keyboard shortcuts
     */
    handleKeyPress(event) {
        // Don't handle if typing in an input
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return;
        }

        switch (event.key) {
            case 'c':
                // Toggle calibration
                if (this.state.calibration.active) {
                    this.stopCalibration();
                } else {
                    this.startCalibration();
                }
                break;
            case 'm':
                // Toggle map
                this.toggleMap();
                break;
            case 'l':
                // Toggle labels
                const toggleLabels = document.getElementById('toggle-labels');
                if (toggleLabels) {
                    toggleLabels.checked = !toggleLabels.checked;
                    toggleLabels.dispatchEvent(new Event('change'));
                }
                break;
        }
    }

    /**
     * Start calibration mode
     */
    startCalibration() {
        this.state.calibration.active = true;
        const calibrationUI = document.getElementById('calibration-ui');
        if (calibrationUI) {
            calibrationUI.classList.remove('hidden');
        }
        this.ui.showStatus('info', 'Calibration mode activated. Position crosshair and press SPACE.');
    }

    /**
     * Stop calibration mode
     */
    stopCalibration() {
        this.state.calibration.active = false;
        const calibrationUI = document.getElementById('calibration-ui');
        if (calibrationUI) {
            calibrationUI.classList.add('hidden');
        }
    }

    /**
     * Generate QR code for connection
     */
    async generateQRCode() {
        if (!this.serverInfo.isMac) {
            this.ui.showStatus('warning', 'QR code generation is only available on macOS');
            return;
        }

        try {
            const response = await fetch('/api/qrcode');
            const data = await response.json();

            if (data.qr_code) {
                const qrContainer = document.getElementById('qr-code');
                if (qrContainer) {
                    qrContainer.innerHTML = `<img src="data:image/png;base64,${data.qr_code}" alt="Connection QR Code">`;
                }
                this.ui.showStatus('success', 'QR code generated');
            }
        } catch (error) {
            console.error('Failed to generate QR code:', error);
            this.ui.showStatus('error', 'Failed to generate QR code');
        }
    }

    /**
     * Update server configuration
     */
    updateServerConfig() {
        if (!this.connection.isConnected()) return;

        this.connection.emit('update_config', {
            show_depth: this.state.detection.showDepth,
            min_confidence: this.detectionProcessor.minConfidence
        });
    }

    /**
     * Update FPS counter
     */
    updateFPS() {
        this.performance.frameCount++;
        const now = Date.now();
        const elapsed = now - this.performance.lastFpsUpdate;

        if (elapsed >= 1000) {
            this.performance.fps = Math.round((this.performance.frameCount / elapsed) * 1000);
            this.ui.updateFPS(this.performance.fps);

            this.performance.frameCount = 0;
            this.performance.lastFpsUpdate = now;
        }
    }

    /**
     * Start FPS counter
     */
    startFPSCounter() {
        setInterval(() => {
            if (this.performance.frameCount > 0) {
                this.updateFPS();
            }
        }, 1000);
    }

    /**
     * Show setup wizard
     */
    showSetupWizard() {
        const wizard = document.getElementById('setup-wizard');
        if (wizard) {
            wizard.classList.remove('hidden');
        }
    }

    /**
     * Save preferences to localStorage
     */
    savePreferences() {
        const prefs = {
            detection: this.state.detection,
            map: this.state.map
        };
        localStorage.setItem('spatial-detector-prefs', JSON.stringify(prefs));
    }

    /**
     * Load preferences from localStorage
     */
    loadPreferences() {
        const saved = localStorage.getItem('spatial-detector-prefs');
        if (saved) {
            try {
                const prefs = JSON.parse(saved);
                Object.assign(this.state.detection, prefs.detection || {});
                Object.assign(this.state.map, prefs.map || {});

                // Apply loaded preferences to UI
                this.applyPreferences();
            } catch (error) {
                console.error('Failed to load preferences:', error);
            }
        }
    }

    /**
     * Apply preferences to UI elements
     */
    applyPreferences() {
        const toggleLabels = document.getElementById('toggle-labels');
        if (toggleLabels) {
            toggleLabels.checked = this.state.detection.showLabels;
        }

        const toggleDepth = document.getElementById('toggle-depth');
        if (toggleDepth) {
            toggleDepth.checked = this.state.detection.showDepth;
        }

        const toggleGrid = document.getElementById('toggle-grid');
        if (toggleGrid) {
            toggleGrid.checked = this.state.map.showGrid;
        }
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.connection.disconnect();
        this.ui.clear();
        if (this.bboxRenderer) {
            this.bboxRenderer.clear();
        }
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SpatialDetectorApp();
    window.app.init().catch(error => {
        console.error('Failed to initialize app:', error);
    });
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});
