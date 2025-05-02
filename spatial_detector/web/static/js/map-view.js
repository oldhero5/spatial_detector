/**
 * 3D Map Visualization using Three.js
 */

class MapView {
    constructor(containerId) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.objects = new Map(); // Map of object IDs to their 3D representations
        this.showGrid = true;
        
        this.initThreeJs();
        this.setupEvents();
        this.animate();
    }
    
    /**
     * Initialize Three.js scene, camera, renderer
     */
    initThreeJs() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Setup camera - Positioned to look down at the scene at an angle
        const aspectRatio = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
        
        // Position camera for better view of the objects
        // In our coordinate system, Y is up, Z is forward/back, X is left/right
        // Position adjusted for the 5.0 scale factor
        this.camera.position.set(5, 10, 15);  // Closer camera position for 5x scale
        this.camera.lookAt(0, 2, 0);  // Look at a point closer to the ground plane
        
        console.log("Camera initialized at position:", this.camera.position);
        
        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        
        // Add orbit controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.dampingFactor = 0.25;
        this.controls.enableDamping = true;
        
        // Add lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        directionalLight.castShadow = true;
        
        // Set shadow properties for better quality
        directionalLight.shadow.mapSize.width = 1024;
        directionalLight.shadow.mapSize.height = 1024;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        this.scene.add(directionalLight);
        
        // Add ground and grid
        this.addGround();
        this.addGrid();
    }
    
    /**
     * Add ground plane
     */
    addGround() {
        // Create a larger ground plane for better visibility
        const groundGeometry = new THREE.PlaneGeometry(30, 30);
        
        // Use a checkerboard pattern for better depth perception
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xcccccc,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.DoubleSide
        });
        
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        
        // Rotate to be horizontal (in Three.js Y-up coordinate system)
        this.ground.rotation.x = -Math.PI / 2;
        
        // Position at origin
        this.ground.position.y = -0.01; // Slightly below to avoid z-fighting with grid
        this.ground.receiveShadow = true;
        
        // Add to scene
        this.scene.add(this.ground);
        
        // Add a colored marker at the origin (camera location)
        const originGeometry = new THREE.SphereGeometry(0.1, 16, 16);
        const originMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const originMarker = new THREE.Mesh(originGeometry, originMaterial);
        originMarker.position.set(0, 0, 0);
        this.scene.add(originMarker);
        
        console.log("Ground plane and origin marker added to scene");
    }
    
    /**
     * Add grid for reference
     */
    addGrid() {
        // Create a larger grid to match the ground plane
        this.grid = new THREE.GridHelper(30, 30, 0x888888, 0xcccccc);
        
        // Make the grid more visible but semi-transparent
        this.grid.material.opacity = 0.7;
        this.grid.material.transparent = true;
        
        // Add grid to scene
        this.scene.add(this.grid);
        
        // Add axis helpers for orientation
        const axisHelper = new THREE.AxesHelper(3);
        this.scene.add(axisHelper);
        
        console.log("Grid and axis helpers added to scene");
    }
    
    /**
     * Toggle grid visibility
     */
    toggleGrid(visible) {
        this.showGrid = visible;
        this.grid.visible = visible;
    }
    
    /**
     * Setup window resize and other events
     */
    setupEvents() {
        // Store the resize handler as a property so we can remove it later
        this.resizeListener = () => {
            // Update renderer and camera only if container size has changed
            if (this.container.clientWidth > 0 && this.container.clientHeight > 0) {
                this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
                console.log("Map view resized successfully");
            }
        };
        
        window.addEventListener('resize', this.resizeListener);
    }
    
    /**
     * Reset camera view to default position
     */
    resetView() {
        // Use the same camera position as in initialization
        this.camera.position.set(5, 10, 15);  // Match the initialization position
        this.camera.lookAt(0, 2, 0);  // Match the initialization look target
        this.controls.reset();
        console.log("Camera view reset to default position");
    }
    
    /**
     * Update objects based on detection results
     */
    updateObjects(detections) {
        // Debugging
        console.log('Updating 3D map with detections:', detections);
        if (!Array.isArray(detections) || detections.length === 0) {
            console.log("No valid detections to update map with");
            return; // Nothing to update
        }
        
        // Check if container is visible
        if (this.container.offsetParent === null) {
            console.log("Map container not visible, skipping update");
            return; // Container not visible, skip update
        }
        
        // Track which objects we've seen in this update
        const seenObjects = new Set();
        
        // Process each detection
        detections.forEach((detection, index) => {
            try {
                // Skip if missing critical data
                if (!detection.label) {
                    console.warn('Detection missing label:', detection);
                    return;
                }
                
                const id = `${detection.label}_${index}`;
                seenObjects.add(id);
                
                // Handle objects with no 3D position
                const pos3d = detection.position_3d;
                if (!pos3d || !Array.isArray(pos3d) || pos3d.length < 3) {
                    console.warn('Detection missing valid position_3d:', detection);
                    return;
                }
                
                // Extract 3D position and validate
                let [x, y, z] = pos3d;
                
                // Convert to numbers and check validity - force to number type
                x = Number(x);
                y = Number(y);
                z = Number(z);
                
                // Add debug logging
                console.log(`Map-view object position: x=${x}, y=${y}, z=${z}, typeof x=${typeof x}`);
                
                // Skip if position is invalid or all zeros (default fallback value)
                if (isNaN(x) || isNaN(y) || isNaN(z) || 
                    (x === 0 && y === 0 && z === 0)) {
                    console.warn('Detection has invalid position coordinates:', pos3d);
                    return;
                }
                
                // Create new 3D object if it doesn't exist
                if (!this.objects.has(id)) {
                    this.createObject(id, detection);
                }
                
                // Update existing object position and data
                const object = this.objects.get(id);
                if (object) {
                    // Apply the same coordinate transformation used in createObject
                    // Scale factors adjusted for real-world positioning
                    // Use the same scaling as in createObject
                    const scaleX = 5.0; // Scale X coordinate
                    const scaleY = 5.0; // Scale Y (height) coordinate
                    const scaleZ = 5.0; // Scale Z (depth) coordinate
                    
                    // Use the same real-world coordinate mapping as in createObject
                    const posX = x * scaleX;
                    const posY = y * scaleY; // Y is already up in world space
                    const posZ = -z * scaleZ; // Negate Z to match Three.js conventions
                    
                    // Apply the same baseline offset
                    const baselineY = 0.5;
                    const finalPosY = posY + baselineY;
                    
                    console.log(`Updating object ${id} position to: x=${posX}, y=${finalPosY} (with offset), z=${posZ}`);
                    object.position.set(posX, finalPosY, posZ);
                    
                    // Update label if available
                    if (object.userData.label) {
                        // Position label above the object (using finalPosY)
                        const labelOffset = 1.0; // Raise label above object
                        object.userData.label.position.set(posX, finalPosY + labelOffset, posZ);
                        object.userData.label.element.textContent = 
                            `${detection.label} (${z.toFixed(1)}m)`;
                    }
                }
            } catch (error) {
                console.error('Error processing detection:', error, detection);
            }
        });
        
        // Remove objects that weren't in this detection batch
        this.objects.forEach((object, id) => {
            if (!seenObjects.has(id)) {
                // Remove label if it exists
                if (object.userData.label) {
                    if (document.body.contains(object.userData.label.element)) {
                        document.body.removeChild(object.userData.label.element);
                    }
                    this.scene.remove(object.userData.label);
                }
                
                // Remove object from scene
                this.scene.remove(object);
                this.objects.delete(id);
            }
        });
    }
    
    /**
     * Create a new 3D object for visualization
     */
    createObject(id, detection) {
        console.log(`Creating 3D object for ${id}:`, detection);
        
        // Determine object size based on detection type
        // Increase the default size for better visibility
        let size = 0.4; // Larger default size
        let color = 0xff0000; // Default red
        let shape = 'box'; // Default shape
        
        // Get label safely
        const label = detection.label?.toLowerCase() || 'unknown';
        
        // Customize appearance based on object type
        switch (label) {
            case 'person':
                size = 1.2; // Larger person size
                color = 0x3498db; // Blue
                shape = 'cylinder';
                break;
            case 'car':
            case 'truck':
            case 'bus':
                size = 0.8; // Larger vehicle size
                color = 0xe74c3c; // Red
                break;
            case 'chair':
            case 'bench':
                size = 0.5; // Larger furniture size
                color = 0x2ecc71; // Green
                break;
            case 'dog':
            case 'cat':
                size = 0.4; // Larger animal size
                color = 0xf39c12; // Yellow/Orange
                shape = 'sphere';
                break;
            // Add more object types as needed
            default:
                // Generate consistent color based on label
                try {
                    const labelHash = label.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 0xffffff, 0);
                    color = labelHash;
                } catch (error) {
                    console.error("Error generating color from label:", error);
                    color = 0xff0000; // Default red
                }
        }
        
        try {
            // Create geometry based on shape
            let geometry;
            switch (shape) {
                case 'cylinder':
                    geometry = new THREE.CylinderGeometry(size/2, size/2, size*2, 8);
                    break;
                case 'sphere':
                    geometry = new THREE.SphereGeometry(size/1.5, 16, 16);
                    break;
                case 'box':
                default:
                    geometry = new THREE.BoxGeometry(size, size, size);
            }
            
            // Create material with some glow effect
            const material = new THREE.MeshStandardMaterial({ 
                color: color,
                roughness: 0.7,
                metalness: 0.3,
                emissive: color,
                emissiveIntensity: 0.2
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            // Validate position_3d
            if (!detection.position_3d || !Array.isArray(detection.position_3d) || detection.position_3d.length < 3) {
                console.error(`Invalid position_3d for detection ${id}:`, detection.position_3d);
                return null;
            }
            
            // Convert positions to numbers and validate
            let x = Number(detection.position_3d[0]);
            let y = Number(detection.position_3d[1]);
            let z = Number(detection.position_3d[2]);
            
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
                console.error(`Invalid position values for detection ${id}: x=${x}, y=${y}, z=${z}`);
                return null;
            }
            
            // Apply position with coordinate system adjustment
            // IMPORTANT: In Three.js, Y is up, while in computer vision, typically Y is down and Z is depth
            // Adjust the coordinate system for proper visualization
            console.log(`Original position for ${id}: x=${x}, y=${y}, z=${z}`);
            
            // Scale factors adjusted for real-world positioning
            // Smaller scale factors for more realistic placement
            // These match the depth_scale=5.0 in the camera model
            const scaleX = 5.0; // Scale X coordinate 
            const scaleY = 5.0; // Scale Y (height) coordinate
            const scaleZ = 5.0; // Scale Z (depth) coordinate
            
            // Real-world coordinate mapping for detected objects
            // 
            // The camera model produces 3D coordinates where:
            // - X is left-right in world space (+ is right from camera's perspective)
            // - Y is up-down in world space (+ is up from camera's perspective)
            // - Z is depth from camera (+ is away from camera)
            //
            // In Three.js, the standard coordinate system is:
            // - X is left-right (+ is right)
            // - Y is up-down (+ is up)
            // - Z is forward-backward (+ is toward viewer, - is away)
            //
            // Therefore, to map from camera coordinates to Three.js:
            // - X remains the same (left-right)
            // - Y remains the same (up-down)
            // - Z needs to be negated (depth away from camera becomes -Z in Three.js)
            
            // Scale coordinates for better visualization
            const posX = x * scaleX; 
            const posY = y * scaleY; // Y is already up in world space from camera model
            const posZ = -z * scaleZ; // Negate Z to match Three.js conventions
            
            // Add a small baseline offset just to ensure objects aren't under the grid
            const baselineY = 0.5;
            
            // Apply the baseline Y offset to lift objects above the ground
            const finalPosY = posY + baselineY;
            
            console.log(`Adjusted position for ${id}: x=${posX}, y=${finalPosY} (with offset), z=${posZ}`);
            mesh.position.set(posX, finalPosY, posZ);
            console.log(`Object position after set: x=${mesh.position.x}, y=${mesh.position.y}, z=${mesh.position.z}`);
            
            // Add to scene and tracking map
            this.scene.add(mesh);
            this.objects.set(id, mesh);
            
            // Add HTML label with error handling
            try {
                const labelDiv = document.createElement('div');
                labelDiv.className = 'map-object-label';
                labelDiv.textContent = `${detection.label} (${z.toFixed(1)}m)`;
                labelDiv.style.position = 'absolute';
                labelDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
                labelDiv.style.color = 'white';
                labelDiv.style.padding = '4px 8px';
                labelDiv.style.borderRadius = '4px';
                labelDiv.style.fontSize = '12px';
                labelDiv.style.fontWeight = 'bold';
                labelDiv.style.pointerEvents = 'none';
                labelDiv.style.transform = 'translate(-50%, -100%)';
                
                // Check if container exists
                const container = document.getElementById(this.containerId);
                if (container) {
                    // Append to map container instead of body to fix positioning issues
                    container.appendChild(labelDiv);
                } else {
                    // Fallback to body if container not found
                    document.body.appendChild(labelDiv);
                }
                
                // Create 3D object for label positioning using the same coordinate transformation
                const label = new THREE.Object3D();
                
                // Position label above the object using the final position with offset
                const labelPosX = posX;
                const labelOffset = 1.0; // Raise label above object
                const labelPosY = finalPosY + labelOffset; // Use finalPosY plus additional offset for label
                const labelPosZ = posZ;
                
                label.position.set(labelPosX, labelPosY, labelPosZ);
                label.element = labelDiv;
                this.scene.add(label);
                
                // Store the label with the mesh
                mesh.userData.label = label;
                
                console.log(`Created 3D object for ${id} with label:`, labelDiv.textContent);
            } catch (labelError) {
                console.error(`Error creating label for ${id}:`, labelError);
                // Still return the mesh even if label creation fails
            }
            
            return mesh;
        } catch (error) {
            console.error(`Error creating 3D object for ${id}:`, error);
            return null;
        }
    }
    
    /**
     * Update label positions based on camera view
     */
    updateLabels() {
        // Convert 3D positions to screen coordinates
        const tempV = new THREE.Vector3();
        
        this.objects.forEach(object => {
            if (object.userData.label) {
                const label = object.userData.label;
                
                // Get screen position for label
                tempV.copy(label.position);
                tempV.project(this.camera);
                
                // Convert to screen coordinates
                const x = (tempV.x * 0.5 + 0.5) * this.container.clientWidth;
                const y = (tempV.y * -0.5 + 0.5) * this.container.clientHeight;
                
                // Update label position
                label.element.style.left = `${x}px`;
                label.element.style.top = `${y}px`;
                
                // Hide label if behind camera
                label.element.style.display = tempV.z > 1 ? 'none' : 'block';
            }
        });
    }
    
    /**
     * Animation loop
     */
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Update controls
        this.controls.update();
        
        // Update label positions
        this.updateLabels();
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Add a test object to verify the scene is rendering correctly
     */
    addTestObject() {
        try {
            // Create test objects at different positions for visibility testing
            
            // A red sphere at (5, 2, 0) - right side
            const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);
            const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            sphere.position.set(5, 2, 0);
            this.scene.add(sphere);
            
            // A blue cube at (-5, 2, 0) - left side
            const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
            const cubeMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
            const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
            cube.position.set(-5, 2, 0);
            this.scene.add(cube);
            
            // A green cylinder at (0, 2, 5) - back from camera
            const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
            const cylinderMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
            cylinder.position.set(0, 2, -5);  // Negative Z is away from camera
            this.scene.add(cylinder);
            
            // A magenta cube at origin for reference
            const originCubeGeometry = new THREE.BoxGeometry(1, 1, 1);
            const originCubeMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff });
            const originCube = new THREE.Mesh(originCubeGeometry, originCubeMaterial);
            originCube.position.set(0, 2, 0);
            this.scene.add(originCube);
            
            console.log("Added test objects to scene at various positions");
            return true;
        } catch (error) {
            console.error("Error adding test objects:", error);
            return false;
        }
    }
    
    /**
     * Export 3D model (placeholder)
     */
    exportModel() {
        console.log('Export 3D model functionality not yet implemented');
        alert('Export 3D model functionality not yet implemented');
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        // Remove event listeners
        window.removeEventListener('resize', this.resizeListener);
        
        // Remove labels
        this.objects.forEach(object => {
            if (object.userData.label) {
                document.body.removeChild(object.userData.label.element);
            }
        });
        
        // Remove renderer
        if (this.renderer) {
            this.container.removeChild(this.renderer.domElement);
            this.renderer.dispose();
        }
    }
}