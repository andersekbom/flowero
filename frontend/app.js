/**
 * MQTT Message Visualizer Frontend
 * Handles WebSocket connections and real-time message animations
 */

class MQTTVisualizer {
    constructor() {
        this.websocket = null;
        this.isConnected = false;
        this.messageCount = 0;
        this.topicColors = new Map();
        this.activeTopics = new Set();
        this.messageRate = 0;
        this.lastMessageTime = Date.now();
        this.messageHistory = [];
        this.animationId = null;
        
        // Flower visualization state
        this.visualizationMode = 'bubbles';
        this.petals = [];
        this.currentAngle = 0;
        this.petalIdCounter = 0;

        // Initialize UI
        this.initializeEventListeners();
        this.startStatsUpdate();
    }

    initializeEventListeners() {
        // Enter key handlers
        document.getElementById('host').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.toggleConnection();
        });
        
        document.getElementById('topic').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.subscribeToTopic();
        });
    }

    // WebSocket Management
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = (event) => {
            console.log('WebSocket connected');
            this.updateConnectionStatus('connecting');
        };
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.websocket.onclose = (event) => {
            console.log('WebSocket disconnected');
            this.websocket = null;
            if (this.isConnected) {
                this.updateConnectionStatus('disconnected');
                this.isConnected = false;
            }
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('disconnected');
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'status':
                this.handleStatusUpdate(data.data);
                break;
            case 'mqtt_message':
                this.handleMQTTMessage(data.data);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    handleStatusUpdate(statusData) {
        const status = statusData.status;
        this.updateConnectionStatus(status);
        
        if (status === 'Connected') {
            this.isConnected = true;
            document.getElementById('subscribeBtn').disabled = false;
            document.getElementById('liveIndicator').style.display = 'flex';
        } else {
            this.isConnected = false;
            document.getElementById('subscribeBtn').disabled = true;
            document.getElementById('liveIndicator').style.display = 'none';
        }
    }

    handleMQTTMessage(messageData) {
        this.messageCount++;
        this.activeTopics.add(messageData.topic);
        
        // Update message history for rate calculation
        const now = Date.now();
        this.messageHistory.push(now);
        
        // Keep only last 60 seconds of messages for rate calculation
        this.messageHistory = this.messageHistory.filter(time => now - time <= 60000);
        this.messageRate = this.messageHistory.length / 60;
        
        // Create visualization based on mode
        if (this.visualizationMode === 'bubbles') {
            this.createMessageBubble(messageData);
        } else if (this.visualizationMode === 'flower') {
            this.createFlowerPetal(messageData);
        }
        
        // Update stats
        this.updateStats();
    }

    // Message Animation
    createMessageBubble(messageData) {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble message-enter';
        
        // Get or create color for topic
        const color = this.getTopicColor(messageData.topic);
        bubble.style.background = `linear-gradient(135deg, ${color}AA, ${color}DD)`;
        bubble.style.border = `2px solid ${color}`;
        
        // Create message content
        bubble.innerHTML = `
            <div class="message-topic">${messageData.topic}</div>
            <div class="message-payload">${this.formatPayload(messageData.payload)}</div>
            <div class="message-time">${this.formatTime(messageData.timestamp)}</div>
        `;
        
        // Random starting position (right side, with more variety in height)
        const flowArea = document.getElementById('messageFlow');
        const startX = flowArea.clientWidth + 50;
        const startY = Math.random() * (flowArea.clientHeight - 150) + 75;
        
        bubble.style.left = `${startX}px`;
        bubble.style.top = `${startY}px`;
        
        flowArea.appendChild(bubble);
        
        // Animate across screen with upward movement
        this.animateMessage(bubble);
        
        // Remove bubble after longer animation
        setTimeout(() => {
            if (bubble.parentNode) {
                bubble.classList.add('message-exit');
                setTimeout(() => bubble.remove(), 500);
            }
        }, 12000);
    }

    animateMessage(bubble) {
        const flowArea = document.getElementById('messageFlow');
        const startX = parseFloat(bubble.style.left);
        const startY = parseFloat(bubble.style.top);
        const targetX = -bubble.offsetWidth - 100;
        const duration = 12000; // 12 seconds to cross screen
        const startTime = Date.now();
        
        // Random upward drift
        const upwardDrift = -30 - (Math.random() * 40); // -30 to -70px upward movement
        const targetY = startY + upwardDrift;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function for smooth movement
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            const currentX = startX + (targetX - startX) * easeOutCubic;
            
            // Upward movement with gentle floating
            const upwardProgress = Math.pow(progress, 0.7); // Slower upward movement
            const currentY = startY + (targetY - startY) * upwardProgress;
            
            // Add gentle floating motion
            const floatY = Math.sin(progress * Math.PI * 3) * 8;
            
            bubble.style.left = `${currentX}px`;
            bubble.style.top = `${currentY + floatY}px`;
            
            // Add slight rotation for more dynamic feel
            const rotation = Math.sin(progress * Math.PI * 2) * 2;
            bubble.style.transform = `rotate(${rotation}deg)`;
            
            if (progress < 1 && bubble.parentNode) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    // Simple Circle Test - Step by Step Debugging
    createFlowerPetal(messageData) {
        const circleId = this.petalIdCounter++;
        
        console.log('Creating simple circle:', {
            id: circleId,
            topic: messageData.topic
        });
        
        // Get color based on topic
        const color = this.getTopicColor(messageData.topic);
        
        // Create simple circle element
        const circle = document.createElement('div');
        circle.className = 'test-circle';
        circle.id = `circle-${circleId}`;
        circle.style.position = 'absolute';
        circle.style.width = '20px';
        circle.style.height = '20px';
        circle.style.borderRadius = '50%';
        circle.style.backgroundColor = color;
        circle.style.border = '2px solid white';
        
        // Position circle at exact center of flower
        circle.style.left = '400px'; // Half of 800px container width
        circle.style.top = '400px';  // Half of 800px container height
        circle.style.transform = 'translate(-50%, -50%)'; // Center the circle on the point
        
        console.log('Circle positioning:', {
            id: circleId,
            left: circle.style.left,
            top: circle.style.top,
            transform: circle.style.transform,
            color: color
        });
        
        // Add to flower container
        const flowerContainer = document.getElementById('flowerContainer');
        console.log('Adding circle to container:', flowerContainer ? 'found' : 'NOT FOUND');
        flowerContainer.appendChild(circle);
        
        // Verify circle position after DOM insertion
        setTimeout(() => {
            const addedCircle = document.getElementById(`circle-${circleId}`);
            if (addedCircle) {
                const rect = addedCircle.getBoundingClientRect();
                const containerRect = flowerContainer.getBoundingClientRect();
                const centerRect = document.querySelector('.flower-center').getBoundingClientRect();
                
                console.log('Circle verification:', {
                    id: circleId,
                    actualStyles: {
                        left: addedCircle.style.left,
                        top: addedCircle.style.top,
                        transform: addedCircle.style.transform
                    },
                    circleBounds: {
                        x: rect.x,
                        y: rect.y,
                        centerX: rect.x + rect.width/2,
                        centerY: rect.y + rect.height/2
                    },
                    flowerCenterBounds: {
                        x: centerRect.x,
                        y: centerRect.y,
                        centerX: centerRect.x + centerRect.width/2,
                        centerY: centerRect.y + centerRect.height/2
                    },
                    alignment: {
                        xDiff: (rect.x + rect.width/2) - (centerRect.x + centerRect.width/2),
                        yDiff: (rect.y + rect.height/2) - (centerRect.y + centerRect.height/2)
                    }
                });
            }
        }, 100);
        
        // Store circle info
        this.petals.push({
            id: circleId,
            element: circle,
            color: color,
            topic: messageData.topic
        });
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            const circleElement = document.getElementById(`circle-${circleId}`);
            if (circleElement) {
                console.log('Removing circle:', circleId);
                circleElement.remove();
                this.petals = this.petals.filter(p => p.id !== circleId);
            }
        }, 5000);
    }

    // Visualization switching
    switchVisualization() {
        const mode = document.getElementById('visualizationMode').value;
        this.visualizationMode = mode;
        
        // Clear current visualizations
        this.clearAllVisualizations();
        
        // Show/hide appropriate containers
        const messageFlow = document.getElementById('messageFlow');
        const flowerVis = document.getElementById('flowerVisualization');
        
        if (mode === 'bubbles') {
            messageFlow.style.display = 'block';
            flowerVis.style.display = 'none';
        } else if (mode === 'flower') {
            messageFlow.style.display = 'none';
            flowerVis.style.display = 'flex';
        }
    }
    
    clearAllVisualizations() {
        console.log('Clearing all visualizations...');
        
        // Clear bubbles
        const bubbles = document.querySelectorAll('.message-bubble');
        console.log('Found', bubbles.length, 'bubbles to clear');
        bubbles.forEach(bubble => bubble.remove());
        
        // Clear petals and test circles
        const petals = document.querySelectorAll('.flower-petal');
        const circles = document.querySelectorAll('.test-circle');
        console.log('Found', petals.length, 'petals and', circles.length, 'circles to clear');
        
        petals.forEach((petal, index) => {
            console.log(`Removing petal ${index}:`, petal.id, petal.style.left, petal.style.top);
            petal.remove();
        });
        
        circles.forEach((circle, index) => {
            console.log(`Removing circle ${index}:`, circle.id, circle.style.left, circle.style.top);
            circle.remove();
        });
        
        // Also clear any orphaned elements in flower container
        const flowerContainer = document.getElementById('flowerContainer');
        if (flowerContainer) {
            const children = Array.from(flowerContainer.children);
            children.forEach((child, index) => {
                if (child.className !== 'flower-center') {
                    console.log(`Removing orphaned child ${index}:`, child.className, child.id);
                    child.remove();
                }
            });
        }
        
        this.petals = [];
        console.log('Clearing complete');
    }

    // Utility Functions
    getTopicColor(topic) {
        if (!this.topicColors.has(topic)) {
            const colors = [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
            ];
            const color = colors[this.topicColors.size % colors.length];
            this.topicColors.set(topic, color);
            this.updateTopicLegend();
        }
        return this.topicColors.get(topic);
    }

    formatPayload(payload) {
        if (payload.length > 100) {
            return payload.substring(0, 100) + '...';
        }
        return payload;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString();
    }

    // UI Updates
    updateConnectionStatus(status) {
        const statusEl = document.getElementById('status');
        const connectionStatusEl = document.getElementById('connectionStatus');
        const connectBtn = document.getElementById('connectBtn');
        
        statusEl.className = `status ${status.toLowerCase()}`;
        
        switch (status.toLowerCase()) {
            case 'connected':
                statusEl.textContent = '🟢 Connected';
                connectionStatusEl.textContent = 'Online';
                connectBtn.textContent = 'Disconnect';
                connectBtn.style.background = '#f44336';
                connectBtn.disabled = false;
                break;
            case 'connecting':
                statusEl.textContent = '🟡 Connecting...';
                connectionStatusEl.textContent = 'Connecting';
                connectBtn.disabled = true;
                break;
            case 'disconnected':
            default:
                statusEl.textContent = '🔴 Disconnected';
                connectionStatusEl.textContent = 'Offline';
                connectBtn.textContent = 'Connect';
                connectBtn.style.background = '#4CAF50';
                connectBtn.disabled = false;
                break;
        }
    }

    updateStats() {
        document.getElementById('totalMessages').textContent = this.messageCount;
        document.getElementById('messageRate').textContent = this.messageRate.toFixed(1);
        document.getElementById('activeTopics').textContent = this.activeTopics.size;
    }

    updateTopicLegend() {
        const topicList = document.getElementById('topicList');
        
        if (this.topicColors.size === 0) {
            topicList.innerHTML = '<div style="opacity: 0.6; font-size: 12px; margin-top: 10px;">No subscriptions yet</div>';
            return;
        }
        
        topicList.innerHTML = '';
        this.topicColors.forEach((color, topic) => {
            const item = document.createElement('div');
            item.className = 'topic-item';
            item.innerHTML = `
                <div class="topic-color" style="background-color: ${color}"></div>
                <span>${topic}</span>
            `;
            topicList.appendChild(item);
        });
    }

    startStatsUpdate() {
        setInterval(() => {
            this.updateStats();
        }, 1000);
    }

    // API Calls
    async apiCall(endpoint, method = 'GET', data = null) {
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        
        if (data) {
            config.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(`/api${endpoint}`, config);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.detail || 'API call failed');
            }
            
            return result;
        } catch (error) {
            console.error('API call error:', error);
            // Better error handling
            if (error.message) {
                throw new Error(error.message);
            }
            throw error;
        }
    }

    // Connection Management
    async toggleConnection() {
        if (this.isConnected) {
            await this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        const host = document.getElementById('host').value.trim();
        const port = parseInt(document.getElementById('port').value);
        const username = document.getElementById('username').value.trim() || null;
        const password = document.getElementById('password').value.trim() || null;
        
        if (!host) {
            alert('Please enter a broker host');
            return;
        }
        
        try {
            // Connect WebSocket first
            this.connectWebSocket();
            
            // Then connect to MQTT
            await this.apiCall('/connect', 'POST', {
                host,
                port,
                username,
                password
            });
            
            console.log('MQTT connection initiated');
        } catch (error) {
            console.error('Connection failed:', error);
            alert('Connection failed: ' + error.message);
            this.updateConnectionStatus('disconnected');
        }
    }

    async disconnect() {
        try {
            // First, update UI to show disconnecting state
            this.updateConnectionStatus('disconnected');
            
            // Call backend disconnect
            await this.apiCall('/disconnect', 'POST');
            
            // Give time for status updates to propagate before closing WebSocket
            await new Promise(resolve => setTimeout(resolve, 200));
            
            if (this.websocket) {
                this.websocket.close();
            }
            
            // Reset client state
            this.isConnected = false;
            this.messageCount = 0;
            this.activeTopics.clear();
            this.topicColors.clear();
            this.messageHistory = [];
            
            this.updateTopicLegend();
            this.updateStats();
            
            // Clear all visualizations
            this.clearAllVisualizations();
            
        } catch (error) {
            console.error('Disconnect failed:', error);
            // Still update UI even if API call fails
            this.updateConnectionStatus('disconnected');
            this.isConnected = false;
        }
    }

    async subscribeToTopic() {
        const topic = document.getElementById('topic').value;
        
        if (!topic) {
            alert('Please enter a topic to subscribe to');
            return;
        }
        
        if (!this.isConnected) {
            alert('Please connect to MQTT broker first');
            return;
        }
        
        try {
            await this.apiCall('/subscribe', 'POST', {
                topic,
                qos: 0
            });
            
            console.log('Subscribed to:', topic);
            document.getElementById('topic').value = '';
        } catch (error) {
            console.error('Subscription failed:', error);
            alert('Subscription failed: ' + error.message);
        }
    }
}

// Global functions for HTML onclick handlers
let visualizer;

function toggleConnection() {
    visualizer.toggleConnection();
}

function subscribeToTopic() {
    visualizer.subscribeToTopic();
}

function switchVisualization() {
    visualizer.switchVisualization();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    visualizer = new MQTTVisualizer();
});