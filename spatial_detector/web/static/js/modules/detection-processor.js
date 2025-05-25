/**
 * DetectionProcessor - Handles validation and processing of detection results
 * 
 * Features:
 * - Detection validation and filtering
 * - Performance metrics calculation
 * - Detection tracking and deduplication
 * - Confidence-based filtering
 */
class DetectionProcessor {
    constructor(options = {}) {
        this.minConfidence = options.minConfidence || 0.5;
        this.maxAge = options.maxAge || 500; // Max age for tracking (ms)
        this.mergeThreshold = options.mergeThreshold || 50; // Pixel distance for merging
        this.validClasses = options.validClasses || null; // null = all classes valid
        
        // Tracking state
        this.trackedDetections = new Map();
        this.detectionId = 0;
        
        // Performance metrics
        this.metrics = {
            totalProcessed: 0,
            validDetections: 0,
            invalidDetections: 0,
            averageConfidence: 0,
            processingTime: 0
        };
    }

    /**
     * Process a batch of detection results
     * @param {Array} detections - Raw detection results
     * @returns {Object} Processed results with metrics
     */
    processResults(detections) {
        const startTime = performance.now();
        
        if (!Array.isArray(detections)) {
            console.warn('Invalid detections format: expected array');
            return { detections: [], metrics: this.metrics };
        }

        // Validate and filter detections
        const validDetections = detections
            .map(detection => this.validateDetection(detection))
            .filter(detection => detection !== null);

        // Apply confidence filtering
        const confidentDetections = validDetections.filter(
            detection => detection.confidence >= this.minConfidence
        );

        // Apply class filtering if specified
        const filteredDetections = this.validClasses
            ? confidentDetections.filter(d => this.validClasses.includes(d.class_name))
            : confidentDetections;

        // Track detections
        const trackedDetections = this.trackDetections(filteredDetections);

        // Update metrics
        this.updateMetrics(detections.length, trackedDetections.length, startTime);

        return {
            detections: trackedDetections,
            metrics: { ...this.metrics }
        };
    }

    /**
     * Validate a single detection
     * @param {Object} detection - Raw detection data
     * @returns {Object|null} Validated detection or null if invalid
     */
    validateDetection(detection) {
        if (!detection || typeof detection !== 'object') {
            return null;
        }

        // Check required fields
        const requiredFields = ['bbox', 'confidence'];
        for (const field of requiredFields) {
            if (!(field in detection)) {
                console.warn(`Detection missing required field: ${field}`);
                return null;
            }
        }

        // Validate bbox
        const bbox = detection.bbox;
        if (!Array.isArray(bbox) || bbox.length !== 4) {
            console.warn('Invalid bbox format');
            return null;
        }

        // Validate bbox values
        const [x1, y1, x2, y2] = bbox;
        if (x1 >= x2 || y1 >= y2) {
            console.warn('Invalid bbox dimensions');
            return null;
        }

        // Validate confidence
        const confidence = parseFloat(detection.confidence);
        if (isNaN(confidence) || confidence < 0 || confidence > 1) {
            console.warn('Invalid confidence value');
            return null;
        }

        // Validate 3D position if present
        if (detection.position_3d) {
            if (!Array.isArray(detection.position_3d) || detection.position_3d.length !== 3) {
                console.warn('Invalid position_3d format');
                detection.position_3d = null;
            } else if (detection.position_3d.some(v => isNaN(v) || !isFinite(v))) {
                console.warn('Invalid position_3d values');
                detection.position_3d = null;
            }
        }

        // Create validated detection object
        return {
            id: detection.id || `detection_${this.detectionId++}`,
            class_name: detection.class_name || detection.label || 'unknown',
            label: detection.label || detection.class_name || 'unknown',
            confidence: confidence,
            bbox: bbox.map(v => Math.round(v)),
            position_3d: detection.position_3d || null,
            timestamp: Date.now()
        };
    }

    /**
     * Track detections across frames
     * @param {Array} detections - Current frame detections
     * @returns {Array} Tracked detections with stable IDs
     */
    trackDetections(detections) {
        const currentTime = Date.now();
        const tracked = [];

        // Remove old tracked detections
        for (const [id, trackedDet] of this.trackedDetections) {
            if (currentTime - trackedDet.timestamp > this.maxAge) {
                this.trackedDetections.delete(id);
            }
        }

        // Match current detections to tracked ones
        for (const detection of detections) {
            const match = this.findMatchingDetection(detection);
            
            if (match) {
                // Update existing tracked detection
                match.bbox = detection.bbox;
                match.confidence = detection.confidence;
                match.position_3d = detection.position_3d;
                match.timestamp = currentTime;
                tracked.push(match);
            } else {
                // Add new tracked detection
                const trackedDetection = {
                    ...detection,
                    trackId: `track_${this.detectionId++}`,
                    firstSeen: currentTime,
                    timestamp: currentTime
                };
                this.trackedDetections.set(trackedDetection.trackId, trackedDetection);
                tracked.push(trackedDetection);
            }
        }

        return tracked;
    }

    /**
     * Find matching detection in tracked set
     * @param {Object} detection - Detection to match
     * @returns {Object|null} Matching tracked detection
     */
    findMatchingDetection(detection) {
        let bestMatch = null;
        let minDistance = this.mergeThreshold;

        const [x1, y1, x2, y2] = detection.bbox;
        const centerX = (x1 + x2) / 2;
        const centerY = (y1 + y2) / 2;

        for (const [id, tracked] of this.trackedDetections) {
            // Must be same class
            if (tracked.class_name !== detection.class_name) {
                continue;
            }

            // Calculate center distance
            const [tx1, ty1, tx2, ty2] = tracked.bbox;
            const tcenterX = (tx1 + tx2) / 2;
            const tcenterY = (ty1 + ty2) / 2;
            
            const distance = Math.sqrt(
                Math.pow(centerX - tcenterX, 2) + 
                Math.pow(centerY - tcenterY, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = tracked;
            }
        }

        return bestMatch;
    }

    /**
     * Calculate detection metrics
     * @param {Array} detections - Processed detections
     * @returns {Object} Detection metrics
     */
    calculateMetrics(detections) {
        if (!detections || detections.length === 0) {
            return {
                count: 0,
                averageConfidence: 0,
                classCounts: {},
                boundingBoxStats: {}
            };
        }

        const classCounts = {};
        let totalConfidence = 0;
        let totalArea = 0;

        for (const detection of detections) {
            // Count by class
            classCounts[detection.class_name] = (classCounts[detection.class_name] || 0) + 1;
            
            // Sum confidence
            totalConfidence += detection.confidence;
            
            // Calculate bbox area
            const [x1, y1, x2, y2] = detection.bbox;
            totalArea += (x2 - x1) * (y2 - y1);
        }

        return {
            count: detections.length,
            averageConfidence: totalConfidence / detections.length,
            classCounts: classCounts,
            boundingBoxStats: {
                averageArea: totalArea / detections.length,
                totalArea: totalArea
            }
        };
    }

    /**
     * Update internal metrics
     */
    updateMetrics(totalCount, validCount, startTime) {
        this.metrics.totalProcessed += totalCount;
        this.metrics.validDetections += validCount;
        this.metrics.invalidDetections += (totalCount - validCount);
        this.metrics.processingTime = performance.now() - startTime;
        
        if (this.metrics.validDetections > 0) {
            this.metrics.averageConfidence = 
                (this.metrics.averageConfidence * (this.metrics.validDetections - validCount) + 
                 validCount * this.minConfidence) / this.metrics.validDetections;
        }
    }

    /**
     * Reset tracking state
     */
    resetTracking() {
        this.trackedDetections.clear();
        this.detectionId = 0;
    }

    /**
     * Get current metrics
     * @returns {Object}
     */
    getMetrics() {
        return { ...this.metrics };
    }

    /**
     * Update configuration
     * @param {Object} config - New configuration
     */
    updateConfig(config) {
        if (config.minConfidence !== undefined) {
            this.minConfidence = config.minConfidence;
        }
        if (config.maxAge !== undefined) {
            this.maxAge = config.maxAge;
        }
        if (config.mergeThreshold !== undefined) {
            this.mergeThreshold = config.mergeThreshold;
        }
        if (config.validClasses !== undefined) {
            this.validClasses = config.validClasses;
        }
    }
}

// Export for use in other modules
export default DetectionProcessor;