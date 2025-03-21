import numpy as np
import cv2
import math
import time

class SpatialMap:
    """
    Manages a spatial map of detected objects with tracking over time.
    """
    def __init__(self, room_dimensions=(5, 5), grid_size=0.1, persistence_time=5.0):
        """
        Initialize the spatial map.
        
        Args:
            room_dimensions: (width, height) of the mapped area in meters
            grid_size: Grid cell size in meters
            persistence_time: How long objects persist in the map (in seconds)
        """
        self.room_width, self.room_height = room_dimensions
        self.grid_size = grid_size
        self.persistence_time = persistence_time
        
        # Create grid dimensions
        self.grid_width = int(self.room_width / self.grid_size)
        self.grid_height = int(self.room_height / self.grid_size)
        
        # Dictionary to store tracked objects
        # Key: object ID, Value: {position, class, confidence, last_seen, color}
        self.tracked_objects = {}
        
        # Next object ID to assign
        self.next_object_id = 0
        
        # Map history for visualization (grid occupancy)
        self.occupancy_grid = np.zeros((self.grid_height, self.grid_width), dtype=np.uint8)
        
    def _world_to_grid(self, x, z):
        """
        Convert world coordinates to grid coordinates.
        
        Args:
            x, z: World coordinates (x is left-right, z is depth)
            
        Returns:
            grid_x, grid_y: Grid coordinates
        """
        # Center the coordinates in the grid
        world_x = x + self.room_width / 2
        world_z = z
        
        # Convert to grid coordinates
        grid_x = int(world_x / self.grid_size)
        grid_y = int(world_z / self.grid_size)
        
        # Clamp to grid boundaries
        grid_x = max(0, min(grid_x, self.grid_width - 1))
        grid_y = max(0, min(grid_y, self.grid_height - 1))
        
        return grid_x, grid_y
    
    def _grid_to_world(self, grid_x, grid_y):
        """
        Convert grid coordinates to world coordinates.
        
        Args:
            grid_x, grid_y: Grid coordinates
            
        Returns:
            x, z: World coordinates
        """
        world_x = (grid_x * self.grid_size) - self.room_width / 2
        world_z = grid_y * self.grid_size
        
        return world_x, world_z
        
    def update(self, detections, positions_3d):
        """
        Update the spatial map with new detections.
        
        Args:
            detections: List of detection dictionaries
            positions_3d: List of (X, Y, Z) positions corresponding to detections
        """
        current_time = time.time()
        
        # Remove old objects
        objects_to_remove = []
        for obj_id, obj_data in self.tracked_objects.items():
            if current_time - obj_data['last_seen'] > self.persistence_time:
                objects_to_remove.append(obj_id)
        
        for obj_id in objects_to_remove:
            del self.tracked_objects[obj_id]
        
        # Associate new detections with existing tracked objects
        assigned_detections = set()
        
        # For each tracked object, find closest detection
        for obj_id, obj_data in self.tracked_objects.items():
            best_match = None
            best_distance = float('inf')
            
            for i, (detection, position_3d) in enumerate(zip(detections, positions_3d)):
                if i in assigned_detections:
                    continue
                
                if detection['class_name'] != obj_data['class']:
                    continue
                
                # Calculate distance between tracked object and detection
                x1, y1, z1 = obj_data['position']
                x2, y2, z2 = position_3d
                
                # Focus on horizontal distance (x-z plane)
                distance = math.sqrt((x1 - x2)**2 + (z1 - z2)**2)
                
                if distance < best_distance and distance < 1.0:  # Max 1 meter association distance
                    best_match = i
                    best_distance = distance
            
            # Update tracked object with new position
            if best_match is not None:
                detection = detections[best_match]
                position_3d = positions_3d[best_match]
                
                # Update using exponential moving average
                alpha = 0.7  # Weight for new observation
                obj_data['position'] = [
                    alpha * position_3d[0] + (1 - alpha) * obj_data['position'][0],
                    alpha * position_3d[1] + (1 - alpha) * obj_data['position'][1],
                    alpha * position_3d[2] + (1 - alpha) * obj_data['position'][2]
                ]
                obj_data['confidence'] = detection['confidence']
                obj_data['last_seen'] = current_time
                assigned_detections.add(best_match)
        
        # Create new tracked objects for unassigned detections
        for i, (detection, position_3d) in enumerate(zip(detections, positions_3d)):
            if i in assigned_detections:
                continue
            
            # Only add objects with positive Z (depth)
            if position_3d[2] <= 0:
                continue
                
            # Create a unique color for this object
            color = tuple(np.random.randint(0, 255, 3).tolist())
            
            # Add new tracked object
            self.tracked_objects[self.next_object_id] = {
                'position': list(position_3d),
                'class': detection['class_name'],
                'confidence': detection['confidence'],
                'last_seen': current_time,
                'color': color
            }
            self.next_object_id += 1
        
        # Update occupancy grid
        self.update_occupancy_grid()
    
    def update_occupancy_grid(self):
        """Update the occupancy grid based on current object positions."""
        # Reset grid
        self.occupancy_grid = np.zeros((self.grid_height, self.grid_width), dtype=np.uint8)
        
        # Add objects to grid
        for obj_id, obj_data in self.tracked_objects.items():
            x, _, z = obj_data['position']
            grid_x, grid_y = self._world_to_grid(x, z)
            
            # Mark occupied cell with confidence level (0-255)
            confidence_level = int(obj_data['confidence'] * 255)
            self.occupancy_grid[grid_y, grid_x] = confidence_level
    
    def get_topdown_view(self, width=400, height=400, show_labels=True):
        """
        Generate a top-down view visualization of the spatial map.
        
        Args:
            width: Width of output image
            height: Height of output image
            show_labels: Whether to show object labels
            
        Returns:
            Image of top-down view
        """
        # Create white background
        map_img = np.ones((height, width, 3), dtype=np.uint8) * 255
        
        # Calculate scaling factors
        scale_x = width / self.grid_width
        scale_y = height / self.grid_height
        
        # Draw grid lines
        grid_step = int(1.0 / self.grid_size)  # Lines every 1 meter
        for i in range(0, self.grid_width + 1, grid_step):
            x = int(i * scale_x)
            cv2.line(map_img, (x, 0), (x, height), (200, 200, 200), 1)
            
        for i in range(0, self.grid_height + 1, grid_step):
            y = int(i * scale_y)
            cv2.line(map_img, (0, y), (width, y), (200, 200, 200), 1)
        
        # Draw coordinate system origin (center of room width)
        origin_x = int(width / 2)
        origin_y = 20  # Near the bottom
        cv2.circle(map_img, (origin_x, origin_y), 5, (0, 0, 0), -1)
        cv2.line(map_img, (origin_x, origin_y), (origin_x + 30, origin_y), (255, 0, 0), 2)  # X-axis (red)
        cv2.line(map_img, (origin_x, origin_y), (origin_x, origin_y - 30), (0, 0, 255), 2)  # Z-axis (blue)
        
        # Put camera field of view
        camera_fov = 60  # degrees
        fov_length = 100
        cv2.ellipse(map_img, 
                   (origin_x, origin_y),
                   (fov_length, fov_length),
                   -90,  # Start angle
                   -camera_fov/2,  # Start angle
                   camera_fov/2,  # End angle
                   (0, 200, 0),  # Green
                   1)
        
        # Draw tracked objects
        for obj_id, obj_data in self.tracked_objects.items():
            x, _, z = obj_data['position']
            grid_x, grid_y = self._world_to_grid(x, z)
            
            # Convert to image coordinates
            img_x = int(grid_x * scale_x)
            img_y = int(grid_y * scale_y)
            
            # Draw circle for object
            cv2.circle(map_img, (img_x, img_y), 5, obj_data['color'], -1)
            
            # Add label
            if show_labels:
                label = f"{obj_data['class']} ({obj_data['confidence']:.2f})"
                cv2.putText(map_img, label, (img_x + 5, img_y - 5), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
                
                # Add distance from camera
                distance = math.sqrt(sum([c**2 for c in obj_data['position']]))
                cv2.putText(map_img, f"{distance:.2f}m", (img_x + 5, img_y + 15), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.4, (0, 0, 0), 1)
        
        # Add legend and scale
        scale_length = int(scale_x * grid_step)  # 1 meter in pixels
        cv2.line(map_img, (width - scale_length - 10, height - 20), (width - 10, height - 20), (0, 0, 0), 2)
        cv2.putText(map_img, "1m", (width - scale_length // 2 - 10, height - 5), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
                
        return map_img