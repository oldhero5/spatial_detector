/**
 * BoundingBoxRenderer - Efficient rendering of detection bounding boxes
 * 
 * Features:
 * - Object pooling for DOM elements
 * - Minimal DOM manipulation
 * - Smooth animations
 * - Color coding by class
 */
class BoundingBoxRenderer {
    constructor(container) {
        this.container = container;
        this.boxPool = [];
        this.activeBoxes = new Map();
        this.colorMap = new Map();
        this.animationDuration = 150; // ms
        
        // Default colors for common classes
        this.defaultColors = {
            person: '#3498db',
            car: '#e74c3c',
            truck: '#e74c3c',
            bus: '#e74c3c',
            bicycle: '#9b59b6',
            motorcycle: '#9b59b6',
            dog: '#f39c12',
            cat: '#f39c12',
            chair: '#2ecc71',
            couch: '#2ecc71',
            default: '#ff6b6b'
        };
        
        // Initialize styles
        this.initStyles();
    }

    /**
     * Initialize CSS styles for bounding boxes
     */
    initStyles() {
        const styleId = 'bbox-renderer-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .detection-box {
                position: absolute;
                border: 3px solid;
                background-color: transparent;
                pointer-events: none;
                transition: all ${this.animationDuration}ms ease-out;
                transform-origin: center;
            }
            
            .detection-box.new {
                animation: bbox-appear ${this.animationDuration}ms ease-out;
            }
            
            .detection-box.removing {
                opacity: 0;
                transform: scale(0.9);
            }
            
            .detection-label {
                position: absolute;
                top: -25px;
                left: 0;
                background-color: inherit;
                color: white;
                padding: 2px 8px;
                font-size: 12px;
                font-weight: bold;
                border-radius: 3px;
                white-space: nowrap;
                backdrop-filter: blur(5px);
                background-color: rgba(0, 0, 0, 0.7);
            }
            
            .detection-confidence {
                position: absolute;
                top: 3px;
                right: 3px;
                background-color: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 2px 6px;
                font-size: 11px;
                border-radius: 3px;
                backdrop-filter: blur(5px);
            }
            
            .detection-3d-indicator {
                position: absolute;
                top: 3px;
                left: 3px;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background-color: #00ff00;
                border: 2px solid white;
                box-shadow: 0 0 4px rgba(0, 255, 0, 0.5);
                animation: pulse 2s infinite;
            }
            
            @keyframes bbox-appear {
                from {
                    opacity: 0;
                    transform: scale(1.1);
                }
                to {
                    opacity: 1;
                    transform: scale(1);
                }
            }
            
            @keyframes pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.2); opacity: 0.8; }
                100% { transform: scale(1); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Render detections with efficient DOM updates
     * @param {Array} detections - Detection results
     * @param {Object} options - Rendering options
     */
    render(detections, options = {}) {
        const {
            showLabels = true,
            showConfidence = true,
            show3DIndicator = true
        } = options;

        // Get container dimensions
        const containerRect = this.container.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;

        // Track which boxes are still active
        const activeIds = new Set();

        // Update or create boxes for each detection
        detections.forEach(detection => {
            const id = detection.trackId || detection.id || this.generateId(detection);
            activeIds.add(id);

            let box = this.activeBoxes.get(id);
            if (!box) {
                // Get box from pool or create new one
                box = this.getBoxFromPool();
                this.activeBoxes.set(id, box);
                this.container.appendChild(box);
                
                // Add appear animation
                requestAnimationFrame(() => {
                    box.classList.add('new');
                    setTimeout(() => box.classList.remove('new'), this.animationDuration);
                });
            }

            // Update box position and style
            this.updateBox(box, detection, containerWidth, containerHeight, {
                showLabels,
                showConfidence,
                show3DIndicator
            });
        });

        // Remove boxes that are no longer active
        for (const [id, box] of this.activeBoxes) {
            if (!activeIds.has(id)) {
                this.removeBox(id, box);
            }
        }
    }

    /**
     * Update a single bounding box
     */
    updateBox(box, detection, containerWidth, containerHeight, options) {
        const [x1, y1, x2, y2] = detection.bbox;
        
        // Calculate percentage positions
        const left = (x1 / containerWidth) * 100;
        const top = (y1 / containerHeight) * 100;
        const width = ((x2 - x1) / containerWidth) * 100;
        const height = ((y2 - y1) / containerHeight) * 100;

        // Get color for class
        const color = this.getColorForClass(detection.class_name || detection.label);

        // Update box styles
        box.style.left = `${left}%`;
        box.style.top = `${top}%`;
        box.style.width = `${width}%`;
        box.style.height = `${height}%`;
        box.style.borderColor = color;

        // Update label
        if (options.showLabels) {
            let label = box.querySelector('.detection-label');
            if (!label) {
                label = document.createElement('div');
                label.className = 'detection-label';
                box.appendChild(label);
            }
            label.textContent = detection.label || detection.class_name || 'unknown';
            label.style.borderColor = color;
        } else {
            const label = box.querySelector('.detection-label');
            if (label) label.remove();
        }

        // Update confidence
        if (options.showConfidence) {
            let confidence = box.querySelector('.detection-confidence');
            if (!confidence) {
                confidence = document.createElement('div');
                confidence.className = 'detection-confidence';
                box.appendChild(confidence);
            }
            confidence.textContent = `${Math.round(detection.confidence * 100)}%`;
        } else {
            const confidence = box.querySelector('.detection-confidence');
            if (confidence) confidence.remove();
        }

        // Update 3D indicator
        if (options.show3DIndicator && detection.position_3d && 
            Array.isArray(detection.position_3d) && 
            !detection.position_3d.every(v => v === 0)) {
            
            let indicator = box.querySelector('.detection-3d-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'detection-3d-indicator';
                box.appendChild(indicator);
            }
            
            const [x, y, z] = detection.position_3d;
            indicator.title = `3D: X=${x.toFixed(1)}, Y=${y.toFixed(1)}, Z=${z.toFixed(1)}m`;
        } else {
            const indicator = box.querySelector('.detection-3d-indicator');
            if (indicator) indicator.remove();
        }

        // Store detection data
        box.dataset.detectionId = detection.id;
        box.dataset.class = detection.class_name || detection.label;
    }

    /**
     * Get a box element from the pool or create a new one
     * @returns {HTMLElement}
     */
    getBoxFromPool() {
        if (this.boxPool.length > 0) {
            const box = this.boxPool.pop();
            box.className = 'detection-box';
            box.innerHTML = '';
            return box;
        }

        const box = document.createElement('div');
        box.className = 'detection-box';
        return box;
    }

    /**
     * Remove a box and return it to the pool
     */
    removeBox(id, box) {
        // Add removal animation
        box.classList.add('removing');
        
        setTimeout(() => {
            if (box.parentNode) {
                box.parentNode.removeChild(box);
            }
            
            // Clean up and return to pool
            box.className = 'detection-box';
            box.innerHTML = '';
            box.style = '';
            this.boxPool.push(box);
            
            this.activeBoxes.delete(id);
        }, this.animationDuration);
    }

    /**
     * Get color for a detection class
     * @param {string} className
     * @returns {string} Color hex code
     */
    getColorForClass(className) {
        if (!className) return this.defaultColors.default;

        // Check cache
        if (this.colorMap.has(className)) {
            return this.colorMap.get(className);
        }

        // Use default color or generate one
        const color = this.defaultColors[className.toLowerCase()] || 
                     this.generateColorForClass(className);
        
        this.colorMap.set(className, color);
        return color;
    }

    /**
     * Generate a consistent color for a class name
     */
    generateColorForClass(className) {
        // Generate color from hash of class name
        let hash = 0;
        for (let i = 0; i < className.length; i++) {
            hash = className.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 50%)`;
    }

    /**
     * Generate ID for detection without trackId
     */
    generateId(detection) {
        const bbox = detection.bbox.join(',');
        const label = detection.label || detection.class_name || 'unknown';
        return `${label}_${bbox}`;
    }

    /**
     * Clear all bounding boxes
     */
    clear() {
        // Remove all active boxes
        for (const [id, box] of this.activeBoxes) {
            if (box.parentNode) {
                box.parentNode.removeChild(box);
            }
            // Return to pool
            box.className = 'detection-box';
            box.innerHTML = '';
            box.style = '';
            this.boxPool.push(box);
        }
        
        this.activeBoxes.clear();
    }

    /**
     * Update rendering options
     * @param {Object} options
     */
    updateOptions(options) {
        if (options.animationDuration !== undefined) {
            this.animationDuration = options.animationDuration;
        }
        
        if (options.colors) {
            Object.assign(this.defaultColors, options.colors);
            // Clear color cache to apply new colors
            this.colorMap.clear();
        }
    }

    /**
     * Get statistics
     * @returns {Object}
     */
    getStats() {
        return {
            activeBoxes: this.activeBoxes.size,
            pooledBoxes: this.boxPool.length,
            totalBoxes: this.activeBoxes.size + this.boxPool.length
        };
    }
}

// Export for use in other modules
export default BoundingBoxRenderer;