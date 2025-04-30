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
        
        // Setup camera
        const aspectRatio = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 1000);
        this.camera.position.set(0, 3, 5);
        this.camera.lookAt(0, 0, 0);
        
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
        const groundGeometry = new THREE.PlaneGeometry(20, 20);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xeeeeee,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.DoubleSide
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = -0.01; // Slightly below to avoid z-fighting with grid
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
    }
    
    /**
     * Add grid for reference
     */
    addGrid() {
        this.grid = new THREE.GridHelper(20, 20, 0x888888, 0xcccccc);
        this.grid.material.opacity = 0.5;
        this.grid.material.transparent = true;
        this.scene.add(this.grid);
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
        window.addEventListener('resize', () => {
            // Update renderer and camera only if container size has changed
            if (this.container.clientWidth > 0 && this.container.clientHeight > 0) {
                this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
            }
        });
    }
    
    /**
     * Reset camera view to default position
     */
    resetView() {
        this.camera.position.set(0, 3, 5);
        this.camera.lookAt(0, 0, 0);
        this.controls.reset();
    }
    
    /**
     * Update objects based on detection results
     */
    updateObjects(detections) {
        // Debugging
        console.log('Updating 3D map with detections:', detections);
        if (!Array.isArray(detections) || detections.length === 0) {
            return; // Nothing to update
        }
        
        // Track which objects we've seen in this update
        const seenObjects = new Set();
        
        // Process each detection
        detections.forEach((detection, index) => {
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
            
            // Extract 3D position
            const [x, y, z] = pos3d;
            
            // Skip if position is invalid
            if (isNaN(x) || isNaN(y) || isNaN(z)) {
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
                // Scale the position to make it more visible in the scene
                // Invert Z axis to make objects that are further away appear further in the map
                object.position.set(x, y, -z);
                
                // Update label if available
                if (object.userData.label) {
                    object.userData.label.position.set(x, y + 0.5, -z);
                    object.userData.label.element.textContent = 
                        `${detection.label} (${z.toFixed(1)}m)`;
                }
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
        // Determine object size based on detection type
        let size = 0.2;
        let color = 0xff0000; // Default red
        let shape = 'box'; // Default shape
        
        // Get label safely
        const label = detection.label?.toLowerCase() || 'unknown';
        
        // Customize appearance based on object type
        switch (label) {
            case 'person':
                size = 0.4;
                color = 0x3498db; // Blue
                shape = 'cylinder';
                break;
            case 'car':
            case 'truck':
            case 'bus':
                size = 0.5;
                color = 0xe74c3c; // Red
                break;
            case 'chair':
            case 'bench':
                size = 0.3;
                color = 0x2ecc71; // Green
                break;
            case 'dog':
            case 'cat':
                size = 0.25;
                color = 0xf39c12; // Yellow/Orange
                shape = 'sphere';
                break;
            // Add more object types as needed
            default:
                // Generate consistent color based on label
                const labelHash = label.split('').reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 0xffffff, 0);
                color = labelHash;
        }
        
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
        
        // Position based on detection - note we invert Z
        const [x, y, z] = detection.position_3d;
        mesh.position.set(x, y, -z);
        
        // Add to scene and tracking map
        this.scene.add(mesh);
        this.objects.set(id, mesh);
        
        // Add HTML label
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
        document.body.appendChild(labelDiv);
        
        // Create 3D object for label positioning
        const label = new THREE.Object3D();
        label.position.set(x, y + 0.5, -z);
        label.element = labelDiv;
        this.scene.add(label);
        
        // Store the label with the mesh
        mesh.userData.label = label;
        
        return mesh;
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