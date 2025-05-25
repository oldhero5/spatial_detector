/**
 * UIManager - Centralized UI update management with performance optimization
 *
 * Features:
 * - Batched DOM updates using requestAnimationFrame
 * - Element caching to reduce DOM queries
 * - Debounced updates for high-frequency changes
 * - Status message queue with priority
 */
class UIManager {
    constructor() {
        // Element cache
        this.elements = new Map();

        // Update queues
        this.updateQueue = [];
        this.immediateQueue = [];
        this.rafId = null;

        // Status message management
        this.statusQueue = [];
        this.statusTimeout = null;
        this.statusDuration = 3000;

        // Debounce timers
        this.debounceTimers = new Map();

        // Initialize
        this.cacheElements();
        this.startUpdateLoop();
    }

    /**
     * Cache commonly used DOM elements
     */
    cacheElements() {
        const elementIds = [
            'status-indicator',
            'status-text',
            'stream-view',
            'local-video',
            'video-container',
            'detection-info',
            'fps-counter',
            'overlay',
            'calibration-ui',
            'calib-distance',
            'map-container',
            'camera-toggle',
            'camera-select'
        ];

        elementIds.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            }
        });
    }

    /**
     * Get cached element or query DOM
     * @param {string} id - Element ID
     * @returns {HTMLElement|null}
     */
    getElement(id) {
        if (!this.elements.has(id)) {
            const element = document.getElementById(id);
            if (element) {
                this.elements.set(id, element);
            }
            return element;
        }
        return this.elements.get(id);
    }

    /**
     * Queue a DOM update
     * @param {Function} updateFn - Update function to execute
     * @param {boolean} immediate - Execute immediately
     */
    queueUpdate(updateFn, immediate = false) {
        if (immediate) {
            this.immediateQueue.push(updateFn);
            this.processImmediateQueue();
        } else {
            this.updateQueue.push(updateFn);
        }
    }

    /**
     * Queue a debounced update
     * @param {string} key - Unique key for this update
     * @param {Function} updateFn - Update function
     * @param {number} delay - Debounce delay in ms
     */
    queueDebouncedUpdate(key, updateFn, delay = 100) {
        if (this.debounceTimers.has(key)) {
            clearTimeout(this.debounceTimers.get(key));
        }

        const timer = setTimeout(() => {
            this.queueUpdate(updateFn);
            this.debounceTimers.delete(key);
        }, delay);

        this.debounceTimers.set(key, timer);
    }

    /**
     * Start the update loop
     */
    startUpdateLoop() {
        const processUpdates = () => {
            if (this.updateQueue.length > 0) {
                // Process all queued updates in a single frame
                const updates = this.updateQueue.splice(0);
                updates.forEach(update => {
                    try {
                        update();
                    } catch (error) {
                        console.error('Error in UI update:', error);
                    }
                });
            }

            this.rafId = requestAnimationFrame(processUpdates);
        };

        this.rafId = requestAnimationFrame(processUpdates);
    }

    /**
     * Process immediate updates
     */
    processImmediateQueue() {
        if (this.immediateQueue.length === 0) return;

        const updates = this.immediateQueue.splice(0);
        updates.forEach(update => {
            try {
                update();
            } catch (error) {
                console.error('Error in immediate UI update:', error);
            }
        });
    }

    /**
     * Update connection status
     * @param {boolean} connected
     * @param {string} text
     */
    updateConnectionStatus(connected, text = null) {
        this.queueUpdate(() => {
            const indicator = this.getElement('status-indicator');
            const statusText = this.getElement('status-text');

            if (indicator) {
                if (connected) {
                    indicator.classList.add('connected');
                } else {
                    indicator.classList.remove('connected');
                }
            }

            if (statusText && text !== null) {
                statusText.textContent = text;
            }
        });
    }

    /**
     * Update FPS counter
     * @param {number} fps
     */
    updateFPS(fps) {
        this.queueDebouncedUpdate('fps', () => {
            const fpsCounter = this.getElement('fps-counter');
            if (fpsCounter) {
                fpsCounter.textContent = `${Math.round(fps)} FPS`;
            }
        }, 500);
    }

    /**
     * Show status message with priority
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {string} message
     * @param {number} priority - Higher priority shows first
     * @param {number} duration - Custom duration in ms
     */
    showStatus(type, message, priority = 0, duration = null) {
        const status = {
            type,
            message,
            priority,
            duration: duration || this.statusDuration,
            timestamp: Date.now()
        };

        // Add to queue
        this.statusQueue.push(status);
        this.statusQueue.sort((a, b) => b.priority - a.priority);

        // Process queue
        this.processStatusQueue();
    }

    /**
     * Process status message queue
     */
    processStatusQueue() {
        if (this.statusQueue.length === 0) return;

        // Clear existing timeout
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
            this.statusTimeout = null;
        }

        // Get highest priority message
        const status = this.statusQueue.shift();

        // Create or update status element
        this.queueUpdate(() => {
            let statusElement = document.getElementById('status-message');
            if (!statusElement) {
                statusElement = this.createStatusElement();
            }

            // Update content and style
            statusElement.className = `status-message status-${status.type}`;
            statusElement.textContent = status.message;
            statusElement.style.display = 'block';

            // Fade in
            requestAnimationFrame(() => {
                statusElement.classList.add('show');
            });
        });

        // Schedule removal
        this.statusTimeout = setTimeout(() => {
            this.hideStatus();
            this.processStatusQueue(); // Process next in queue
        }, status.duration);
    }

    /**
     * Create status message element
     * @returns {HTMLElement}
     */
    createStatusElement() {
        const element = document.createElement('div');
        element.id = 'status-message';
        element.className = 'status-message';
        element.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            font-weight: 500;
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateX(100%);
            z-index: 1000;
            max-width: 400px;
        `;
        document.body.appendChild(element);
        return element;
    }

    /**
     * Hide status message
     */
    hideStatus() {
        this.queueUpdate(() => {
            const statusElement = document.getElementById('status-message');
            if (statusElement) {
                statusElement.classList.remove('show');
                setTimeout(() => {
                    statusElement.style.display = 'none';
                }, 300);
            }
        });
    }

    /**
     * Update detection info display
     * @param {Array} detections
     * @param {boolean} showLabels
     */
    updateDetectionInfo(detections, showLabels = true) {
        this.queueUpdate(() => {
            const infoElement = this.getElement('detection-info');
            if (!infoElement) return;

            if (!showLabels || !detections || detections.length === 0) {
                infoElement.style.display = 'none';
                return;
            }

            // Build HTML efficiently
            const html = detections.map(detection => {
                const confidence = Math.round(detection.confidence * 100);
                const distance = detection.position_3d
                    ? `${detection.position_3d[2].toFixed(1)}m`
                    : 'N/A';

                return `<div class="detection-item">
                    <span class="detection-label">${detection.label}</span>
                    <span class="detection-confidence">${confidence}%</span>
                    <span class="detection-distance">${distance}</span>
                </div>`;
            }).join('');

            infoElement.innerHTML = html;
            infoElement.style.display = 'block';
        });
    }

    /**
     * Clear all cached elements (for cleanup)
     */
    clear() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }

        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();

        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }

        this.elements.clear();
        this.updateQueue = [];
        this.immediateQueue = [];
        this.statusQueue = [];
    }

    /**
     * Add CSS styles for status messages
     */
    static addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .status-message {
                opacity: 0;
                transform: translateX(100%);
            }

            .status-message.show {
                opacity: 1;
                transform: translateX(0);
            }

            .status-success {
                background-color: #4caf50;
                color: white;
            }

            .status-error {
                background-color: #f44336;
                color: white;
            }

            .status-warning {
                background-color: #ff9800;
                color: white;
            }

            .status-info {
                background-color: #2196f3;
                color: white;
            }

            .detection-item {
                display: flex;
                justify-content: space-between;
                padding: 4px 0;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }

            .detection-item:last-child {
                border-bottom: none;
            }
        `;
        document.head.appendChild(style);
    }
}

// Add styles when module loads
UIManager.addStyles();

// Export for use in other modules
export default UIManager;
