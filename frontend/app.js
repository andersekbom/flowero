/**
 * MQTT Message Visualizer Frontend
 * 
 * A high-performance real-time MQTT message visualizer with multiple themes and visualization modes.
 * Features WebSocket-based real-time updates, animated message bubbles, and flower-based visualizations.
 * 
 * Performance optimizations:
 * - DOM element caching for reduced queries
 * - Efficient animation using requestAnimationFrame and transforms
 * - Throttled message rate calculation
 * - DocumentFragment usage for batch DOM updates
 * 
 * @class MQTTVisualizer
 */

class MQTTVisualizer {
    constructor() {
        // Connection state
        this.websocket = null;
        this.isConnected = false;
        
        // Message tracking
        //this.messageCount = 0;
        this.messageRate = 0;
        this.messageHistory = [];
        
        // Performance tracking for radial mode
        this.activeRadialAnimations = 0;
        this.maxRadialAnimations = 20; // Limit concurrent animations
        
        // Frame rate tracking
        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        this.frameRate = 0;
        
        // Topic and color management
        this.topicColors = new Map();
        this.customerColors = new Map();
        this.activeTopics = new Set();
        
        // Visualization state
        this.visualizationMode = 'bubbles';
        this.petals = [];
        this.currentAngle = 0;
        this.petalIdCounter = 0;
        
        // Performance optimization: cache DOM elements
        this.domElements = this.cacheDOMElements();
        
        // Initialize all systems
        this.initialize();
        
        // Start frame rate monitoring
        this.startFrameRateMonitoring();
    }

    cacheDOMElements() {
        return {
            // Connection elements
            host: document.getElementById('host'),
            port: document.getElementById('port'),
            username: document.getElementById('username'),
            password: document.getElementById('password'),
            connectBtn: document.getElementById('connectBtn'),
            subscribeBtn: document.getElementById('subscribeBtn'),
            topic: document.getElementById('topic'),
            
            // Status elements
            status: document.getElementById('status'),
            connectionStatus: document.getElementById('connectionStatus'),
            liveIndicator: document.getElementById('liveIndicator'),
            
            // Stats elements
            totalMessages: document.getElementById('totalMessages'),
            messageRate: document.getElementById('messageRate'),
            activeTopics: document.getElementById('activeTopics'),
            frameRate: document.getElementById('frameRate'),
            activeCards: document.getElementById('activeCards'),
            
            // Visualization elements
            messageFlow: document.getElementById('messageFlow'),
            flowerContainer: document.getElementById('flowerContainer'),
            flowerVisualization: document.getElementById('flowerVisualization'),
            visualizationMode: document.getElementById('visualizationMode'),
            
            // Modal elements
            modal: document.getElementById('messageModal'),
            modalClose: document.getElementById('modalClose'),
            modalCustomer: document.getElementById('modalCustomer'),
            modalTopic: document.getElementById('modalTopic'),
            modalTimestamp: document.getElementById('modalTimestamp'),
            modalPayload: document.getElementById('modalPayload'),
            modalQos: document.getElementById('modalQos'),
            modalRetain: document.getElementById('modalRetain'),
            
            // Legend elements
            colorLegend: document.getElementById('colorLegend'),
            legendItems: document.getElementById('legendItems'),
            
            // Theme elements
            themeMode: document.getElementById('themeMode'),
            sidebar: document.getElementById('sidebar')
        };
    }

    initialize() {
        this.initializeEventListeners();
        this.initializeSidebarToggle();
        this.initializeTheme();
        this.initializeModal();
        this.startStatsUpdate();
    }

    initializeEventListeners() {
        // Enter key handlers with cached DOM elements
        this.domElements.host.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.toggleConnection();
        });
        
        this.domElements.topic.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.subscribeToTopic();
        });
    }

    initializeSidebarToggle() {
        const toggleButton = document.getElementById('sidebarToggle');
        
        if (toggleButton && this.domElements.sidebar) {
            toggleButton.addEventListener('click', () => {
                this.domElements.sidebar.classList.toggle('collapsed');
            });
        }
    }

    initializeTheme() {
        // Load saved theme from localStorage or default to 'default'
        const savedTheme = localStorage.getItem('flowero-theme') || 'default';
        this.applyTheme(savedTheme);
        
        // Set the select dropdown to match
        if (this.domElements.themeMode) {
            this.domElements.themeMode.value = savedTheme;
        }
    }

    switchTheme() {
        const selectedTheme = this.domElements.themeMode.value;
        
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
        this.customerColors.clear();
        
        // If we have active topics, regenerate their colors
        if (this.activeTopics.size > 0) {
            Array.from(this.activeTopics).forEach(topic => {
                this.getTopicColor(topic); // This will generate new colors for the current theme
            });
        }
    }

    initializeModal() {
        // Close modal when clicking the X button
        this.domElements.modalClose.addEventListener('click', () => {
            this.closeModal();
        });
        
        // Close modal when clicking outside the modal content
        this.domElements.modal.addEventListener('click', (e) => {
            if (e.target === this.domElements.modal) {
                this.closeModal();
            }
        });
        
        // Close modal when pressing Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.domElements.modal.style.display === 'block') {
                this.closeModal();
            }
        });
    }

    showMessageModal(messageData) {
        const modalContent = this.domElements.modal.querySelector('.modal-content');
        const customer = this.extractCustomerFromTopic(messageData.topic);
        const color = this.getTopicColor(messageData.topic);
        
        // Style modal to match the card (solid colors, no transparency)
        modalContent.style.background = `linear-gradient(135deg, ${color}, ${color}E6)`;
        modalContent.style.border = `2px solid ${color}`;
        
        // Populate modal fields with all message details using cached elements
        this.domElements.modalCustomer.textContent = customer.toUpperCase();
        this.domElements.modalTopic.textContent = messageData.topic;
        this.domElements.modalTimestamp.textContent = new Date(messageData.timestamp * 1000).toLocaleString();
        this.domElements.modalPayload.textContent = messageData.payload;
        this.domElements.modalQos.textContent = messageData.qos || '0';
        this.domElements.modalRetain.textContent = messageData.retain ? 'Yes' : 'No';
        
        // Show all fields (in case they were hidden before)
        document.querySelector('.modal-field:nth-child(5)').style.display = 'block'; // QoS
        document.querySelector('.modal-field:nth-child(6)').style.display = 'block'; // Retain
        
        // Show modal
        this.domElements.modal.style.display = 'block';
    }

    closeModal() {
        this.domElements.modal.style.display = 'none';
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
            this.domElements.subscribeBtn.disabled = false;
            this.domElements.liveIndicator.style.display = 'flex';
        } else {
            this.isConnected = false;
            this.domElements.subscribeBtn.disabled = true;
            this.domElements.liveIndicator.style.display = 'none';
        }
    }

    handleMQTTMessage(messageData) {
        //this.messageCount++;
        this.activeTopics.add(messageData.topic);
        
        // Update message history for rate calculation (performance optimization)
        this.updateMessageRate();
        
        // Create visualization based on mode
        this.createVisualization(messageData);
        
        // Update stats (throttled to reduce DOM updates)
        this.updateStats();
    }

    updateMessageRate() {
        const now = Date.now();
        this.messageHistory.push(now);
        
        // Keep only last 60 seconds of messages for rate calculation
        // Use more efficient filtering approach
        const cutoffTime = now - 60000;
        let i = 0;
        while (i < this.messageHistory.length && this.messageHistory[i] < cutoffTime) {
            i++;
        }
        if (i > 0) {
            this.messageHistory.splice(0, i);
        }
        
        this.messageRate = this.messageHistory.length / 60;
    }

    createVisualization(messageData) {
        if (this.visualizationMode === 'bubbles' || this.visualizationMode === 'radial' || this.visualizationMode === 'starfield') {
            this.createMessageBubble(messageData);
        } else if (this.visualizationMode === 'flower') {
            this.createFlowerPetal(messageData);
        }
    }

    // Message Animation
    createMessageBubble(messageData) {
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
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
        
        // Calculate positioning based on visualization mode
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        let startX, startY;
        
        if (this.visualizationMode === 'radial') {
            // Radial mode: start at center of screen
            startX = flowWidth / 2;
            startY = flowHeight / 2;
        } else if (this.visualizationMode === 'starfield') {
            // Starfield mode: start at random location across entire screen
            startX = Math.random() * flowWidth;
            startY = Math.random() * flowHeight;
        } else {
            // Default bubbles mode: start from top with horizontal distribution
            const safeCardWidth = 400; // Use CSS max-width value
            const maxAllowedX = flowWidth - safeCardWidth - 20;
            const minX = 20; // 20px margin from left edge
            const availableRange = maxAllowedX > minX ? maxAllowedX - minX : 0;
            startX = minX + Math.random() * availableRange;
            startY = -100; // Start above screen
        }
        
        if (this.visualizationMode === 'radial') {
            // For radial mode, set initial position and let animateMessage handle transitions
            bubble.style.transition = 'none';
            bubble.style.left = `${startX}px`;
            bubble.style.top = `${startY}px`;
            bubble.style.opacity = '1';
            bubble.style.transform = 'scale(1)';
        } else if (this.visualizationMode === 'starfield') {
            // For starfield mode, start small and dim
            bubble.style.transition = 'none';
            bubble.style.left = `${startX}px`;
            bubble.style.top = `${startY}px`;
            bubble.style.opacity = '0.1';
            bubble.style.transform = 'scale(0.1)';
        } else {
            // For bubbles mode, disable transitions for manual animation
            bubble.style.transition = 'none';
            bubble.style.left = `${startX}px`;
            bubble.style.top = `${startY}px`;
        }
        
        // Add to DOM with position already set
        this.domElements.messageFlow.appendChild(bubble);
        
        // Start animation from the already-set position
        this.animateMessage(bubble, startX, startY);
        
        // Remove bubble after animation completes
        setTimeout(() => {
            if (bubble.parentNode) {
                bubble.parentNode.removeChild(bubble);
            }
        }, 8000);
    }

    animateMessage(bubble, startX, startY) {
        const duration = 6000; // 6 seconds to cross screen
        
        if (this.visualizationMode === 'radial') {
            // Limit concurrent animations to prevent crashes
            if (this.activeRadialAnimations >= this.maxRadialAnimations) {
                // Remove bubble immediately if too many active
                if (bubble.parentNode) {
                    bubble.parentNode.removeChild(bubble);
                }
                return;
            }
            
            this.activeRadialAnimations++;
            
            // Manual radial animation like floating bubbles
            const startTime = Date.now();
            const angle = Math.random() * 2 * Math.PI;
            const distance = 600;
            const targetX = startX + Math.cos(angle) * distance;
            const targetY = startY + Math.sin(angle) * distance;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Animate radially outward
                const currentX = startX + (targetX - startX) * progress;
                const currentY = startY + (targetY - startY) * progress;
                
                // Calculate fade and scale based on progress
                const fadeStartPoint = 0.2;
                const opacity = progress < fadeStartPoint ? 1 : 
                    Math.max(0, 1 - (progress - fadeStartPoint) / (1 - fadeStartPoint));
                const scale = Math.max(0.2, 1 - progress * 0.8);
                
                bubble.style.left = `${currentX}px`;
                bubble.style.top = `${currentY}px`;
                bubble.style.opacity = opacity;
                bubble.style.transform = `scale(${scale})`;
                
                if (progress < 1 && bubble.parentNode) {
                    requestAnimationFrame(animate);
                } else {
                    this.activeRadialAnimations--;
                }
            };
            
            animate();
        } else if (this.visualizationMode === 'starfield') {
            // Starfield animation: grow larger and brighter over time (simulating approach)
            const startTime = Date.now();
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Calculate scale: grow from 10% to 150% for dramatic depth effect
                const scale = 0.1 + (progress * 1.4); // 0.1 to 1.5
                
                // Calculate opacity: fade in quickly, then fade out near the end
                let opacity;
                if (progress < 0.8) {
                    // Fade in and stay bright for first 80% of animation
                    opacity = Math.min(1, progress * 2); // Quick fade in
                } else {
                    // Fade out in the last 20% (simulating passing by the viewer)
                    opacity = 1 - ((progress - 0.8) / 0.2);
                }
                
                bubble.style.transform = `scale(${scale})`;
                bubble.style.opacity = opacity;
                
                if (progress < 1 && bubble.parentNode) {
                    requestAnimationFrame(animate);
                }
            };
            
            animate();
        } else {
            // Default bubbles animation: vertical movement
            const startTime = Date.now();
            const targetY = this.domElements.messageFlow.clientHeight + bubble.offsetHeight + 100;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Animate from top (negative Y) to bottom (positive Y), keeping X constant
                const currentY = startY + (targetY - startY) * progress;
                bubble.style.top = `${currentY}px`;
                
                if (progress < 1 && bubble.parentNode) {
                    requestAnimationFrame(animate);
                }
            };
            
            animate();
        }
    }

    // Flower visualization - simplified and cleaned up
    createFlowerPetal(messageData) {
        const circleId = this.petalIdCounter++;
        const color = this.getTopicColor(messageData.topic);
        
        // Create circle element with optimized styling
        const circle = this.createCircleElement(circleId, color);
        
        // Add to flower container
        this.domElements.flowerContainer.appendChild(circle);
        
        // Store circle info
        this.petals.push({
            id: circleId,
            element: circle,
            color: color,
            topic: messageData.topic
        });
        
        // Auto-remove after 5 seconds
        this.scheduleCircleRemoval(circleId);
    }

    createCircleElement(circleId, color) {
        const circle = document.createElement('div');
        circle.className = 'test-circle';
        circle.id = `circle-${circleId}`;
        
        // Apply styles in one go for better performance
        Object.assign(circle.style, {
            position: 'absolute',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: color,
            border: '2px solid white',
            left: '400px',
            top: '400px',
            transform: 'translate(-50%, -50%)'
        });
        
        return circle;
    }

    scheduleCircleRemoval(circleId) {
        setTimeout(() => {
            const circleElement = document.getElementById(`circle-${circleId}`);
            if (circleElement) {
                circleElement.remove();
                this.petals = this.petals.filter(p => p.id !== circleId);
            }
        }, 5000);
    }

    // Visualization switching
    switchVisualization() {
        const mode = this.domElements.visualizationMode.value;
        this.visualizationMode = mode;
        
        // Clear current visualizations
        this.clearAllVisualizations();
        
        // Show/hide appropriate containers using cached elements
        if (mode === 'bubbles' || mode === 'radial' || mode === 'starfield') {
            this.domElements.messageFlow.style.display = 'block';
            this.domElements.flowerVisualization.style.display = 'none';
        } else if (mode === 'flower') {
            this.domElements.messageFlow.style.display = 'none';
            this.domElements.flowerVisualization.style.display = 'flex';
        }
    }
    
    clearAllVisualizations() {
        // Clear bubbles
        const bubbles = document.querySelectorAll('.message-bubble');
        bubbles.forEach(bubble => bubble.remove());
        
        // Clear petals and test circles
        const petals = document.querySelectorAll('.flower-petal');
        const circles = document.querySelectorAll('.test-circle');
        
        petals.forEach(petal => petal.remove());
        circles.forEach(circle => circle.remove());
        
        // Clear any orphaned elements in flower container
        if (this.domElements.flowerContainer) {
            Array.from(this.domElements.flowerContainer.children).forEach(child => {
                if (child.className !== 'flower-center') {
                    child.remove();
                }
            });
        }
        
        this.petals = [];
    }

    // Color Management
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
        if (!this.customerColors.has(customer)) {
            const colors = this.getThemeColors();
            const color = colors[this.customerColors.size % colors.length];
            this.customerColors.set(customer, color);
        }
        
        return this.customerColors.get(customer);
    }

    // Extract color palettes into separate method for better organization
    getThemeColors() {
        const currentTheme = document.body.getAttribute('data-theme') || 'default';
        
        const colorPalettes = {
            dark: [
                '#00FF41', '#00FFFF', '#FF1493', '#FF4500', '#FFFF00',
                '#FF69B4', '#00FA9A', '#FF6347', '#7FFF00', '#00BFFF'
            ],
            spring: [
                '#8BC34A', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7',
                '#C8E6C9', '#E8F5E8', '#FFEB3B', '#FFF176', '#FFECB3'
            ],
            summer: [
                '#FF9800', '#FFB74D', '#FFCC02', '#FFC107', '#FF8F00',
                '#FF6F00', '#E65100', '#FF5722', '#FF7043', '#FFAB40'
            ],
            autumn: [
                '#D2691E', '#CD853F', '#DEB887', '#F4A460', '#DAA520',
                '#B8860B', '#A0522D', '#8B4513', '#FF8C00', '#FF7F50'
            ],
            winter: [
                '#4682B4', '#5F9EA0', '#6495ED', '#87CEEB', '#B0C4DE',
                '#B0E0E6', '#ADD8E6', '#E0F6FF', '#F0F8FF', '#DCDCDC'
            ],
            default: [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
            ]
        };
        
        return colorPalettes[currentTheme] || colorPalettes.default;
    }

    // Utility Functions
    formatPayload(payload) {
        return payload.length > 100 ? payload.substring(0, 100) + '...' : payload;
    }

    formatTime(timestamp) {
        return new Date(timestamp * 1000).toLocaleTimeString();
    }

    extractCustomerFromTopic(topic) {
        return topic.split('/')[0] || topic;
    }

    // UI Updates - using cached DOM elements for better performance
    updateConnectionStatus(status) {
        this.domElements.status.className = `status ${status.toLowerCase()}`;
        
        const statusConfig = this.getStatusConfig(status.toLowerCase());
        
        this.domElements.status.textContent = statusConfig.statusText;
        this.domElements.connectionStatus.textContent = statusConfig.connectionText;
        this.domElements.connectBtn.textContent = statusConfig.buttonText;
        this.domElements.connectBtn.style.background = statusConfig.buttonColor;
        this.domElements.connectBtn.disabled = statusConfig.buttonDisabled;
    }

    // Extract status configuration for better readability
    getStatusConfig(status) {
        const configs = {
            connected: {
                statusText: '🟢 Connected',
                connectionText: 'Online',
                buttonText: 'Disconnect',
                buttonColor: '#f44336',
                buttonDisabled: false
            },
            connecting: {
                statusText: '🟡 Connecting...',
                connectionText: 'Connecting',
                buttonText: 'Connect',
                buttonColor: '#4CAF50',
                buttonDisabled: true
            },
            disconnected: {
                statusText: '🔴 Disconnected',
                connectionText: 'Offline',
                buttonText: 'Connect',
                buttonColor: '#4CAF50',
                buttonDisabled: false
            }
        };
        
        return configs[status] || configs.disconnected;
    }

    updateStats() {
        // Use cached DOM elements for better performance
        //this.domElements.totalMessages.textContent = this.messageCount;
        this.domElements.messageRate.textContent = this.messageRate.toFixed(1);
        this.domElements.activeTopics.textContent = this.activeTopics.size;
    }

    updateTopicLegend() {
        // Update main content area legend only (sidebar topic list removed)
        this.updateMainLegend();
    }

    updateMainLegend() {
        if (this.customerColors.size === 0) {
            this.domElements.colorLegend.style.display = 'none';
            return;
        }
        
        this.domElements.colorLegend.style.display = 'block';
        this.domElements.legendItems.innerHTML = '';
        
        // Use DocumentFragment for better performance when adding multiple elements
        const fragment = document.createDocumentFragment();
        
        this.customerColors.forEach((color, customer) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="background-color: ${color}"></div>
                <span class="legend-customer">${customer.toUpperCase()}</span>
            `;
            fragment.appendChild(item);
        });
        
        this.domElements.legendItems.appendChild(fragment);
    }

    startStatsUpdate() {
        // Use throttled updates to improve performance
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
        const connectionConfig = this.getConnectionConfig();
        
        if (!connectionConfig.host) {
            alert('Please enter a broker host');
            return;
        }
        
        try {
            // Connect WebSocket first
            this.connectWebSocket();
            
            // Then connect to MQTT
            await this.apiCall('/connect', 'POST', connectionConfig);
            
            console.log('MQTT connection initiated');
        } catch (error) {
            console.error('Connection failed:', error);
            alert('Connection failed: ' + error.message);
            this.updateConnectionStatus('disconnected');
        }
    }

    // Extract connection configuration for better organization
    getConnectionConfig() {
        return {
            host: this.domElements.host.value.trim(),
            port: parseInt(this.domElements.port.value),
            username: this.domElements.username.value.trim() || null,
            password: this.domElements.password.value.trim() || null
        };
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
            this.resetClientState();
            
        } catch (error) {
            console.error('Disconnect failed:', error);
            // Still update UI even if API call fails
            this.updateConnectionStatus('disconnected');
            this.isConnected = false;
        }
    }

    resetClientState() {
        this.isConnected = false;
        //this.messageCount = 0;
        this.activeTopics.clear();
        this.topicColors.clear();
        this.messageHistory = [];
        
        this.updateTopicLegend();
        this.updateStats();
        this.clearAllVisualizations();
    }

    async subscribeToTopic() {
        const topic = this.domElements.topic.value;
        
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
            this.domElements.topic.value = '';
        } catch (error) {
            console.error('Subscription failed:', error);
            alert('Subscription failed: ' + error.message);
        }
    }
    
    startFrameRateMonitoring() {
        const updateFrameRate = () => {
            this.frameCount++;
            const now = Date.now();
            const timeDiff = now - this.lastFrameTime;
            
            // Update FPS and performance stats every second
            if (timeDiff >= 1000) {
                this.frameRate = Math.round((this.frameCount * 1000) / timeDiff);
                if (this.domElements.frameRate) {
                    this.domElements.frameRate.textContent = this.frameRate;
                }
                
                // Count active message cards
                const activeCards = document.querySelectorAll('.message-bubble').length;
                if (this.domElements.activeCards) {
                    this.domElements.activeCards.textContent = activeCards;
                }
                
                this.frameCount = 0;
                this.lastFrameTime = now;
            }
            
            requestAnimationFrame(updateFrameRate);
        };
        
        updateFrameRate();
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