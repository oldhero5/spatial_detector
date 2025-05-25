/**
 * Camera handling for Spatial Detector Web UI
 */

class CameraManager {
    constructor() {
        this.videoElement = document.getElementById('local-video');
        this.cameraToggleButton = document.getElementById('camera-toggle');
        this.cameraSelect = document.getElementById('camera-select');
        this.streamConnectButton = document.getElementById('stream-connect');
        
        this.stream = null;
        this.availableCameras = [];
        this.frameCapturingInterval = null;
        
        this.initEventListeners();
        this.enumerateDevices();
    }
    
    /**
     * Initialize event listeners
     */
    initEventListeners() {
        this.cameraToggleButton.addEventListener('click', () => {
            if (this.stream) {
                this.stopCamera();
            } else {
                this.startCamera();
            }
        });
        
        this.cameraSelect.addEventListener('change', () => {
            if (this.stream) {
                this.stopCamera();
                this.startCamera();
            }
        });
        
        this.streamConnectButton.addEventListener('click', () => {
            // This would typically show a dialog with connection options
            // For now, just generate a QR code
            generateConnectionQR();
        });
    }
    
    /**
     * Enumerate available camera devices
     */
    async enumerateDevices() {
        try {
            // Check if mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
                console.error('MediaDevices API not available. This could be due to:');
                console.error('1. Not using HTTPS (current protocol: ' + window.location.protocol + ')');
                console.error('2. Browser doesn\'t support MediaDevices API');
                console.error('3. Permissions not granted');
                this.showMediaError();
                return;
            }

            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            this.availableCameras = videoDevices;
            
            // Clear and populate camera select
            this.cameraSelect.innerHTML = '';
            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${index + 1}`;
                this.cameraSelect.appendChild(option);
            });
            
            // Enable controls if cameras are available
            if (videoDevices.length > 0) {
                this.cameraSelect.disabled = false;
                this.cameraToggleButton.disabled = false;
            }
        } catch (error) {
            console.error('Error enumerating devices:', error);
            this.showMediaError();
        }
    }
    
    /**
     * Start selected camera
     */
    async startCamera() {
        try {
            // Check if mediaDevices is available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.error('getUserMedia not available. This could be due to:');
                console.error('1. Not using HTTPS (current protocol: ' + window.location.protocol + ')');
                console.error('2. Browser doesn\'t support getUserMedia');
                console.error('3. Permissions not granted');
                console.error('navigator.mediaDevices:', navigator.mediaDevices);
                this.showMediaError();
                return;
            }

            // Re-enumerate devices in case permissions changed or devices were added/removed
            await this.enumerateDevices();

            const constraints = {
                video: {
                    deviceId: this.cameraSelect.value ? { ideal: this.cameraSelect.value } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            
            try {
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
                // If exact device ID fails, try with default camera
                if (err.name === 'NotFoundError' && this.cameraSelect.value) {
                    console.warn('Specified camera not found, trying default camera');
                    const fallbackConstraints = {
                        video: {
                            width: { ideal: 1280 },
                            height: { ideal: 720 }
                        }
                    };
                    this.stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
                    // Re-enumerate to update the select dropdown
                    await this.enumerateDevices();
                } else {
                    throw err;
                }
            }
            this.videoElement.srcObject = this.stream;
            // Remove any inline styles that might have been set
            this.videoElement.style.display = '';
            
            // Update UI
            this.cameraToggleButton.textContent = 'Stop Camera';
            
            // Clear any previous detections/state before starting
            if (window.clearDetections) {
                window.clearDetections();
            }
            if (window.mapView && window.mapView.clearAllObjects) {
                window.mapView.clearAllObjects();
            }
            
            // Wait a moment for video dimensions to be available
            setTimeout(() => {
                // Register stream with server
                if (socket && socket.connected) {
                    socket.emit('register_stream', {
                        device_name: 'Local Webcam',
                        width: this.videoElement.videoWidth || 640,
                        height: this.videoElement.videoHeight || 480
                    });
                }
                
                // Start sending frames to server after registration
                this.startFrameCapture();
            }, 100);
            
            return true;
        } catch (error) {
            console.error('Error starting camera:', error);
            alert('Could not start camera: ' + error.message);
            return false;
        }
    }
    
    /**
     * Stop camera stream
     */
    stopCamera() {
        if (this.stream) {
            // Stop all tracks
            this.stream.getTracks().forEach(track => track.stop());
            
            // Clear video element - set to null but keep visible to maintain layout
            this.videoElement.srcObject = null;
            // Don't hide the video element, just let it show black
            
            // Clear the stream
            this.stream = null;
            
            // Update UI
            this.cameraToggleButton.textContent = 'Start Camera';
            
            // Stop frame capturing
            this.stopFrameCapture();
            
            // Notify server that camera has stopped
            if (socket && socket.connected) {
                socket.emit('stop_camera');
            }
            
            // Clear any existing detections from the UI
            if (window.clearDetections) {
                window.clearDetections();
            }
            
            // Clear the 3D map
            if (window.mapView && window.mapView.clearAllObjects) {
                window.mapView.clearAllObjects();
            }
            
            // The video container already has a black background
            // so when video srcObject is null, it will show black
            
            return true;
        }
        return false;
    }
    
    /**
     * Start capturing frames from the video and sending to server
     */
    startFrameCapture() {
        if (this.frameCapturingInterval) {
            clearInterval(this.frameCapturingInterval);
        }
        
        const captureFrame = () => {
            if (!this.stream || !socket || !socket.connected) return;
            
            // Create a canvas to get frame data
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Set canvas size to match video
            canvas.width = this.videoElement.videoWidth;
            canvas.height = this.videoElement.videoHeight;
            
            // Draw video frame to canvas
            context.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
            
            // Get base64 encoded image
            const imageData = canvas.toDataURL('image/jpeg', 0.7);
            
            // Send to server
            socket.emit('frame', { image: imageData });
        };
        
        // Capture frames at regular intervals
        this.frameCapturingInterval = setInterval(captureFrame, 50); // 20 FPS
    }
    
    /**
     * Stop capturing frames
     */
    stopFrameCapture() {
        if (this.frameCapturingInterval) {
            clearInterval(this.frameCapturingInterval);
            this.frameCapturingInterval = null;
        }
    }
    
    /**
     * Take a snapshot from the current video stream
     */
    takeSnapshot() {
        if (!this.stream) return null;
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = this.videoElement.videoWidth;
        canvas.height = this.videoElement.videoHeight;
        
        context.drawImage(this.videoElement, 0, 0, canvas.width, canvas.height);
        
        return canvas.toDataURL('image/png');
    }

    /**
     * Show media error message
     */
    showMediaError() {
        // Show error in UI
        const statusArea = document.getElementById('connection-status');
        if (statusArea) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'alert alert-danger';
            errorMsg.innerHTML = `
                <strong>Camera Access Error</strong><br>
                Unable to access camera. Please ensure:<br>
                1. You're using HTTPS (current: ${window.location.protocol})<br>
                2. You've accepted the security certificate<br>
                3. Camera permissions are granted<br>
                4. Your browser supports camera access
            `;
            statusArea.appendChild(errorMsg);
        }
        
        // Disable camera controls
        if (this.cameraToggleButton) this.cameraToggleButton.disabled = true;
        if (this.cameraSelect) this.cameraSelect.disabled = true;
    }
}

// Initialize camera manager when document is loaded
let cameraManager;
document.addEventListener('DOMContentLoaded', () => {
    cameraManager = new CameraManager();
    // Make it globally accessible
    window.cameraManager = cameraManager;
});