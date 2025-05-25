# Spatial Detector Refactoring Plan

## Overview
This document outlines a comprehensive refactoring plan to improve performance, maintainability, and code organization for the Spatial Detector web application.

## Current Issues

### 1. Performance Bottlenecks
- **Frame Processing**: Base64 encoding on every frame (20 FPS) creates overhead
- **DOM Manipulation**: Creating new elements on every detection update
- **Memory Leaks**: Canvas elements created but not properly disposed
- **Redundant Processing**: Multiple identical operations across modules

### 2. Code Organization
- **Monolithic Files**: main.js is 700+ lines handling multiple concerns
- **Tight Coupling**: Direct dependencies between modules
- **Code Duplication**: Similar logic in multiple files
- **Poor Separation**: UI logic mixed with business logic

### 3. Maintainability
- **Limited Error Handling**: Many operations lack proper error boundaries
- **Missing Documentation**: No JSDoc comments for complex functions
- **Inconsistent Patterns**: Different approaches for similar operations
- **Global State**: Excessive use of global variables

## Refactoring Strategy

### Phase 1: Modularization (Priority: High)

#### 1.1 Create Core Modules

**ConnectionManager** (`connection-manager.js`)
```javascript
// Handles all WebSocket communication
class ConnectionManager extends EventTarget {
    constructor(url) {
        super();
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }
    
    connect() { /* Establish connection with retry logic */ }
    disconnect() { /* Clean disconnect */ }
    emit(event, data) { /* Send with error handling */ }
    on(event, callback) { /* Register event listeners */ }
}
```

**DetectionProcessor** (`detection-processor.js`)
```javascript
// Processes detection results with validation and filtering
class DetectionProcessor {
    constructor(options = {}) {
        this.minConfidence = options.minConfidence || 0.5;
        this.validationRules = options.validationRules || {};
    }
    
    validateDetection(detection) { /* Validate detection data */ }
    processResults(results) { /* Process and filter results */ }
    calculateMetrics(detections) { /* Calculate performance metrics */ }
}
```

**UIManager** (`ui-manager.js`)
```javascript
// Centralizes all UI updates
class UIManager {
    constructor() {
        this.elements = new Map();
        this.updateQueue = [];
        this.rafId = null;
    }
    
    registerElement(id, element) { /* Cache DOM elements */ }
    queueUpdate(updateFn) { /* Batch DOM updates */ }
    showStatus(type, message) { /* Unified status messages */ }
}
```

#### 1.2 Refactor Existing Modules

**CameraManager** improvements:
- Remove frame capture logic to separate module
- Implement proper stream lifecycle management
- Add device change detection

**MapView** improvements:
- Implement object pooling for 3D objects
- Optimize label updates with dirty checking
- Add level-of-detail (LOD) for distant objects

### Phase 2: Performance Optimization (Priority: High)

#### 2.1 Frame Processing Pipeline

**VideoEncoder** (`video-encoder.js`)
```javascript
// Efficient frame encoding using WebCodecs API or OffscreenCanvas
class VideoEncoder {
    constructor(options = {}) {
        this.encoder = null;
        this.useWebCodecs = 'VideoEncoder' in window;
    }
    
    async encodeFrame(videoElement) {
        if (this.useWebCodecs) {
            // Use native encoding
        } else {
            // Fallback to optimized canvas approach
        }
    }
}
```

#### 2.2 Detection Rendering

**BoundingBoxRenderer** (`bbox-renderer.js`)
```javascript
// Efficient bounding box rendering with object pooling
class BoundingBoxRenderer {
    constructor(container) {
        this.container = container;
        this.boxPool = [];
        this.activeBoxes = new Map();
    }
    
    render(detections) {
        // Reuse existing DOM elements
        // Only update changed properties
    }
}
```

### Phase 3: State Management (Priority: Medium)

#### 3.1 Application State

**AppState** (`app-state.js`)
```javascript
// Centralized state management
class AppState extends EventTarget {
    constructor() {
        super();
        this.state = {
            camera: { active: false, deviceId: null },
            detection: { enabled: true, results: [] },
            map: { visible: false, objects: new Map() },
            calibration: { active: false, data: null }
        };
    }
    
    update(path, value) { /* Immutable state updates */ }
    subscribe(path, callback) { /* Reactive subscriptions */ }
}
```

### Phase 4: Error Handling & Logging (Priority: Medium)

#### 4.1 Error Boundary System

**ErrorHandler** (`error-handler.js`)
```javascript
// Centralized error handling
class ErrorHandler {
    constructor(options = {}) {
        this.logLevel = options.logLevel || 'error';
        this.handlers = new Map();
    }
    
    register(errorType, handler) { /* Register error handlers */ }
    handle(error, context) { /* Process errors with context */ }
    report(error) { /* Send error reports */ }
}
```

### Phase 5: Testing & Documentation (Priority: High)

#### 5.1 Unit Tests
- Test each module in isolation
- Mock dependencies
- Test error scenarios

#### 5.2 Integration Tests
- Test module interactions
- Test real-time performance
- Test error recovery

#### 5.3 Documentation
- Add JSDoc comments to all public methods
- Create API documentation
- Add inline comments for complex logic

## Implementation Timeline

### Week 1: Foundation
- [ ] Create module structure
- [ ] Implement ConnectionManager
- [ ] Implement UIManager
- [ ] Write unit tests

### Week 2: Core Refactoring
- [ ] Refactor camera.js
- [ ] Refactor main.js into modules
- [ ] Implement DetectionProcessor
- [ ] Integration testing

### Week 3: Performance
- [ ] Implement VideoEncoder
- [ ] Optimize MapView
- [ ] Implement object pooling
- [ ] Performance testing

### Week 4: Polish
- [ ] Error handling improvements
- [ ] Documentation
- [ ] Final testing
- [ ] Deployment preparation

## Performance Targets

- **Frame Processing**: < 10ms per frame
- **Detection Rendering**: < 5ms per update
- **3D Map Updates**: Maintain 60 FPS
- **Memory Usage**: < 100MB baseline
- **Network Bandwidth**: < 1 Mbps for video stream

## Testing Strategy

1. **Unit Tests**: 80% code coverage minimum
2. **Integration Tests**: All module interactions
3. **Performance Tests**: Automated benchmarks
4. **E2E Tests**: Critical user flows
5. **Load Tests**: Multiple concurrent users

## Migration Strategy

1. **Parallel Development**: Keep existing code functional
2. **Feature Flags**: Toggle between old and new implementations
3. **Gradual Rollout**: Module by module migration
4. **Rollback Plan**: Quick revert capability

## Success Metrics

- 50% reduction in frame processing time
- 75% reduction in memory usage
- 90% reduction in DOM operations
- Zero memory leaks
- 100% error handling coverage