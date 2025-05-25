/**
 * ConnectionManager - Handles all WebSocket communication for Spatial Detector
 * 
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Event-based architecture
 * - Error handling and recovery
 * - Connection state management
 */
class ConnectionManager extends EventTarget {
    constructor(url = null) {
        super();
        this.url = url || window.location.origin;
        this.socket = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000; // Start with 1 second
        this.maxReconnectDelay = 30000; // Max 30 seconds
        this.reconnectTimer = null;
        this.eventHandlers = new Map();
        this.frameQueue = [];
        this.frameQueueSize = 3; // Limit queue size to prevent memory issues
    }

    /**
     * Connect to the WebSocket server
     * @returns {Promise<void>}
     */
    async connect() {
        try {
            if (this.socket && this.socket.connected) {
                console.warn('Already connected to server');
                return;
            }

            console.log('Connecting to server...');
            
            // Create socket connection
            this.socket = io(this.url, {
                reconnection: false, // We'll handle reconnection manually
                transports: ['websocket'],
                upgrade: false
            });

            // Setup event handlers
            this.setupSocketHandlers();
            
            // Wait for connection
            await this.waitForConnection();
            
        } catch (error) {
            console.error('Connection failed:', error);
            this.dispatchEvent(new CustomEvent('error', { detail: error }));
            this.scheduleReconnect();
        }
    }

    /**
     * Setup socket event handlers
     */
    setupSocketHandlers() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.reconnectDelay = 1000;
            
            // Clear any pending reconnect
            if (this.reconnectTimer) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = null;
            }
            
            this.dispatchEvent(new Event('connected'));
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            this.connected = false;
            this.dispatchEvent(new CustomEvent('disconnected', { detail: reason }));
            
            // Attempt reconnection unless explicitly disconnected
            if (reason !== 'io client disconnect') {
                this.scheduleReconnect();
            }
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error.message);
            this.dispatchEvent(new CustomEvent('error', { detail: error }));
        });

        // Forward all other events
        const eventTypes = [
            'initialization_status',
            'detection_results',
            'processing_error',
            'stream_registered',
            'calibration_saved'
        ];

        eventTypes.forEach(eventType => {
            this.socket.on(eventType, (data) => {
                this.dispatchEvent(new CustomEvent(eventType, { detail: data }));
            });
        });
    }

    /**
     * Wait for connection to be established
     * @returns {Promise<void>}
     */
    waitForConnection(timeout = 5000) {
        return new Promise((resolve, reject) => {
            if (this.connected) {
                resolve();
                return;
            }

            const timer = setTimeout(() => {
                reject(new Error('Connection timeout'));
            }, timeout);

            const handleConnect = () => {
                clearTimeout(timer);
                this.removeEventListener('connected', handleConnect);
                resolve();
            };

            this.addEventListener('connected', handleConnect);
        });
    }

    /**
     * Disconnect from server
     */
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.connected = false;
        this.reconnectAttempts = 0;
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.dispatchEvent(new Event('reconnect_failed'));
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );

        console.log(`Reconnecting in ${delay / 1000} seconds... (attempt ${this.reconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }

    /**
     * Emit event to server with error handling
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @param {Function} callback - Optional callback
     */
    emit(event, data, callback) {
        if (!this.connected || !this.socket) {
            console.warn(`Cannot emit '${event}': not connected`);
            if (callback) {
                callback({ error: 'Not connected' });
            }
            return;
        }

        try {
            if (callback) {
                this.socket.emit(event, data, callback);
            } else {
                this.socket.emit(event, data);
            }
        } catch (error) {
            console.error(`Error emitting '${event}':`, error);
            if (callback) {
                callback({ error: error.message });
            }
        }
    }

    /**
     * Send frame with queue management
     * @param {string} frameData - Base64 encoded frame
     */
    sendFrame(frameData) {
        if (!this.connected) {
            // Queue frames when disconnected (with size limit)
            if (this.frameQueue.length >= this.frameQueueSize) {
                this.frameQueue.shift(); // Remove oldest frame
            }
            this.frameQueue.push(frameData);
            return;
        }

        // Send queued frames first
        while (this.frameQueue.length > 0 && this.connected) {
            const queuedFrame = this.frameQueue.shift();
            this.emit('frame', { image: queuedFrame });
        }

        // Send current frame
        this.emit('frame', { image: frameData });
    }

    /**
     * Register stream with server
     * @param {Object} streamInfo - Stream information
     */
    registerStream(streamInfo) {
        return new Promise((resolve, reject) => {
            this.emit('register_stream', streamInfo, (response) => {
                if (response.error) {
                    reject(new Error(response.error));
                } else {
                    resolve(response);
                }
            });
        });
    }

    /**
     * Stop camera and notify server
     */
    stopCamera() {
        this.emit('stop_camera');
        // Clear any queued frames
        this.frameQueue = [];
    }

    /**
     * Get connection state
     * @returns {boolean}
     */
    isConnected() {
        return this.connected && this.socket && this.socket.connected;
    }

    /**
     * Get connection statistics
     * @returns {Object}
     */
    getStats() {
        return {
            connected: this.connected,
            reconnectAttempts: this.reconnectAttempts,
            queuedFrames: this.frameQueue.length,
            socketId: this.socket ? this.socket.id : null
        };
    }
}

// Export for use in other modules
export default ConnectionManager;