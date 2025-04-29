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
        // Track which objects we've seen in this update
        const seenObjects = new Set();
        
        // Process each detection
        detections.forEach((detection, index) => {
            const id = `${detection.label}_${index}`;
            seenObjects.add(id);
            
            // Handle objects with no 3D position
            if (!detection.position_3d) return;
            
            // Get 3D position and create object if it doesn't exist
            const [x, y, z] = detection.position_3d;
            
            if (!this.objects.has(id)) {
                // Create new 3D object
                this.createObject(id, detection);
            }
            
            // Update existing object position and data
            const object = this.objects.get(id);
            object.position.set(x, y, z);
            
            // Update label if available
            if (object.userData.label) {
                object.userData.label.position.set(x, y + 0.5, z);
                object.userData.label.element.textContent = 
                    `${detection.label} (${(detection.confidence * 100).toFixed(0)}%)`;
            }
        });
        
        // Remove objects that weren't in this detection batch
        this.objects.forEach((object, id) => {
            if (!seenObjects.has(id)) {
                // Remove label if it exists
                if (object.userData.label) {
                    document.body.removeChild(object.userData.label.element);
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
        
        // Customize appearance based on object type
        switch (detection.label.toLowerCase()) {
            case 'person':
                size = 0.4;
                color = 0x3498db; // Blue
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
            // Add more object types as needed
        }
        
        // Create mesh for the object
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({ 
            color: color,
            roughness: 0.7,
            metalness: 0.3
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        // Position based on detection
        const [x, y, z] = detection.position_3d;
        mesh.position.set(x, y, z);
        
        // Add to scene and tracking map
        this.scene.add(mesh);
        this.objects.set(id, mesh);
        
        // Add HTML label
        const labelDiv = document.createElement('div');
        labelDiv.className = 'map-object-label';
        labelDiv.textContent = `${detection.label} (${(detection.confidence * 100).toFixed(0)}%)`;
        labelDiv.style.position = 'absolute';
        labelDiv.style.backgroundColor = 'rgba(0,0,0,0.7)';
        labelDiv.style.color = 'white';
        labelDiv.style.padding = '2px 5px';
        labelDiv.style.borderRadius = '3px';
        labelDiv.style.fontSize = '12px';
        labelDiv.style.pointerEvents = 'none';
        labelDiv.style.transform = 'translate(-50%, -100%)';
        document.body.appendChild(labelDiv);
        
        const label = new THREE.Object3D();
        label.position.set(x, y + 0.5, z);
        label.element = labelDiv;
        this.scene.add(label);
        
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