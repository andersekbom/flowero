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
        this.initializeSidebarToggle();
        this.initializeTheme();
        this.initializeModal();
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

    initializeSidebarToggle() {
        const toggleButton = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        
        if (toggleButton && sidebar) {
            toggleButton.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
            });
        }
    }

    initializeTheme() {
        // Load saved theme from localStorage or default to 'default'
        const savedTheme = localStorage.getItem('flowero-theme') || 'default';
        this.applyTheme(savedTheme);
        
        // Set the select dropdown to match
        const themeSelector = document.getElementById('themeMode');
        if (themeSelector) {
            themeSelector.value = savedTheme;
        }
    }

    switchTheme() {
        const themeSelector = document.getElementById('themeMode');
        const selectedTheme = themeSelector.value;
        
        this.applyTheme(selectedTheme);
        
        // Save theme preference
        localStorage.setItem('flowero-theme', selectedTheme);
    }

    applyTheme(theme) {
        const body = document.body;
        
        if (theme === 'default') {
            body.removeAttribute('data-theme');
        } else {
            body.setAttribute('data-theme', theme);
        }
        
        // Refresh topic colors for new theme
        this.refreshTopicColors();
    }

    refreshTopicColors() {
        // Clear existing colors to regenerate with new theme
        this.topicColors.clear();
        if (this.customerColors) {
            this.customerColors.clear();
        }
        
        // If we have active topics, regenerate their colors
        if (this.activeTopics.size > 0) {
            const topics = Array.from(this.activeTopics);
            topics.forEach(topic => {
                this.getTopicColor(topic); // This will generate new colors for the current theme
            });
        }
    }

    initializeModal() {
        const modal = document.getElementById('messageModal');
        const closeButton = document.getElementById('modalClose');
        
        // Close modal when clicking the X button
        closeButton.addEventListener('click', () => {
            this.closeModal();
        });
        
        // Close modal when clicking outside the modal content
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
        
        // Close modal when pressing Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                this.closeModal();
            }
        });
    }

    showMessageModal(messageData) {
        const modal = document.getElementById('messageModal');
        const modalContent = modal.querySelector('.modal-content');
        const customer = this.extractCustomerFromTopic(messageData.topic);
        const color = this.getTopicColor(messageData.topic);
        
        // Style modal to match the card (solid colors, no transparency)
        modalContent.style.background = `linear-gradient(135deg, ${color}, ${color}E6)`;
        modalContent.style.border = `2px solid ${color}`;
        
        // Populate modal fields with all message details
        document.getElementById('modalCustomer').textContent = customer.toUpperCase();
        document.getElementById('modalTopic').textContent = messageData.topic;
        document.getElementById('modalTimestamp').textContent = new Date(messageData.timestamp * 1000).toLocaleString();
        document.getElementById('modalPayload').textContent = messageData.payload;
        document.getElementById('modalQos').textContent = messageData.qos || '0';
        document.getElementById('modalRetain').textContent = messageData.retain ? 'Yes' : 'No';
        
        // Show all fields (in case they were hidden before)
        document.querySelector('.modal-field:nth-child(5)').style.display = 'block'; // QoS
        document.querySelector('.modal-field:nth-child(6)').style.display = 'block'; // Retain
        
        // Show modal
        modal.style.display = 'block';
    }

    closeModal() {
        const modal = document.getElementById('messageModal');
        modal.style.display = 'none';
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
        const customer = this.extractCustomerFromTopic(messageData.topic);
        bubble.innerHTML = `
            <div class="message-customer">${customer}</div>
            <div class="message-topic">${messageData.topic}</div>
            <div class="message-time">${this.formatTime(messageData.timestamp)}</div>
        `;
        
        // Add click event listener to show modal
        bubble.addEventListener('click', () => {
            this.showMessageModal(messageData);
        });
        
        // Add to DOM first so we can get dimensions
        const flowArea = document.getElementById('messageFlow');
        flowArea.appendChild(bubble);
        
        // Random starting position (top, with more variety in width)
        const startX = Math.random() * (flowArea.clientWidth - 300) + 150;
        const startY = -bubble.offsetHeight - 50;
        
        bubble.style.left = `${startX}px`;
        bubble.style.top = `${startY}px`;
        
        // Animate down screen with downward movement
        this.animateMessage(bubble);
        
        // Remove bubble after animation completes
        setTimeout(() => {
            if (bubble.parentNode) {
                bubble.classList.add('message-exit');
                setTimeout(() => bubble.remove(), 500);
            }
        }, 8000);
    }

    animateMessage(bubble) {
        const flowArea = document.getElementById('messageFlow');
        const startX = parseFloat(bubble.style.left);
        const startY = parseFloat(bubble.style.top);
        const targetY = flowArea.clientHeight + bubble.offsetHeight + 100;
        const duration = 8000; // 8 seconds to cross screen (1.5x speed)
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Straight down movement only
            const currentY = startY + (targetY - startY) * progress;
            
            bubble.style.left = `${startX}px`;
            bubble.style.top = `${currentY}px`;
            
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
            const customer = this.extractCustomerFromTopic(topic);
            const color = this.getCustomerColor(customer);
            this.topicColors.set(topic, color);
            this.updateTopicLegend();
        }
        return this.topicColors.get(topic);
    }

    getCustomerColor(customer) {
        // Initialize customer colors map if it doesn't exist
        if (!this.customerColors) {
            this.customerColors = new Map();
        }

        if (!this.customerColors.has(customer)) {
            const currentTheme = document.body.getAttribute('data-theme') || 'default';
            
            let colors;
            switch (currentTheme) {
                case 'dark':
                    colors = [
                        '#00FF41', '#00FFFF', '#FF1493', '#FF4500', '#FFFF00',
                        '#FF69B4', '#00FA9A', '#FF6347', '#7FFF00', '#00BFFF'
                    ];
                    break;
                case 'spring':
                    colors = [
                        '#8BC34A', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7',
                        '#C8E6C9', '#E8F5E8', '#FFEB3B', '#FFF176', '#FFECB3'
                    ];
                    break;
                case 'summer':
                    colors = [
                        '#FF9800', '#FFB74D', '#FFCC02', '#FFC107', '#FF8F00',
                        '#FF6F00', '#E65100', '#FF5722', '#FF7043', '#FFAB40'
                    ];
                    break;
                case 'autumn':
                    colors = [
                        '#D2691E', '#CD853F', '#DEB887', '#F4A460', '#DAA520',
                        '#B8860B', '#A0522D', '#8B4513', '#FF8C00', '#FF7F50'
                    ];
                    break;
                case 'winter':
                    colors = [
                        '#4682B4', '#5F9EA0', '#6495ED', '#87CEEB', '#B0C4DE',
                        '#B0E0E6', '#ADD8E6', '#E0F6FF', '#F0F8FF', '#DCDCDC'
                    ];
                    break;
                default: // default theme
                    colors = [
                        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
                    ];
            }
            
            const color = colors[this.customerColors.size % colors.length];
            this.customerColors.set(customer, color);
        }
        
        return this.customerColors.get(customer);
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

    extractCustomerFromTopic(topic) {
        // Extract the first part of the topic (before the first slash)
        const parts = topic.split('/');
        return parts[0] || topic;
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
        // Update main content area legend only (sidebar topic list removed)
        this.updateMainLegend();
    }

    updateMainLegend() {
        const colorLegend = document.getElementById('colorLegend');
        const legendItems = document.getElementById('legendItems');
        
        if (!this.customerColors || this.customerColors.size === 0) {
            colorLegend.style.display = 'none';
            return;
        }
        
        colorLegend.style.display = 'block';
        legendItems.innerHTML = '';
        
        // Display each customer with their assigned color
        this.customerColors.forEach((color, customer) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="background-color: ${color}"></div>
                <span class="legend-customer">${customer.toUpperCase()}</span>
            `;
            legendItems.appendChild(item);
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

function switchTheme() {
    visualizer.switchTheme();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    visualizer = new MQTTVisualizer();
});