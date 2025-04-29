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
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            
            this.availableCameras = videoDevices;
            
            // Clear and populate camera select
            this.cameraSelect.innerHTML = '';
            videoDevices.forEach(device => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.text = device.label || `Camera ${this.cameraSelect.options.length + 1}`;
                this.cameraSelect.appendChild(option);
            });
            
            // Enable controls if cameras are available
            if (videoDevices.length > 0) {
                this.cameraSelect.disabled = false;
                this.cameraToggleButton.disabled = false;
            }
        } catch (error) {
            console.error('Error enumerating devices:', error);
        }
    }
    
    /**
     * Start selected camera
     */
    async startCamera() {
        try {
            const constraints = {
                video: {
                    deviceId: this.cameraSelect.value ? { exact: this.cameraSelect.value } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            
            // Update UI
            this.cameraToggleButton.textContent = 'Stop Camera';
            
            // Start sending frames to server
            this.startFrameCapture();
            
            // Register stream with server
            if (socket && socket.connected) {
                socket.emit('register_stream', {
                    device_name: 'Local Webcam',
                    width: this.videoElement.videoWidth || 640,
                    height: this.videoElement.videoHeight || 480
                });
            }
            
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
            this.stream.getTracks().forEach(track => track.stop());
            this.videoElement.srcObject = null;
            this.stream = null;
            
            // Update UI
            this.cameraToggleButton.textContent = 'Start Camera';
            
            // Stop frame capturing
            this.stopFrameCapture();
            
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
}

// Initialize camera manager when document is loaded
let cameraManager;
document.addEventListener('DOMContentLoaded', () => {
    cameraManager = new CameraManager();
});