/**
 * MQTT Message Visualizer Frontend
 * 
 * A high-performance real-time MQTT message visualizer with multiple themes and visualization modes.
 * Features WebSocket-based real-time updates and animated message visualizations.
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
        this.maxRadialAnimations = 150; // Limit concurrent animations
        
        // Z-index tracking for depth layering
        this.messageZIndex = 1000; // Start with high z-index (newer cards will have lower values)
        this.maxZIndex = 1000; // Maximum z-index value
        this.minZIndex = 1; // Minimum z-index value (prevent going to 0 or negative)
        
        // Frame rate tracking
        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        this.frameRate = 0;
        
        // Performance optimizations
        this.animationFramePool = new Set();
        this.bubblePool = [];
        this.maxPoolSize = 50;
        this.activeAnimations = new Map();
        
        // Browser compatibility
        this.hasIntersectionObserver = 'IntersectionObserver' in window;
        this.hasRequestIdleCallback = 'requestIdleCallback' in window;
        this.supportsPassiveListeners = this.detectPassiveSupport();
        
        // Topic and color management
        this.topicColors = new Map();
        this.customerColors = new Map();
        this.activeTopics = new Set();
        
        // Visualization state
        this.visualizationMode = 'bubbles';
        this.currentAngle = 0;
        
        // Direction control for bubbles mode
        this.bubbleDirection = { x: 0, y: 1 }; // Default: downward
        
        // D3.js Network graph state
        this.d3Nodes = []; // Array of all nodes for D3
        this.d3Links = []; // Array of all links for D3
        this.d3Simulation = null;
        this.d3Svg = null;
        this.d3Container = null;
        this.networkResizeObserver = null;
        
        // Node tracking maps
        this.customerNodes = new Map(); // customer -> node reference
        this.messageNodes = new Map(); // message -> node reference
        this.brokerNode = null;
        
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
            brokerUrlDisplay: document.getElementById('brokerUrlDisplay'),
            brokerUrl: document.getElementById('brokerUrl'),
            
            // Stats elements
            totalMessages: document.getElementById('totalMessages'),
            messageRate: document.getElementById('messageRate'),
            activeTopics: document.getElementById('activeTopics'),
            frameRate: document.getElementById('frameRate'),
            activeCards: document.getElementById('activeCards'),
            
            // Visualization elements
            messageFlow: document.getElementById('messageFlow'),
            
            // Visualization mode buttons
            vizIconButtons: document.querySelectorAll('.viz-icon-btn'),
            vizModeButtons: document.querySelectorAll('.viz-mode-btn'),
            
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
            
            // Stats panel
            statsPanel: document.getElementById('statsPanel'),
            
            // Theme elements
            themeMode: document.getElementById('themeMode'),
            sidebar: document.getElementById('sidebar')
        };
    }

    initialize() {
        this.initializeEventListeners();
        this.initializeSidebarToggle();
        this.initializeVisualizationButtons();
        this.initializeTheme();
        this.initializeModal();
        this.startStatsUpdate();
    }

    initializeEventListeners() {
        // Browser compatibility for passive event listeners
        const passiveOption = this.supportsPassiveListeners ? { passive: false } : false;
        
        // Enter key handlers with cached DOM elements
        this.domElements.host.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) this.toggleConnection();
        }, passiveOption);
        
        this.domElements.topic.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) this.subscribeToTopic();
        }, passiveOption);
        
        // Cursor key handlers for controlling bubble direction with better browser compatibility
        document.addEventListener('keydown', (e) => {
            if (this.visualizationMode === 'bubbles') {
                const key = e.key || e.which || e.keyCode;
                let handled = false;
                
                switch(key) {
                    case 'ArrowUp':
                    case 'Up': // IE fallback
                    case 38: // keyCode fallback
                        this.bubbleDirection = { x: 0, y: -1 };
                        handled = true;
                        break;
                    case 'ArrowDown':
                    case 'Down': // IE fallback
                    case 40: // keyCode fallback
                        this.bubbleDirection = { x: 0, y: 1 };
                        handled = true;
                        break;
                    case 'ArrowLeft':
                    case 'Left': // IE fallback
                    case 37: // keyCode fallback
                        this.bubbleDirection = { x: -1, y: 0 };
                        handled = true;
                        break;
                    case 'ArrowRight':
                    case 'Right': // IE fallback
                    case 39: // keyCode fallback
                        this.bubbleDirection = { x: 1, y: 0 };
                        handled = true;
                        break;
                }
                
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        }, passiveOption);
    }

    initializeSidebarToggle() {
        const toggleButton = document.getElementById('sidebarToggle');
        
        if (toggleButton && this.domElements.sidebar) {
            toggleButton.addEventListener('click', () => {
                this.domElements.sidebar.classList.toggle('collapsed');
            });
        }
    }
    
    initializeVisualizationButtons() {
        // Add click handlers for collapsed sidebar visualization icons
        this.domElements.vizIconButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.switchVisualization(mode);
            });
        });
        
        // Add click handlers for expanded sidebar visualization buttons
        this.domElements.vizModeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.switchVisualization(mode);
            });
        });
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
        const passiveOption = this.supportsPassiveListeners ? { passive: true } : false;
        
        // Close modal when clicking the X button
        this.domElements.modalClose.addEventListener('click', () => {
            this.closeModal();
        }, passiveOption);
        
        // Close modal when clicking outside the modal content
        this.domElements.modal.addEventListener('click', (e) => {
            if (e.target === this.domElements.modal) {
                this.closeModal();
            }
        }, passiveOption);
        
        // Close modal when pressing Escape key with browser compatibility
        document.addEventListener('keydown', (e) => {
            const key = e.key || e.which || e.keyCode;
            if ((key === 'Escape' || key === 'Esc' || key === 27) && 
                this.domElements.modal.style.display === 'block') {
                this.closeModal();
            }
        }, this.supportsPassiveListeners ? { passive: false } : false);
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
        
        this.websocket.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus('connecting');
        };
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.websocket.onclose = () => {
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
            
            // Show broker URL under Live indicator
            const brokerUrl = `${this.domElements.host.value}:${this.domElements.port.value}`;
            this.domElements.brokerUrl.textContent = brokerUrl;
            this.domElements.brokerUrlDisplay.style.display = 'block';
            
            // Show UI elements when connected
            this.domElements.statsPanel.style.display = 'block';
        } else {
            this.isConnected = false;
            this.domElements.subscribeBtn.disabled = true;
            this.domElements.liveIndicator.style.display = 'none';
            this.domElements.brokerUrlDisplay.style.display = 'none';
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
        if (this.visualizationMode === 'network') {
            this.updateNetworkGraph(messageData);
        } else if (this.visualizationMode === 'bubbles') {
            this.updateD3Bubbles(messageData);
        } else if (this.visualizationMode === 'radial') {
            this.createD3RadialBubble(messageData);
        } else if (this.visualizationMode === 'starfield') {
            this.createMessageBubble(messageData);
        }
    }

    // Message Animation - Optimized with object pooling
    createMessageBubble(messageData) {
        const bubble = this.getBubbleFromPool();
        bubble.className = 'message-bubble';
        
        // Get or create color for topic
        const color = this.getTopicColor(messageData.topic);
        
        // Batch style updates to reduce reflows
        const styles = {
            background: `linear-gradient(135deg, ${color}, ${color}E6)`,
            border: `2px solid ${color}`,
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)'
        };
        
        // Apply mode-specific styling
        if (this.visualizationMode === 'starfield') {
            // For starfield mode, add side-lighting gradient overlay (brightness handled dynamically during animation)
            styles.background = `
                linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 30%, rgba(0,0,0,0.2) 70%, rgba(0,0,0,0.4) 100%),
                linear-gradient(135deg, ${color}, ${color}E6)
            `;
        } else if (this.visualizationMode === 'bubbles' || this.visualizationMode === 'radial') {
            // Start with full brightness, will be smoothly adjusted during animation
            styles.filter = 'brightness(1.0)';
            bubble.dataset.brightness = '1.0'; // Store initial brightness
            
            // Set initial scale based on mode
            if (this.visualizationMode === 'radial') {
                bubble.dataset.scale = '0.3'; // Start small for radial mode
                styles.transform = 'scale(0.3)'; // Apply immediately
            } else {
                bubble.dataset.scale = '1.0'; // Normal scale for bubbles mode
            }
            
            bubble.dataset.createdAt = Date.now().toString(); // Store creation time
        }
        
        Object.assign(bubble.style, styles);
        
        // Create message content with template for better performance
        const customer = this.extractCustomerFromTopic(messageData.topic);
        const template = document.createElement('template');
        template.innerHTML = `
            <div class="message-customer">${customer}</div>
            <div class="message-topic">${messageData.topic}</div>
            <div class="message-time">${this.formatTime(messageData.timestamp)}</div>
        `;
        
        bubble.appendChild(template.content);
        
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
            // Starfield mode: start all cards at exact center
            startX = flowWidth / 2;
            startY = flowHeight / 2;
        } else {
            // Default bubbles mode: start from opposite side of movement direction
            const safeCardWidth = 600; // Use CSS max-width value (increased by 50%)
            const margin = 20;
            
            if (this.bubbleDirection.y === -1) {
                // Moving up: start from bottom
                startX = margin + Math.random() * (flowWidth - safeCardWidth - 2 * margin);
                startY = flowHeight + 100;
            } else if (this.bubbleDirection.y === 1) {
                // Moving down: start from top
                startX = margin + Math.random() * (flowWidth - safeCardWidth - 2 * margin);
                startY = -100;
            } else if (this.bubbleDirection.x === -1) {
                // Moving left: start from right
                startX = flowWidth + 100;
                startY = margin + Math.random() * (flowHeight - 2 * margin);
            } else if (this.bubbleDirection.x === 1) {
                // Moving right: start from left
                startX = -safeCardWidth - 100;
                startY = margin + Math.random() * (flowHeight - 2 * margin);
            }
        }
        
        if (this.visualizationMode === 'radial') {
            // For radial mode, set initial position and let animateMessage handle transitions
            bubble.style.transition = 'none';
            bubble.style.left = `${startX}px`;
            bubble.style.top = `${startY}px`;
            bubble.style.opacity = '1';
            bubble.style.transform = 'scale(1)';
        } else if (this.visualizationMode === 'starfield') {
            // For starfield mode, start small and transparent
            bubble.style.transition = 'none';
            bubble.style.left = `${startX}px`;
            bubble.style.top = `${startY}px`;
            bubble.style.opacity = '0.1';
            bubble.style.transform = 'scale(0.3)';
        } else {
            // For bubbles mode, disable transitions for manual animation
            bubble.style.transition = 'none';
            bubble.style.left = `${startX}px`;
            bubble.style.top = `${startY}px`;
        }
        
        // Set z-index for depth layering (newer cards behind older ones)
        bubble.style.zIndex = this.messageZIndex;
        this.getNextZIndex(); // Update messageZIndex with bounds checking
        
        // Add to DOM with position already set
        this.domElements.messageFlow.appendChild(bubble);
        
        // Start animation from the already-set position
        this.animateMessage(bubble, startX, startY);
        
        // Store bubble reference for cleanup
        const bubbleId = Date.now() + Math.random();
        this.activeAnimations.set(bubbleId, bubble);
        
        // Cards will be removed by their individual animation logic when off-screen or fully transparent
    }

    animateMessage(bubble, startX, startY) {
        const duration = 20000; // 20 seconds to cross screen

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
            
            // Manual radial animation with random angles
            const startTime = Date.now();
            const angle = Math.random() * 2 * Math.PI;
            const maxDistance = 600;
            const targetX = startX + Math.cos(angle) * maxDistance;
            const targetY = startY + Math.sin(angle) * maxDistance;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Animate straight outward in assigned direction
                const currentX = startX + (targetX - startX) * progress;
                const currentY = startY + (targetY - startY) * progress;
                
                // Calculate scaling based on progress (start small, grow larger)
                const minScale = 0.3;
                const maxScale = 1.5;
                const scale = minScale + (progress * (maxScale - minScale));
                
                // Calculate fade based on progress
                const fadeStartPoint = 0.2;
                const opacity = progress < fadeStartPoint ? 1 : 
                    Math.max(0, 1 - (progress - fadeStartPoint) / (1 - fadeStartPoint));
                
                bubble.style.left = `${currentX}px`;
                bubble.style.top = `${currentY}px`;
                bubble.style.opacity = opacity;
                bubble.style.transform = `scale(${scale})`;
                
                if (progress < 1 && opacity > 0 && bubble.parentNode) {
                    requestAnimationFrame(animate);
                } else if (bubble.parentNode) {
                    // Remove card when animation completes or becomes fully transparent
                    bubble.parentNode.removeChild(bubble);
                    this.activeRadialAnimations--;
                }
            };
            
            animate();
        } else if (this.visualizationMode === 'starfield') {
            // Starfield animation: simple distance-based physics
            // Use the same center calculation as initial positioning
            const centerX = startX;
            const centerY = startY;
            
            // Generate random direction
            const angle = Math.random() * 2 * Math.PI;
            const directionX = Math.cos(angle);
            const directionY = Math.sin(angle);
            
            // Animation state
            let currentDistance = 0; // Start at center (distance = 0)
            // Calculate dynamic max distance based on window size
            const flowWidth = this.domElements.messageFlow.clientWidth;
            const flowHeight = this.domElements.messageFlow.clientHeight;
            // Distance from center to corner of screen (this is the furthest any card needs to travel)
            const maxScreenDistance = Math.sqrt((flowWidth/2) * (flowWidth/2) + (flowHeight/2) * (flowHeight/2));
            // Add buffer to account for card size and ensure cards move completely off screen
            // Cards can be up to 400px wide and grow up to 8x scale, so need significant buffer
            const cardMaxSize = 600 * 8; // max card width * max scale (increased by 50%)
            const buffer = cardMaxSize / 2; // Half the max card size should be enough
            const maxDistance = maxScreenDistance + buffer + 200;
            const startTime = Date.now();
            const maxDuration = 15000; // 10 second timeout (slower velocity)

            const animate = () => {
                const elapsed = Date.now() - startTime;
                
                // Calculate distance from center with acceleration (quadratic growth for starfield effect)
                const timeRatio = Math.min(elapsed / maxDuration, 1);

                const intensity = 8; // Higher = more dramatic
                currentDistance = (Math.pow(timeRatio, intensity)) * maxDistance;

                // Position based on distance and direction
                const currentX = centerX + (directionX * currentDistance);
                const currentY = centerY + (directionY * currentDistance);
                
                // Size based on distance (further = bigger)
                const minScale = 0.3;
                const maxScale = 10.0;
                const distanceRatio = Math.min(currentDistance / maxDistance, 1);
                const scale = minScale + (distanceRatio * distanceRatio * (maxScale - minScale));
                
                // Opacity: fade in quickly during first part of animation
                let opacity;
                if (distanceRatio < 0.02) {
                    opacity = distanceRatio * 50; // Very quick fade in (2% of journey)
                } else {
                    opacity = 1; // Stay fully visible for the rest of the journey
                }
                
                // Brightness: related to distance and size - darker at center, brighter at edge
                const minBrightness = 0.6; // Dark at center (60% brightness)
                const maxBrightness = 1.0; // Full brightness at edge
                const brightness = minBrightness + (distanceRatio * (maxBrightness - minBrightness));
                
                // Update DOM
                bubble.style.left = `${currentX}px`;
                bubble.style.top = `${currentY}px`;
                bubble.style.transform = `scale(${scale})`;
                bubble.style.opacity = opacity;
                bubble.style.filter = `brightness(${brightness})`;
                
                // Check if card should be removed (off screen or timeout)
                const flowWidth = this.domElements.messageFlow.clientWidth;
                const flowHeight = this.domElements.messageFlow.clientHeight;
                const buffer = 2000; // Use larger fixed buffer instead of calculated one
                const isOffScreen = (currentX < -buffer || currentX > flowWidth + buffer || 
                                   currentY < -buffer || currentY > flowHeight + buffer);
                
                if (elapsed < maxDuration && !isOffScreen && bubble.parentNode) {
                    requestAnimationFrame(animate);
                } else if (bubble.parentNode) {
                    // Remove card when off screen or timeout reached
                    bubble.parentNode.removeChild(bubble);
                }
            };
            
            animate();
        } else {
            // Default bubbles animation: directional movement controlled by cursor keys
            const startTime = Date.now();
            const flowWidth = this.domElements.messageFlow.clientWidth;
            const flowHeight = this.domElements.messageFlow.clientHeight;
            // Calculate dynamic travel distance based on screen size and direction
            const buffer = 500;
            let targetX, targetY;
            
            if (this.bubbleDirection.x !== 0) {
                // Horizontal movement: travel across full width plus buffer
                const travelDistance = flowWidth + buffer * 2;
                targetX = startX + (this.bubbleDirection.x * travelDistance);
                targetY = startY; // No vertical movement
            } else {
                // Vertical movement: travel across full height plus buffer
                const travelDistance = flowHeight + buffer * 2;
                targetX = startX; // No horizontal movement
                targetY = startY + (this.bubbleDirection.y * travelDistance);
            }
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Animate in the controlled direction
                const currentX = startX + (targetX - startX) * progress;
                const currentY = startY + (targetY - startY) * progress;
                
                bubble.style.left = `${currentX}px`;
                bubble.style.top = `${currentY}px`;
                
                // Check if off screen with larger buffer to let boxes fully exit
                const buffer = 500;
                const isOffScreen = (currentX < -buffer || currentX > flowWidth + buffer || 
                                   currentY < -buffer || currentY > flowHeight + buffer);
                
                if (progress < 1 && !isOffScreen && bubble.parentNode) {
                    requestAnimationFrame(animate);
                } else if (bubble.parentNode) {
                    // Remove card when animation completes or goes off screen
                    bubble.parentNode.removeChild(bubble);
                    this.returnBubbleToPool(bubble);
                }
            };
            
            animate();
        }
    }

    // Network Graph Implementation
    updateNetworkGraph(messageData) {
        if (!this.d3Simulation) {
            this.initializeD3Network();
        }
        
        const customer = this.extractCustomerFromTopic(messageData.topic);
        const topic = messageData.topic;
        
        // Add or update nodes and links
        this.addNetworkMessage(customer, topic, messageData);
        
        // Update the D3 simulation
        this.updateD3Simulation();
        
        // Create pulse animation
        this.createD3Pulse(customer, topic);
    }
    
    initializeD3Network() {
        // Clear existing content but preserve UI elements
        const existingSvg = this.domElements.messageFlow.querySelector('#d3-network');
        if (existingSvg) {
            existingSvg.remove();
        }
        
        // Remove any message bubbles
        const bubbles = this.domElements.messageFlow.querySelectorAll('.message-bubble');
        bubbles.forEach(bubble => bubble.remove());
        
        // Get full viewport dimensions for responsive full-screen layout
        const container = this.domElements.messageFlow;
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Create D3 SVG with full viewport coverage
        this.d3Svg = d3.select(container)
            .append('svg')
            .attr('id', 'd3-network')
            .attr('width', width)
            .attr('height', height)
            .style('position', 'fixed') // Fixed positioning for full screen
            .style('top', '0')
            .style('left', '0')
            .style('width', '100vw')
            .style('height', '100vh')
            .style('z-index', '1');
        
        // Add filters
        const defs = this.d3Svg.append('defs');
        
        // Glow filter
        const glowFilter = defs.append('filter')
            .attr('id', 'glow');
        glowFilter.append('feGaussianBlur')
            .attr('stdDeviation', '3')
            .attr('result', 'coloredBlur');
        const merge = glowFilter.append('feMerge');
        merge.append('feMergeNode').attr('in', 'coloredBlur');
        merge.append('feMergeNode').attr('in', 'SourceGraphic');
        
        // Text shadow filter
        const shadowFilter = defs.append('filter')
            .attr('id', 'textShadow')
            .attr('x', '-50%')
            .attr('y', '-50%')
            .attr('width', '300%')
            .attr('height', '300%');
        shadowFilter.append('feDropShadow')
            .attr('dx', '2.5')      // 2 * 1.25 = 2.5
            .attr('dy', '2.5')      // 2 * 1.25 = 2.5  
            .attr('stdDeviation', '4') // 3 * 1.25 = 3.75 → 4
            .attr('flood-color', 'rgba(0,0,0,0.9)')
            .attr('flood-opacity', '1');
        
        // Create containers for different elements
        this.d3Container = {
            links: this.d3Svg.append('g').attr('class', 'links'),
            nodes: this.d3Svg.append('g').attr('class', 'nodes'),
            labels: this.d3Svg.append('g').attr('class', 'labels'),
            pulses: this.d3Svg.append('g').attr('class', 'pulses')
        };
        
        // Initialize with broker node
        this.createBrokerNode();
        
        // Create D3 force simulation with smoother movement (less jittery)
        this.d3Simulation = d3.forceSimulation(this.d3Nodes)
            .velocityDecay(0.75) // Increased friction/damping (0.6 + 25% = 0.75)
            .alphaDecay(0.01) // Slower cooling (default 0.0228, lower = slower settling)
            .alphaMin(0.001) // Lower minimum alpha for smoother movement
            .force('link', d3.forceLink(this.d3Links)
                .id(d => d.id)
                .distance(d => d.distance || 250)
                .strength(0.2)) // Further reduced for smoother movement
            .force('charge', d3.forceManyBody()
                .strength(-800) // Reduced repulsion for less aggressive movement
                .distanceMax(400))
            .force('center', d3.forceCenter(width / 2, height / 2)
                .strength(0.05)) // Much weaker centering force
            .force('collision', d3.forceCollide()
                .radius(d => d.radius + 25) // Slightly reduced collision radius
                .strength(0.3)) // Further reduced collision strength to allow boundary force priority
            .force('boundary', this.createBoundaryForce(width, height)) // Applied last to override other forces
            .on('tick', () => this.onSimulationTick());
        
        // Setup resize handling
        this.setupNetworkResizeHandling();
        
        // Start brightness decay system
        this.startBrightnessDecay();
    }
    
    createBrokerNode() {
        const flowWidth = window.innerWidth;
        const flowHeight = window.innerHeight;
        
        // Get broker URL from the display element and remove port
        const fullBrokerUrl = this.domElements.brokerUrl.textContent || 'BROKER';
        const brokerUrl = fullBrokerUrl.split(':')[0]; // Remove port, keep only host
        
        // Create broker node data for D3
        const brokerNode = {
            id: 'broker',
            type: 'broker',
            x: flowWidth / 2,
            y: flowHeight / 2,
            fx: flowWidth / 2, // Fix position
            fy: flowHeight / 2, // Fix position
            radius: 60,
            baseRadius: 60, // Store original radius
            color: '#4CAF50',
            label: brokerUrl,
            brightness: 1.0, // Broker stays at full brightness
            sizeScale: 1.0 // Broker stays at full size
        };
        
        // Add to D3 nodes array
        this.d3Nodes.push(brokerNode);
    }
    
    createBoundaryForce(width, height) {
        // Create strong boundary force to keep nodes within viewport - applied after other forces
        return (alpha) => {
            this.d3Nodes.forEach(node => {
                // Skip broker node (it's fixed in center)
                if (node.type === 'broker') return;
                
                // Calculate dynamic padding based on node radius plus extra margin
                const nodeRadius = node.radius || 20;
                const padding = nodeRadius + 30; // Node radius plus 30px margin
                
                // Apply strong boundary constraints that override collision forces
                // Use exponential force that gets stronger near boundaries
                if (node.x < padding) {
                    const penetration = padding - node.x;
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7); // 0.1 to 0.8
                    node.vx += penetration * alpha * forceStrength;
                    // Hard constraint: never allow position beyond boundary
                    node.x = Math.max(padding, node.x);
                }
                if (node.x > width - padding) {
                    const penetration = node.x - (width - padding);
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vx -= penetration * alpha * forceStrength;
                    // Hard constraint: never allow position beyond boundary
                    node.x = Math.min(width - padding, node.x);
                }
                if (node.y < padding) {
                    const penetration = padding - node.y;
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vy += penetration * alpha * forceStrength;
                    // Hard constraint: never allow position beyond boundary
                    node.y = Math.max(padding, node.y);
                }
                if (node.y > height - padding) {
                    const penetration = node.y - (height - padding);
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vy -= penetration * alpha * forceStrength;
                    // Hard constraint: never allow position beyond boundary
                    node.y = Math.min(height - padding, node.y);
                }
            });
        };
    }
    
    addNetworkMessage(customer, topic, messageData) {
        const color = this.getCustomerColor(customer);
        
        // Find or create customer node
        let customerNode = this.d3Nodes.find(n => n.id === customer);
        if (!customerNode) {
            customerNode = {
                id: customer,
                type: 'customer',
                radius: 45,
                baseRadius: 45, // Store original radius
                color: color,
                label: customer,
                messageCount: 0,
                brightness: 1.0, // Start at full brightness
                sizeScale: 1.0 // Start at full size
            };
            this.d3Nodes.push(customerNode);
            
            // Create link from broker to customer
            this.d3Links.push({
                source: 'broker',
                target: customer,
                distance: 250 // Increased for longer lines
            });
        }
        
        // Update customer node activity, brightness and size
        customerNode.messageCount++;
        customerNode.lastActivity = Date.now();
        customerNode.brightness = 1.0; // Full brightness on new message
        customerNode.sizeScale = 1.0; // Full size on new message
        customerNode.radius = customerNode.baseRadius * customerNode.sizeScale; // Update radius immediately
        
        // Find or create topic node (one per unique device, not per topic)
        const deviceId = this.extractDeviceFromTopic(topic);
        const topicNodeId = `${customer}-${deviceId}`;
        let topicNode = this.d3Nodes.find(n => n.id === topicNodeId);
        if (!topicNode) {
            topicNode = {
                id: topicNodeId,
                type: 'topic',
                radius: 18,
                baseRadius: 18, // Store original radius
                color: this.getTopicColor(topic),
                label: this.createTopicLabel(topic),
                customer: customer,
                deviceId: deviceId, // Store device ID for grouping
                topics: new Set([topic]), // Track all topics for this device
                messageCount: 0,
                lastActivity: Date.now(),
                brightness: 1.0, // Start at full brightness
                sizeScale: 1.0 // Start at full size
            };
            this.d3Nodes.push(topicNode);
            
            // Create link from customer to topic
            this.d3Links.push({
                source: customer,
                target: topicNodeId,
                distance: 120 // Increased from 80 for longer lines
            });
        }
        
        // Update topic node activity, brightness and size (don't create new nodes, just update existing)
        // Add this topic to the set of topics handled by this device node
        topicNode.topics.add(topic);
        topicNode.messageCount++;
        topicNode.lastActivity = Date.now();
        topicNode.brightness = 1.0; // Full brightness on new message
        topicNode.sizeScale = 1.0; // Full size on new message
        topicNode.radius = topicNode.baseRadius * topicNode.sizeScale; // Update radius immediately
        
        // Clean up old topic nodes that haven't received messages recently
        this.cleanupOldTopics();
        
        // Immediately update visual properties for instant brightness/size reset
        this.updateNodeVisualProperties();
    }
    
    startBrightnessDecay() {
        // Update brightness 10x per second for smoother transitions
        this.brightnessInterval = setInterval(() => {
            this.updateNodeBrightness();
            this.updateMessageBubbleBrightness();
        }, 100);
    }
    
    updateNodeBrightness() {
        const now = Date.now();
        const decayRate = 0.005; // Decreases by 0.5% per update (5% per second at 10Hz)
        const minBrightness = 0.2; // Minimum 20% brightness
        const minSizeScale = 0.5; // Minimum 50% size
        
        let updated = false;
        
        this.d3Nodes.forEach(node => {
            // Skip broker node - it stays at full brightness and size
            if (node.type === 'broker') return;
            
            // Calculate time since last activity (in 0.1 second units for smoother updates)
            const timeSinceActivity = (now - node.lastActivity) / 100;
            
            // Decay brightness and size over time (start after 10 updates = 1 second)
            if (timeSinceActivity > 10) {
                const newBrightness = Math.max(minBrightness, 1.0 - ((timeSinceActivity - 10) * decayRate));
                const newSizeScale = Math.max(minSizeScale, 1.0 - ((timeSinceActivity - 10) * decayRate));
                
                // Use smaller threshold for smoother interpolation
                if (Math.abs(node.brightness - newBrightness) > 0.005) {
                    node.brightness = newBrightness;
                    updated = true;
                }
                
                if (Math.abs(node.sizeScale - newSizeScale) > 0.005) {
                    node.sizeScale = newSizeScale;
                    // Update actual radius used by simulation
                    node.radius = node.baseRadius * newSizeScale;
                    updated = true;
                }
            }
        });
        
        // Update visual elements if brightness or size changed
        if (updated) {
            this.updateNodeVisualProperties();
        }
    }
    
    updateNodeVisualProperties() {
        // Update visual brightness and size of nodes
        this.d3Container.nodes.selectAll('g.node circle')
            .style('opacity', d => d.brightness)
            .attr('r', d => d.radius); // Update radius
            
        this.d3Container.nodes.selectAll('g.node text')
            .style('opacity', d => d.brightness * 0.9); // Text slightly dimmer
    }
    
    updateMessageBubbleBrightness() {
        // Update brightness and smooth scaling for message bubbles in bubbles and radial modes
        if (this.visualizationMode !== 'bubbles' && this.visualizationMode !== 'radial') {
            return;
        }
        
        const now = Date.now();
        const bubbles = this.domElements.messageFlow.querySelectorAll('.message-bubble[data-brightness]');
        
        bubbles.forEach(bubble => {
            const createdAt = parseInt(bubble.dataset.createdAt || '0');
            const currentBrightness = parseFloat(bubble.dataset.brightness || '1.0');
            const currentScale = parseFloat(bubble.dataset.scale || '1.0');
            
            // Calculate age in seconds
            const ageInSeconds = (now - createdAt) / 1000;
            
            // Gradually decrease brightness after 2 seconds
            let targetBrightness = 1.0;
            if (ageInSeconds > 2) {
                // Decrease brightness by 40% over 10 seconds, minimum 60%
                const decayProgress = Math.min((ageInSeconds - 2) / 10, 1);
                targetBrightness = Math.max(0.6, 1.0 - (decayProgress * 0.4));
            }
            
            // For radial mode, gradually increase scale based on age
            let targetScale = 0.3;
            if (this.visualizationMode === 'radial' && ageInSeconds > 0.5) {
                // Gradually increase scale from 0.3 to 1.5 over 8 seconds
                const scaleProgress = Math.min((ageInSeconds - 0.5) / 8, 1);
                targetScale = 0.3 + (scaleProgress * 1.2); // 0.3 + 1.2 = 1.5 maximum
            }
            
            // Smooth interpolation (move 15% towards target each update for smoother transitions)
            const newBrightness = currentBrightness + (targetBrightness - currentBrightness) * 0.15;
            const newScale = currentScale + (targetScale - currentScale) * 0.15;
            
            // Update brightness if change is significant enough
            if (Math.abs(newBrightness - currentBrightness) > 0.01) {
                bubble.dataset.brightness = newBrightness.toFixed(3);
                bubble.style.filter = `brightness(${newBrightness})`;
            }
            
            // Update scale if change is significant enough
            if (Math.abs(newScale - currentScale) > 0.01) {
                bubble.dataset.scale = newScale.toFixed(3);
                bubble.style.transform = `scale(${newScale})`;
            }
        });
    }
    
    updateD3Simulation() {
        if (!this.d3Simulation) return;
        
        // Update simulation with new data
        this.d3Simulation.nodes(this.d3Nodes);
        this.d3Simulation.force('link').links(this.d3Links);
        
        // Restart simulation
        this.d3Simulation.alpha(0.3).restart();
        
        // Update visual elements
        this.updateD3Visuals();
    }
    
    onSimulationTick() {
        // Enforce hard boundary constraints before updating visuals
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.d3Nodes.forEach(node => {
            if (node.type === 'broker') return; // Skip broker (fixed in center)
            
            const nodeRadius = node.radius || 20;
            const padding = nodeRadius + 30;
            
            // Hard boundary enforcement - never allow nodes to go off screen
            node.x = Math.max(padding, Math.min(width - padding, node.x));
            node.y = Math.max(padding, Math.min(height - padding, node.y));
        });
        
        // Update node positions
        const nodeGroups = this.d3Container.nodes.selectAll('g.node')
            .data(this.d3Nodes, d => d.id);
        
        nodeGroups.select('circle')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
            
        const textElements = nodeGroups.select('text')
            .attr('x', d => d.x)
            .attr('y', d => d.y + d.radius + 25); // Position below circle: radius + 25px margin
            
        // Update tspan positions to match their parent node
        textElements.selectAll('tspan')
            .attr('x', function() {
                const parentNode = d3.select(this.parentNode).datum();
                return parentNode.x;
            });
        
        // Update link positions
        this.d3Container.links.selectAll('line')
            .data(this.d3Links)
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
    }
    
    updateD3Visuals() {
        // Update nodes
        const nodeGroups = this.d3Container.nodes.selectAll('g.node')
            .data(this.d3Nodes, d => d.id);
        
        // Enter new nodes
        const nodeEnter = nodeGroups.enter()
            .append('g')
            .attr('class', 'node')
            .attr('id', d => `node-${d.id}`);
        
        // Add circles with initial positions, brightness and size
        nodeEnter.append('circle')
            .attr('r', d => d.radius) // Uses current radius (baseRadius * sizeScale)
            .attr('cx', d => d.x || 0)
            .attr('cy', d => d.y || 0)
            .attr('fill', d => d.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', d => d.type === 'broker' ? 3 : 2)
            .attr('filter', 'url(#glow)')
            .style('opacity', d => d.brightness || 1.0);
        
        // Add labels with initial positions and brightness
        const textElements = nodeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('x', d => d.x || 0)
            .attr('y', d => (d.y || 0) + (d.radius || 20) + 25) // Position below circle: radius + 25px margin
            .attr('fill', 'white')
            .attr('font-size', d => {
                if (d.type === 'broker') return '23px';  // 15px * 1.5 = 22.5px → 23px
                if (d.type === 'customer') return '20px';  // 13px * 1.5 = 19.5px → 20px
                if (d.type === 'topic') return '15px';     // 10px * 1.5 = 15px
                return '7px';
            })
            .attr('font-weight', d => d.type === 'broker' ? 'bold' : 'normal')
            .attr('filter', 'url(#textShadow)')
            .style('opacity', d => (d.brightness || 1.0) * 0.9);
        
        // Handle multi-line labels with tspan elements
        textElements.each(function(d) {
            const textElement = d3.select(this);
            const lines = d.label.split('\n');
            const lineHeight = d.type === 'topic' ? 16 : 20; // Adjust line height based on node type
            
            lines.forEach((line, index) => {
                textElement.append('tspan')
                    .attr('x', 0) // Use relative positioning, parent text element handles absolute position
                    .attr('dy', index === 0 ? 0 : lineHeight)
                    .text(line);
            });
        });
        
        // Remove old nodes
        nodeGroups.exit().remove();
        
        // Update links
        const linkSelection = this.d3Container.links.selectAll('line')
            .data(this.d3Links);
        
        // Enter new links
        linkSelection.enter()
            .append('line')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);
        
        // Remove old links
        linkSelection.exit().remove();
    }
    
    createD3Pulse(customer, topic) {
        // Create pulse animation from broker to customer to topic
        const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
        const customerNode = this.d3Nodes.find(n => n.id === customer);
        const deviceId = this.extractDeviceFromTopic(topic);
        const topicNodeId = `${customer}-${deviceId}`;
        const topicNode = this.d3Nodes.find(n => n.id === topicNodeId);
        
        if (!brokerNode || !customerNode) return;
        
        // Create pulse circle
        const pulse = this.d3Container.pulses.append('circle')
            .attr('r', 6)  // 4 * 1.5 = 6
            .attr('fill', customerNode.color)
            .attr('cx', brokerNode.x)
            .attr('cy', brokerNode.y)
            .attr('opacity', 0.8);
        
        // Animate from broker to customer
        pulse.transition()
            .duration(800)
            .attr('cx', customerNode.x)
            .attr('cy', customerNode.y)
            .on('end', () => {
                if (topicNode) {
                    // Continue pulse to topic node
                    pulse.transition()
                        .duration(400)
                        .attr('cx', topicNode.x)
                        .attr('cy', topicNode.y)
                        .attr('opacity', 0)
                        .remove();
                } else {
                    // Topic node doesn't exist yet, just fade out at customer
                    pulse.transition()
                        .duration(200)
                        .attr('opacity', 0)
                        .remove();
                }
            });
    }
    
    cleanupOldTopics() {
        const maxAge = 300000; // 5 minutes - much longer to keep topics visible
        const now = Date.now();
        
        // Find old topic nodes that haven't received messages recently
        const oldTopics = this.d3Nodes.filter(n => 
            n.type === 'topic' && (now - n.lastActivity) > maxAge
        );
        
        // Remove old topics and their links
        oldTopics.forEach(topicNode => {
            console.log('Removing old topic node:', topicNode.id);
            
            // Remove from nodes array
            const nodeIndex = this.d3Nodes.findIndex(n => n.id === topicNode.id);
            if (nodeIndex !== -1) {
                this.d3Nodes.splice(nodeIndex, 1);
            }
            
            // Remove associated links (D3 converts source/target to objects after simulation starts)
            this.d3Links = this.d3Links.filter(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                const shouldKeep = sourceId !== topicNode.id && targetId !== topicNode.id;
                if (!shouldKeep) {
                    console.log('Removing link:', sourceId, '->', targetId);
                }
                return shouldKeep;
            });
        });
        
        // If we removed any topics, update the simulation
        if (oldTopics.length > 0) {
            this.updateD3Simulation();
        }
    }
    
    // Legacy method - no longer used with D3.js implementation
    updateCustomerNode(customer, messageData) {
        // This method is no longer used - functionality moved to addNetworkMessage()
        return;
        
        if (!this.networkNodes.has(customer)) {
            // Create new customer node with proper radial positioning
            const nodeCount = this.networkNodes.size;
            const angle = (nodeCount * 2 * Math.PI) / Math.max(1, nodeCount + 1);
            const flowWidth = this.domElements.messageFlow.clientWidth;
            const flowHeight = this.domElements.messageFlow.clientHeight;
            // Scale distance based on screen size - reduced for shorter lines
            const distance = Math.min(flowWidth, flowHeight) * 0.35;
            
            const node = {
                x: this.brokerNode.x + Math.cos(angle) * distance,
                y: this.brokerNode.y + Math.sin(angle) * distance,
                radius: 45, // Scaled up for full screen (increased by 50%)
                color: color,
                customer: customer,
                messageCount: 0,
                lastActivity: Date.now(),
                element: null,
                topics: new Set(),
                targetX: this.brokerNode.x + Math.cos(angle) * distance,
                targetY: this.brokerNode.y + Math.sin(angle) * distance
            };
            
            this.createCustomerNodeElement(node);
            this.networkNodes.set(customer, node);
            
            // Create connection to broker
            this.createConnection(this.brokerNode, node, color);
            
            // Redistribute all customer nodes for even spacing
            this.redistributeCustomerNodes();
        }
        
        // Update activity
        const node = this.networkNodes.get(customer);
        node.messageCount++;
        node.lastActivity = Date.now();
        node.topics.add(messageData.topic);
    }
    
    createMessageCircle(messageData) {
        const customer = this.extractCustomerFromTopic(messageData.topic);
        const customerNode = this.networkNodes.get(customer);
        
        if (!customerNode) {
            console.log('No customer node found for:', customer);
            return;
        }
        
        const topic = messageData.topic;
        const messageId = `${customer}-${topic}-${Date.now()}`;
        
        // Get or create topic ring for this customer
        if (!customerNode.topicRings) {
            customerNode.topicRings = new Map();
        }
        
        let topicRing = customerNode.topicRings.get(topic);
        if (!topicRing) {
            // Create new ring for this topic
            const ringIndex = customerNode.topicRings.size;
            topicRing = {
                topic: topic,
                distance: 80 + (ringIndex * 50), // Each topic gets its own ring - scaled up
                messages: [],
                color: this.getTopicColor(topic)
            };
            customerNode.topicRings.set(topic, topicRing);
            console.log(`Created new topic ring for ${topic} at distance ${topicRing.distance}`);
        }
        
        // Create message circle
        const messageCircle = this.createMessageCircleElement(messageData, customerNode, topicRing);
        
        // Add to topic ring
        topicRing.messages.push(messageCircle);
        
        // Store the message circle for tracking
        this.networkMessages.set(`${customer}-${topic}-${messageCircle.createdAt}`, messageCircle);
        
        // Position circle in the ring
        this.positionMessageInRing(customerNode, topicRing);
        
        console.log(`Total message circles for ${customer}: ${topicRing.messages.length}`);
        
        // Remove old messages if too many (keep last 8 per topic)
        if (topicRing.messages.length > 8) {
            const oldMessage = topicRing.messages.shift();
            if (oldMessage.element && oldMessage.element.parentNode) {
                oldMessage.element.parentNode.removeChild(oldMessage.element);
                // Remove from network messages tracking
                this.networkMessages.forEach((msg, key) => {
                    if (msg === oldMessage) {
                        this.networkMessages.delete(key);
                    }
                });
                console.log('Removed old message circle'); // Debug log
            }
        }
    }
    
    createMessageCircleElement(messageData, customerNode, topicRing) {
        // Create circle directly (no group wrapper for simplicity)
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.className = 'message-circle';
        circle.setAttribute('r', '10'); // Even larger for better visibility
        circle.setAttribute('fill', topicRing.color);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('opacity', '1'); // Full opacity
        circle.setAttribute('filter', 'url(#glow)');
        
        // Calculate initial position for the message circle
        const messageCount = topicRing.messages.length;
        const angle = (messageCount * 2 * Math.PI) / Math.max(messageCount + 1, 1);
        const initialX = customerNode.x + Math.cos(angle) * topicRing.distance;
        const initialY = customerNode.y + Math.sin(angle) * topicRing.distance;
        
        // Set initial position
        circle.setAttribute('cx', initialX);
        circle.setAttribute('cy', initialY);
        
        // Add click handler for message details
        circle.style.cursor = 'pointer';
        circle.addEventListener('click', () => {
            this.showMessageModal(messageData);
        });
        
        // Add to SVG - ensure it's visible
        this.networkSvg.querySelector('#nodes').appendChild(circle);
        
        console.log(`Created message circle at (${initialX}, ${initialY}) for topic ${topicRing.topic}`); // Debug log
        
        const messageCircle = {
            element: circle,
            circle: circle,
            messageData: messageData,
            customer: customerNode.customer,
            topic: topicRing.topic,
            x: initialX,
            y: initialY,
            angle: angle,
            createdAt: Date.now()
        };
        
        return messageCircle;
    }
    
    positionMessageInRing(customerNode, topicRing) {
        const messageCount = topicRing.messages.length;
        
        topicRing.messages.forEach((messageCircle, index) => {
            // Distribute messages evenly around the ring
            const angle = (index * 2 * Math.PI) / Math.max(messageCount, 1);
            const x = customerNode.x + Math.cos(angle) * topicRing.distance;
            const y = customerNode.y + Math.sin(angle) * topicRing.distance;
            
            messageCircle.x = x;
            messageCircle.y = y;
            messageCircle.angle = angle;
            
            // Update visual position with smooth animation
            this.animateMessageCircle(messageCircle, x, y);
        });
    }
    
    animateMessageCircle(messageCircle, targetX, targetY) {
        const startX = parseFloat(messageCircle.circle.getAttribute('cx')) || messageCircle.x;
        const startY = parseFloat(messageCircle.circle.getAttribute('cy')) || messageCircle.y;
        
        // Skip animation if already at target position
        const dx = Math.abs(targetX - startX);
        const dy = Math.abs(targetY - startY);
        if (dx < 1 && dy < 1) {
            return;
        }
        
        const duration = 300;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeInOutCubic(progress);
            
            const currentX = startX + (targetX - startX) * easeProgress;
            const currentY = startY + (targetY - startY) * easeProgress;
            
            messageCircle.circle.setAttribute('cx', currentX);
            messageCircle.circle.setAttribute('cy', currentY);
            
            // Update stored position
            messageCircle.x = currentX;
            messageCircle.y = currentY;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    createCustomerNodeElement(node) {
        const customerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        customerGroup.id = `customer-${node.customer}`;
        
        const customerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        customerCircle.setAttribute('cx', node.x);
        customerCircle.setAttribute('cy', node.y);
        customerCircle.setAttribute('r', node.radius);
        customerCircle.setAttribute('fill', node.color);
        customerCircle.setAttribute('stroke', '#fff');
        customerCircle.setAttribute('stroke-width', '2');
        customerCircle.setAttribute('opacity', '0.9');
        
        const customerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        customerText.setAttribute('x', node.x);
        customerText.setAttribute('y', node.y + 3);
        customerText.setAttribute('text-anchor', 'middle');
        customerText.setAttribute('fill', 'white');
        customerText.setAttribute('font-size', '18');  // 12px * 1.5 = 18px
        customerText.setAttribute('font-weight', 'bold');
        customerText.setAttribute('filter', 'url(#textShadow)');
        customerText.textContent = node.customer.toUpperCase().substring(0, 6);
        
        customerGroup.appendChild(customerCircle);
        customerGroup.appendChild(customerText);
        
        // Add click handler
        customerGroup.style.cursor = 'pointer';
        customerGroup.addEventListener('click', () => {
            this.showNetworkNodeDetails(node);
        });
        
        this.networkSvg.querySelector('#nodes').appendChild(customerGroup);
        node.element = customerGroup;
    }
    
    updateTopicNode(topic, customer) {
        const topicKey = `${customer}:${topic}`;
        
        if (!this.networkTopics.has(topicKey)) {
            // Create new topic node with dynamic positioning
            const customerNode = this.networkNodes.get(customer);
            const flowWidth = this.domElements.messageFlow.clientWidth;
            const flowHeight = this.domElements.messageFlow.clientHeight;
            // Scale topic distance based on screen size - reduced for shorter lines
            const distance = Math.min(flowWidth, flowHeight) * 0.10;
            
            // Find optimal position with collision avoidance
            const optimalPosition = this.findOptimalTopicPosition(customerNode, distance, customer);
            
            const topicNode = {
                x: optimalPosition.x,
                y: optimalPosition.y,
                radius: 18, // Increased from 8 (50% bigger)
                color: customerNode.color,
                topic: topic,
                customer: customer,
                messageCount: 0,
                lastActivity: Date.now(),
                element: null,
                targetX: optimalPosition.x, // For smooth animations
                targetY: optimalPosition.y
            };
            
            this.createTopicNodeElement(topicNode);
            this.networkTopics.set(topicKey, topicNode);
            
            // Create connection from customer to topic
            this.createConnection(customerNode, topicNode, customerNode.color);
            
            // Shift existing nodes to make room if needed
            this.optimizeTopicLayout(customer);
        }
        
        // Update activity
        const topicNode = this.networkTopics.get(topicKey);
        topicNode.messageCount++;
        topicNode.lastActivity = Date.now();
    }
    
    createTopicNodeElement(node) {
        const topicGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        topicGroup.id = `topic-${node.customer}-${node.topic.replace(/[^a-zA-Z0-9]/g, '')}`;
        
        const topicCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        topicCircle.setAttribute('cx', node.x);
        topicCircle.setAttribute('cy', node.y);
        topicCircle.setAttribute('r', node.radius);
        topicCircle.setAttribute('fill', node.color);
        topicCircle.setAttribute('stroke', '#fff');
        topicCircle.setAttribute('stroke-width', '1');
        topicCircle.setAttribute('opacity', '0.8');
        
        topicGroup.appendChild(topicCircle);
        
        // Add click handler
        topicGroup.style.cursor = 'pointer';
        topicGroup.addEventListener('click', () => {
            this.showTopicDetails(node);
        });
        
        this.networkSvg.querySelector('#nodes').appendChild(topicGroup);
        node.element = topicGroup;
    }
    
    createConnection(fromNode, toNode, color) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromNode.x);
        line.setAttribute('y1', fromNode.y);
        line.setAttribute('x2', toNode.x);
        line.setAttribute('y2', toNode.y);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '2');
        line.setAttribute('opacity', '0.3');
        line.id = `connection-${fromNode.customer || 'broker'}-${toNode.customer || toNode.topic || 'broker'}`;
        
        this.networkSvg.querySelector('#connections').appendChild(line);
    }
    
    createNetworkPulse(customer, topic, messageData) {
        const customerNode = this.networkNodes.get(customer);
        
        if (!customerNode) return;
        
        // Create pulse from broker to customer
        this.createPulseAlongPath(this.brokerNode, customerNode, customerNode.color);
        
        // Find the specific message circle for this topic
        setTimeout(() => {
            if (customerNode.topicRings && customerNode.topicRings.has(topic)) {
                const topicRing = customerNode.topicRings.get(topic);
                // Get the most recently added message circle
                const latestMessage = topicRing.messages[topicRing.messages.length - 1];
                
                if (latestMessage) {
                    // Create pulse from customer to the specific message circle
                    this.createPulseAlongPath(customerNode, latestMessage, customerNode.color);
                }
            }
        }, 400); // Delay to let the first pulse reach the customer
    }
    
    createPulseAlongPath(fromNode, toNode, color) {
        const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pulse.setAttribute('r', '12'); // Larger for full screen visibility (8 * 1.5 = 12)
        pulse.setAttribute('fill', color);
        pulse.setAttribute('opacity', '0.9');
        pulse.setAttribute('filter', 'url(#glow)');
        
        this.networkSvg.querySelector('#pulses').appendChild(pulse);
        
        // Calculate collision-avoiding path
        const pathPoints = this.calculateCollisionFreePath(fromNode, toNode);
        
        const startTime = Date.now();
        const duration = 1000; // Slightly longer for curved paths
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Calculate position along curved path
            const position = this.getPositionAlongPath(pathPoints, progress);
            
            pulse.setAttribute('cx', position.x);
            pulse.setAttribute('cy', position.y);
            
            // Fade out near the end
            const opacity = progress < 0.8 ? 0.9 : 0.9 * (1 - (progress - 0.8) / 0.2);
            pulse.setAttribute('opacity', opacity);
            
            // Scale pulse during animation for visual effect
            const scale = 0.8 + (Math.sin(progress * Math.PI) * 0.4);
            pulse.setAttribute('r', 12 * scale);  // Base size increased from 8 to 12
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Remove pulse when animation completes
                if (pulse.parentNode) {
                    pulse.parentNode.removeChild(pulse);
                }
            }
        };
        
        animate();
    }
    
    calculateCollisionFreePath(fromNode, toNode) {
        const startX = fromNode.x;
        const startY = fromNode.y;
        const endX = toNode.x;
        const endY = toNode.y;
        
        // Get all potential obstacle nodes
        const obstacles = this.getAllObstacleNodes(fromNode, toNode);
        
        // Start with direct path
        let pathPoints = [
            { x: startX, y: startY },
            { x: endX, y: endY }
        ];
        
        // Check if direct path has collisions
        const collisions = this.findPathCollisions(pathPoints, obstacles);
        
        if (collisions.length > 0) {
            // Calculate curved path around obstacles
            pathPoints = this.calculateCurvedPath(startX, startY, endX, endY, obstacles);
        }
        
        return pathPoints;
    }
    
    getAllObstacleNodes(fromNode, toNode) {
        const obstacles = [];
        const pulseRadius = 5;
        const clearanceDistance = 40; // Minimum clearance around nodes for full screen
        
        // Add all customer nodes (except the ones we're traveling between)
        this.networkNodes.forEach((node) => {
            if (node !== fromNode && node !== toNode) {
                obstacles.push({
                    x: node.x,
                    y: node.y,
                    radius: node.radius + clearanceDistance
                });
            }
        });
        
        // Add all topic nodes (except the ones we're traveling between)
        this.networkTopics.forEach((node) => {
            if (node !== fromNode && node !== toNode) {
                obstacles.push({
                    x: node.x,
                    y: node.y,
                    radius: node.radius + clearanceDistance
                });
            }
        });
        
        // Add broker node if it's not one of the endpoints
        if (this.brokerNode !== fromNode && this.brokerNode !== toNode) {
            obstacles.push({
                x: this.brokerNode.x,
                y: this.brokerNode.y,
                radius: this.brokerNode.radius + clearanceDistance
            });
        }
        
        return obstacles;
    }
    
    findPathCollisions(pathPoints, obstacles) {
        const collisions = [];
        
        for (let i = 0; i < pathPoints.length - 1; i++) {
            const start = pathPoints[i];
            const end = pathPoints[i + 1];
            
            for (const obstacle of obstacles) {
                const distance = this.pointToLineDistance(obstacle.x, obstacle.y, start.x, start.y, end.x, end.y);
                if (distance < obstacle.radius) {
                    collisions.push({
                        obstacle: obstacle,
                        segmentStart: start,
                        segmentEnd: end,
                        distance: distance
                    });
                }
            }
        }
        
        return collisions;
    }
    
    calculateCurvedPath(startX, startY, endX, endY, obstacles) {
        const pathPoints = [{ x: startX, y: startY }];
        
        // Find the main obstacle to avoid (closest to straight line)
        const directDx = endX - startX;
        const directDy = endY - startY;
        const directDistance = Math.sqrt(directDx * directDx + directDy * directDy);
        
        let mainObstacle = null;
        let minDistance = Infinity;
        
        for (const obstacle of obstacles) {
            const distToLine = this.pointToLineDistance(obstacle.x, obstacle.y, startX, startY, endX, endY);
            if (distToLine < obstacle.radius && distToLine < minDistance) {
                minDistance = distToLine;
                mainObstacle = obstacle;
            }
        }
        
        if (mainObstacle) {
            // Calculate waypoints around the obstacle
            const waypoints = this.calculateWaypoints(startX, startY, endX, endY, mainObstacle);
            pathPoints.push(...waypoints);
        }
        
        pathPoints.push({ x: endX, y: endY });
        
        return pathPoints;
    }
    
    calculateWaypoints(startX, startY, endX, endY, obstacle) {
        const waypoints = [];
        
        // Vector from start to end
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Unit vector perpendicular to the line
        const perpX = -dy / distance;
        const perpY = dx / distance;
        
        // Determine which side of the obstacle to go around
        const obstacleToStart = {
            x: startX - obstacle.x,
            y: startY - obstacle.y
        };
        
        // Use cross product to determine which side
        const cross = obstacleToStart.x * perpY - obstacleToStart.y * perpX;
        const side = cross > 0 ? 1 : -1;
        
        // Calculate waypoint around the obstacle
        const avoidanceRadius = obstacle.radius * 1.2; // 20% extra clearance
        const waypointX = obstacle.x + (perpX * side * avoidanceRadius);
        const waypointY = obstacle.y + (perpY * side * avoidanceRadius);
        
        waypoints.push({ x: waypointX, y: waypointY });
        
        return waypoints;
    }
    
    getPositionAlongPath(pathPoints, progress) {
        if (pathPoints.length < 2) {
            return pathPoints[0] || { x: 0, y: 0 };
        }
        
        if (progress <= 0) return pathPoints[0];
        if (progress >= 1) return pathPoints[pathPoints.length - 1];
        
        // Calculate total path length
        let totalLength = 0;
        const segmentLengths = [];
        
        for (let i = 0; i < pathPoints.length - 1; i++) {
            const dx = pathPoints[i + 1].x - pathPoints[i].x;
            const dy = pathPoints[i + 1].y - pathPoints[i].y;
            const length = Math.sqrt(dx * dx + dy * dy);
            segmentLengths.push(length);
            totalLength += length;
        }
        
        // Find which segment the progress point is in
        const targetDistance = progress * totalLength;
        let currentDistance = 0;
        
        for (let i = 0; i < segmentLengths.length; i++) {
            if (currentDistance + segmentLengths[i] >= targetDistance) {
                // Interpolate within this segment
                const segmentProgress = (targetDistance - currentDistance) / segmentLengths[i];
                const start = pathPoints[i];
                const end = pathPoints[i + 1];
                
                return {
                    x: start.x + (end.x - start.x) * segmentProgress,
                    y: start.y + (end.y - start.y) * segmentProgress
                };
            }
            currentDistance += segmentLengths[i];
        }
        
        // Fallback to last point
        return pathPoints[pathPoints.length - 1];
    }
    
    updateNodeActivity() {
        const now = Date.now();
        const inactiveTime = 10000; // 10 seconds
        
        // Update customer nodes
        this.networkNodes.forEach((node) => {
            const timeSinceActivity = now - node.lastActivity;
            const activityLevel = Math.max(0, 1 - (timeSinceActivity / inactiveTime));
            
            // Update node size based on activity
            const baseRadius = 45;
            const maxRadius = 45;
            const currentRadius = baseRadius + (maxRadius - baseRadius) * activityLevel;
            
            const circle = node.element.querySelector('circle');
            if (circle) {
                circle.setAttribute('r', currentRadius);
                circle.setAttribute('opacity', 0.7 + activityLevel * 0.3);
            }
        });
        
        // Update topic nodes
        this.networkTopics.forEach((node) => {
            const timeSinceActivity = now - node.lastActivity;
            const activityLevel = Math.max(0, 1 - (timeSinceActivity / inactiveTime));
            
            const baseRadius = 18;
            const maxRadius = 18;
            const currentRadius = baseRadius + (maxRadius - baseRadius) * activityLevel;
            
            const circle = node.element.querySelector('circle');
            if (circle) {
                circle.setAttribute('r', currentRadius);
                circle.setAttribute('opacity', 0.6 + activityLevel * 0.4);
            }
        });
    }
    
    showNetworkNodeDetails(node) {
        const modalData = {
            topic: `Customer: ${node.customer}`,
            payload: `Messages: ${node.messageCount}\nTopics: ${node.topics.size}\nLast Activity: ${new Date(node.lastActivity).toLocaleString()}`,
            timestamp: node.lastActivity / 1000,
            qos: 'N/A',
            retain: false
        };
        this.showMessageModal(modalData);
    }
    
    showTopicDetails(node) {
        const modalData = {
            topic: node.topic,
            payload: `Customer: ${node.customer}\nMessages: ${node.messageCount}\nLast Activity: ${new Date(node.lastActivity).toLocaleString()}`,
            timestamp: node.lastActivity / 1000,
            qos: 'N/A',
            retain: false
        };
        this.showMessageModal(modalData);
    }
    
    redistributeCustomerNodes() {
        if (this.networkNodes.size <= 1) return;
        
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        const distance = Math.min(flowWidth, flowHeight) * 0.18;
        const totalNodes = this.networkNodes.size;
        
        let nodeIndex = 0;
        this.networkNodes.forEach((node) => {
            // Calculate new angle for even distribution
            const angle = (nodeIndex * 2 * Math.PI) / totalNodes;
            
            // Calculate new position
            const newX = this.brokerNode.x + Math.cos(angle) * distance;
            const newY = this.brokerNode.y + Math.sin(angle) * distance;
            
            // Only animate if there's a significant change
            const dx = Math.abs(newX - node.x);
            const dy = Math.abs(newY - node.y);
            
            if (dx > 5 || dy > 5) {
                node.targetX = newX;
                node.targetY = newY;
                
                // Smooth animation to new position
                this.animateCustomerNode(node);
            }
            
            nodeIndex++;
        });
        
        // Update all connections after redistribution
        setTimeout(() => {
            this.updateNetworkConnections();
        }, 300);
    }
    
    animateCustomerNode(node) {
        const duration = 400;
        const startTime = Date.now();
        const startX = node.x;
        const startY = node.y;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeInOutCubic(progress);
            
            // Interpolate position
            node.x = startX + (node.targetX - startX) * easeProgress;
            node.y = startY + (node.targetY - startY) * easeProgress;
            
            // Update visual position
            const circle = node.element.querySelector('circle');
            const text = node.element.querySelector('text');
            if (circle) {
                circle.setAttribute('cx', node.x);
                circle.setAttribute('cy', node.y);
            }
            if (text) {
                text.setAttribute('x', node.x);
                text.setAttribute('y', node.y + 3);
            }
            
            // Update message circles that orbit this customer node
            this.updateCustomerMessageCircles(node);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Update connections when animation completes
                this.updateNetworkConnections();
            }
        };
        
        animate();
    }
    
    updateCustomerMessageCircles(customerNode) {
        if (!customerNode.topicRings) return;
        
        // Update positions of all message circles for this customer
        customerNode.topicRings.forEach((topicRing) => {
            this.positionMessageInRing(customerNode, topicRing);
        });
    }
    
    // Dynamic positioning methods
    findOptimalTopicPosition(customerNode, distance, customer) {
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        const minSpacing = 60; // Increased for full screen scale
        
        // Get ALL existing nodes (not just for this customer)
        const allNodes = [
            ...Array.from(this.networkTopics.values()),
            ...Array.from(this.networkNodes.values()),
            this.brokerNode
        ];
        
        // Try different distances and angles to find a non-colliding position
        const maxDistance = Math.min(flowWidth, flowHeight) * 0.15;
        let bestPosition = null;
        let bestScore = -1;
        
        // Try multiple distance rings
        for (let distanceRing = distance; distanceRing <= maxDistance; distanceRing += 20) {
            // Try more angles for better coverage
            const angleStep = Math.PI / 12; // 15 degrees
            
            for (let i = 0; i < 24; i++) { // Try 24 positions around each circle
                const angle = i * angleStep;
                const testX = customerNode.x + Math.cos(angle) * distanceRing;
                const testY = customerNode.y + Math.sin(angle) * distanceRing;
                
                // Check bounds with larger margin
                if (testX < 80 || testX > flowWidth - 80 || testY < 80 || testY > flowHeight - 80) {
                    continue;
                }
                
                // Calculate collision score (higher is better)
                let score = this.calculateAdvancedPositionScore(testX, testY, minSpacing, allNodes, customerNode);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestPosition = { x: testX, y: testY };
                    
                    // If we found a really good position, use it
                    if (score > 80) {
                        return bestPosition;
                    }
                }
            }
        }
        
        // If still no good position found, force one by pushing others away
        if (!bestPosition || bestScore < 20) {
            bestPosition = this.forceNonOverlappingPosition(customerNode, distance, allNodes, minSpacing);
        }
        
        return bestPosition;
    }
    
    calculatePositionScore(x, y, minSpacing, existingNodes, customerNode) {
        // Legacy method - kept for compatibility but not used for new positioning
        return this.calculateAdvancedPositionScore(x, y, minSpacing, existingNodes, customerNode);
    }
    
    calculateAdvancedPositionScore(x, y, minSpacing, allNodes, customerNode) {
        let score = 100; // Base score
        
        // Check distance to ALL existing nodes
        for (const node of allNodes) {
            if (node === customerNode) continue; // Skip the parent customer node
            
            const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            const nodeRadius = node.radius || 8;
            const effectiveMinSpacing = minSpacing + nodeRadius;
            
            if (dist < effectiveMinSpacing) {
                // Heavy penalty for collision, exponentially worse for closer distances
                score -= Math.pow((effectiveMinSpacing - dist) / effectiveMinSpacing, 2) * 50;
            } else {
                // Bonus for good spacing, but diminishing returns
                score += Math.min(15, (dist - effectiveMinSpacing) * 0.5);
            }
        }
        
        // Extra penalty for being too close to connection lines
        score -= this.calculateLineCollisionPenalty(x, y, minSpacing);
        
        // Bonus for being in a less crowded area
        score += this.calculateCrowdingBonus(x, y, allNodes, minSpacing * 2);
        
        // Bonus for outward positioning from center (favor directions away from center)
        score += this.calculateOutwardPositionBonus(x, y, customerNode);
        
        return score;
    }
    
    calculateLineCollisionPenalty(x, y, minSpacing) {
        let penalty = 0;
        const lineBuffer = minSpacing * 0.6; // Lines need some clearance too
        
        // Check distance to all existing connections
        this.networkNodes.forEach((customerNode) => {
            // Check customer-to-broker line
            const lineDist = this.pointToLineDistance(x, y, customerNode.x, customerNode.y, this.brokerNode.x, this.brokerNode.y);
            if (lineDist < lineBuffer) {
                penalty += (lineBuffer - lineDist) * 2;
            }
            
            // Check customer-to-topic lines
            this.networkTopics.forEach((topicNode) => {
                if (topicNode.customer === customerNode.customer) {
                    const topicLineDist = this.pointToLineDistance(x, y, customerNode.x, customerNode.y, topicNode.x, topicNode.y);
                    if (topicLineDist < lineBuffer) {
                        penalty += (lineBuffer - topicLineDist) * 1.5;
                    }
                }
            });
        });
        
        return penalty;
    }
    
    calculateCrowdingBonus(x, y, allNodes, radius) {
        let nodesInArea = 0;
        for (const node of allNodes) {
            const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            if (dist < radius) {
                nodesInArea++;
            }
        }
        
        // Bonus for less crowded areas (inverse relationship)
        return Math.max(0, 10 - nodesInArea * 2);
    }
    
    calculateOutwardPositionBonus(x, y, customerNode) {
        // Get screen dimensions to find center
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        const centerX = flowWidth / 2;
        const centerY = flowHeight / 2;
        
        // Calculate distances from center for both the customer node and proposed position
        const customerDistFromCenter = Math.sqrt((customerNode.x - centerX) ** 2 + (customerNode.y - centerY) ** 2);
        const proposedDistFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        // Bonus if the proposed position is farther from center than the customer node
        if (proposedDistFromCenter > customerDistFromCenter) {
            // Scale the bonus based on how much farther outward it is
            const outwardDistance = proposedDistFromCenter - customerDistFromCenter;
            const maxBonus = 20; // Maximum bonus points
            const scaleFactor = 0.1; // How quickly bonus increases with distance
            return Math.min(maxBonus, outwardDistance * scaleFactor);
        }
        
        // Small penalty if moving inward toward center
        const inwardDistance = customerDistFromCenter - proposedDistFromCenter;
        return -inwardDistance * 0.05; // Small penalty for moving inward
    }
    
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.sqrt(A * A + B * B);
        
        const param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    forceNonOverlappingPosition(customerNode, preferredDistance, allNodes, minSpacing) {
        // If no good position found, create one by pushing existing nodes
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        
        // Start with preferred position
        let bestX = customerNode.x + preferredDistance;
        let bestY = customerNode.y;
        
        // Apply multiple iterations of force-based positioning
        for (let iteration = 0; iteration < 10; iteration++) {
            let forceX = 0;
            let forceY = 0;
            let hasCollision = false;
            
            // Calculate repulsion forces from all nodes
            for (const node of allNodes) {
                if (node === customerNode) continue;
                
                const dx = bestX - node.x;
                const dy = bestY - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const nodeRadius = node.radius || 8;
                const requiredDist = minSpacing + nodeRadius;
                
                if (dist < requiredDist && dist > 0) {
                    hasCollision = true;
                    const force = (requiredDist - dist) / dist;
                    forceX += dx * force * 0.3;
                    forceY += dy * force * 0.3;
                }
            }
            
            // If no collision, we're done
            if (!hasCollision) break;
            
            // Apply forces with boundary constraints (account for node size)
            const dynamicMargin = Math.max(60, minSpacing); // At least 60px margin or node spacing
            bestX = Math.max(dynamicMargin, Math.min(flowWidth - dynamicMargin, bestX + forceX));
            bestY = Math.max(dynamicMargin, Math.min(flowHeight - dynamicMargin, bestY + forceY));
        }
        
        return { x: bestX, y: bestY };
    }
    
    calculateLineRepulsionForce(x, y, minDistance) {
        let forceX = 0;
        let forceY = 0;
        
        // Check repulsion from all connection lines
        this.networkNodes.forEach((customerNode) => {
            // Repulsion from customer-to-broker line
            const brokerLineDist = this.pointToLineDistance(x, y, customerNode.x, customerNode.y, this.brokerNode.x, this.brokerNode.y);
            if (brokerLineDist < minDistance && brokerLineDist > 0) {
                const closestPoint = this.getClosestPointOnLine(x, y, customerNode.x, customerNode.y, this.brokerNode.x, this.brokerNode.y);
                const dx = x - closestPoint.x;
                const dy = y - closestPoint.y;
                const force = (minDistance - brokerLineDist) / minDistance * 20;
                forceX += (dx / brokerLineDist) * force;
                forceY += (dy / brokerLineDist) * force;
            }
            
            // Repulsion from customer-to-topic lines
            this.networkTopics.forEach((topicNode) => {
                if (topicNode.customer === customerNode.customer) {
                    const topicLineDist = this.pointToLineDistance(x, y, customerNode.x, customerNode.y, topicNode.x, topicNode.y);
                    if (topicLineDist < minDistance && topicLineDist > 0) {
                        const closestPoint = this.getClosestPointOnLine(x, y, customerNode.x, customerNode.y, topicNode.x, topicNode.y);
                        const dx = x - closestPoint.x;
                        const dy = y - closestPoint.y;
                        const force = (minDistance - topicLineDist) / minDistance * 15;
                        forceX += (dx / topicLineDist) * force;
                        forceY += (dy / topicLineDist) * force;
                    }
                }
            });
        });
        
        return { x: forceX, y: forceY };
    }
    
    getClosestPointOnLine(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return { x: x1, y: y1 };
        
        const param = Math.max(0, Math.min(1, dot / lenSq));
        
        return {
            x: x1 + param * C,
            y: y1 + param * D
        };
    }
    
    optimizeTopicLayout(customer) {
        const customerNode = this.networkNodes.get(customer);
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        const distance = Math.min(flowWidth, flowHeight) * 0.10;
        const minSpacing = 35; // Increased spacing
        
        // Get all topic nodes for this customer
        const customerTopics = Array.from(this.networkTopics.values())
            .filter(node => node.customer === customer);
        
        if (customerTopics.length <= 1) return; // Nothing to optimize
        
        // Get ALL nodes for collision detection
        const allNodes = [
            ...Array.from(this.networkTopics.values()),
            ...Array.from(this.networkNodes.values()),
            this.brokerNode
        ];
        
        // Apply aggressive force-based repositioning
        const iterations = 8; // More iterations for better results
        for (let iter = 0; iter < iterations; iter++) {
            customerTopics.forEach((topicNode) => {
                let forceX = 0;
                let forceY = 0;
                
                // Strong repulsion from ALL other nodes
                allNodes.forEach((otherNode) => {
                    if (otherNode === topicNode || otherNode === customerNode) return;
                    
                    const dx = topicNode.x - otherNode.x;
                    const dy = topicNode.y - otherNode.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const otherRadius = otherNode.radius || 8;
                    const requiredDist = minSpacing + otherRadius;
                    
                    if (dist < requiredDist && dist > 0) {
                        const force = Math.pow((requiredDist - dist) / requiredDist, 2) * 0.4;
                        forceX += (dx / dist) * force * 60;
                        forceY += (dy / dist) * force * 60;
                    }
                });
                
                // Moderate attraction to ideal distance from customer
                const dx = topicNode.x - customerNode.x;
                const dy = topicNode.y - customerNode.y;
                const currentDist = Math.sqrt(dx * dx + dy * dy);
                
                if (currentDist > 0) {
                    const idealForce = (distance - currentDist) / currentDist;
                    forceX -= dx * idealForce * 0.08;
                    forceY -= dy * idealForce * 0.08;
                }
                
                // Repulsion from connection lines
                const lineForce = this.calculateLineRepulsionForce(topicNode.x, topicNode.y, minSpacing * 0.7);
                forceX += lineForce.x;
                forceY += lineForce.y;
                
                // Apply forces with bounds checking
                const newX = Math.max(100, Math.min(flowWidth - 100, topicNode.x + forceX));
                const newY = Math.max(100, Math.min(flowHeight - 100, topicNode.y + forceY));
                
                topicNode.targetX = newX;
                topicNode.targetY = newY;
            });
        }
        
        // Animate nodes to their new positions
        this.animateTopicNodes(customerTopics);
    }
    
    animateTopicNodes(nodes) {
        const duration = 500; // 500ms animation
        const startTime = Date.now();
        
        // Store initial positions
        nodes.forEach(node => {
            node.startX = node.x;
            node.startY = node.y;
        });
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeInOutCubic(progress);
            
            nodes.forEach(node => {
                if (node.element && node.startX !== undefined && node.startY !== undefined) {
                    // Interpolate position
                    node.x = node.startX + (node.targetX - node.startX) * easeProgress;
                    node.y = node.startY + (node.targetY - node.startY) * easeProgress;
                    
                    // Update visual position
                    const circle = node.element.querySelector('circle');
                    if (circle) {
                        circle.setAttribute('cx', node.x);
                        circle.setAttribute('cy', node.y);
                    }
                }
            });
            
            // Update connections
            this.updateNetworkConnections();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Clean up animation properties
                nodes.forEach(node => {
                    delete node.startX;
                    delete node.startY;
                });
            }
        };
        
        animate();
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    optimizeEntireNetwork() {
        // Optimize layout for all customers that have multiple topics
        this.networkNodes.forEach((customerNode, customer) => {
            const customerTopics = Array.from(this.networkTopics.values())
                .filter(node => node.customer === customer);
            
            if (customerTopics.length > 1) {
                // Use a lighter optimization for global updates
                this.lightOptimizeTopicLayout(customer);
            }
        });
    }
    
    lightOptimizeTopicLayout(customer) {
        const customerNode = this.networkNodes.get(customer);
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        const distance = Math.min(flowWidth, flowHeight) * 0.10;
        const minSpacing = 30; // Still maintain good spacing for global optimization
        
        // Get all topic nodes for this customer
        const customerTopics = Array.from(this.networkTopics.values())
            .filter(node => node.customer === customer);
        
        if (customerTopics.length <= 1) return;
        
        // Light force-based repositioning (fewer iterations)
        const iterations = 2;
        for (let iter = 0; iter < iterations; iter++) {
            customerTopics.forEach((topicNode) => {
                let forceX = 0;
                let forceY = 0;
                
                // Repulsion from other topic nodes of the same customer
                customerTopics.forEach((otherNode) => {
                    if (otherNode === topicNode) return;
                    
                    const dx = topicNode.x - otherNode.x;
                    const dy = topicNode.y - otherNode.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < minSpacing && dist > 0) {
                        const force = (minSpacing - dist) / dist;
                        forceX += dx * force * 0.05; // Gentler force
                        forceY += dy * force * 0.05;
                    }
                });
                
                // Apply forces with bounds checking
                const newX = Math.max(100, Math.min(flowWidth - 100, topicNode.x + forceX));
                const newY = Math.max(100, Math.min(flowHeight - 100, topicNode.y + forceY));
                
                topicNode.targetX = newX;
                topicNode.targetY = newY;
            });
        }
        
        // Animate nodes to their new positions (shorter animation)
        this.animateTopicNodesLight(customerTopics);
    }
    
    animateTopicNodesLight(nodes) {
        const duration = 300; // Shorter animation for light optimization
        const startTime = Date.now();
        
        // Store initial positions
        nodes.forEach(node => {
            node.startX = node.x;
            node.startY = node.y;
        });
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeInOutCubic(progress);
            
            nodes.forEach(node => {
                if (node.element && node.startX !== undefined && node.startY !== undefined) {
                    // Only animate if there's a significant difference
                    const dx = Math.abs(node.targetX - node.startX);
                    const dy = Math.abs(node.targetY - node.startY);
                    
                    if (dx > 2 || dy > 2) { // Only animate if moving more than 2px
                        // Interpolate position
                        node.x = node.startX + (node.targetX - node.startX) * easeProgress;
                        node.y = node.startY + (node.targetY - node.startY) * easeProgress;
                        
                        // Update visual position
                        const circle = node.element.querySelector('circle');
                        if (circle) {
                            circle.setAttribute('cx', node.x);
                            circle.setAttribute('cy', node.y);
                        }
                    }
                }
            });
            
            // Update connections less frequently for performance
            if (progress > 0.5) {
                this.updateNetworkConnections();
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Clean up animation properties and ensure final update
                nodes.forEach(node => {
                    delete node.startX;
                    delete node.startY;
                });
                this.updateNetworkConnections();
            }
        };
        
        animate();
    }
    
    setupNetworkResizeHandling() {
        // Listen for window resize events for full viewport responsiveness
        window.addEventListener('resize', () => {
            this.handleNetworkResize();
        });
    }
    
    handleNetworkResize() {
        if (!this.d3Svg || this.visualizationMode !== 'network') {
            return;
        }
        
        // Debounce resize handling
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        this.resizeTimeout = setTimeout(() => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            // Update SVG dimensions to full viewport
            this.d3Svg
                .attr('width', width)
                .attr('height', height)
                .style('width', '100vw')
                .style('height', '100vh');
            
            // Update force center and boundary
            if (this.d3Simulation) {
                this.d3Simulation.force('center', d3.forceCenter(width / 2, height / 2));
                this.d3Simulation.force('boundary', this.createBoundaryForce(width, height));
                
                // Update broker node fixed position to viewport center
                const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
                if (brokerNode) {
                    brokerNode.fx = width / 2;
                    brokerNode.fy = height / 2;
                }
                
                this.d3Simulation.alpha(0.3).restart();
            }
        }, 100);
    }
    
    resizeNetworkGraph() {
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        
        // Update SVG dimensions
        this.networkSvg.setAttribute('width', flowWidth);
        this.networkSvg.setAttribute('height', flowHeight);
        this.networkSvg.setAttribute('viewBox', `0 0 ${flowWidth} ${flowHeight}`);
        
        // Update broker node position (center)
        const centerX = flowWidth / 2;
        const centerY = flowHeight / 2;
        
        this.brokerNode.x = centerX;
        this.brokerNode.y = centerY;
        
        // Update broker node visual position
        const brokerCircle = this.brokerNode.element.querySelector('circle');
        const brokerText = this.brokerNode.element.querySelector('text');
        if (brokerCircle) {
            brokerCircle.setAttribute('cx', centerX);
            brokerCircle.setAttribute('cy', centerY);
        }
        if (brokerText) {
            brokerText.setAttribute('x', centerX);
            brokerText.setAttribute('y', centerY + 5);
        }
        
        // Recalculate and update customer node positions
        this.repositionCustomerNodes(centerX, centerY, flowWidth, flowHeight);
        
        // Recalculate and update topic node positions
        this.repositionTopicNodes(flowWidth, flowHeight);
        
        // Update all connections
        this.updateNetworkConnections();
    }
    
    repositionCustomerNodes(centerX, centerY, flowWidth, flowHeight) {
        const distance = Math.min(flowWidth, flowHeight) * 0.18;
        let nodeIndex = 0;
        const totalNodes = this.networkNodes.size;
        
        this.networkNodes.forEach((node) => {
            // Recalculate angle for even distribution around full circle
            const angle = (nodeIndex * 2 * Math.PI) / totalNodes;
            
            // Update node position
            node.x = centerX + Math.cos(angle) * distance;
            node.y = centerY + Math.sin(angle) * distance;
            
            // Update target positions for smooth animations
            node.targetX = node.x;
            node.targetY = node.y;
            
            // Update visual position
            const circle = node.element.querySelector('circle');
            const text = node.element.querySelector('text');
            if (circle) {
                circle.setAttribute('cx', node.x);
                circle.setAttribute('cy', node.y);
            }
            if (text) {
                text.setAttribute('x', node.x);
                text.setAttribute('y', node.y + 3);
            }
            
            // Update message circles that orbit this customer node
            this.updateCustomerMessageCircles(node);
            
            nodeIndex++;
        });
    }
    
    repositionTopicNodes(flowWidth, flowHeight) {
        const topicDistance = Math.min(flowWidth, flowHeight) * 0.10;
        
        this.networkTopics.forEach((topicNode) => {
            const customerNode = this.networkNodes.get(topicNode.customer);
            if (customerNode) {
                // Keep relative angle but update distance based on new screen size
                const angle = Math.atan2(topicNode.y - customerNode.y, topicNode.x - customerNode.x);
                
                topicNode.x = customerNode.x + Math.cos(angle) * topicDistance;
                topicNode.y = customerNode.y + Math.sin(angle) * topicDistance;
                
                // Update visual position
                const circle = topicNode.element.querySelector('circle');
                if (circle) {
                    circle.setAttribute('cx', topicNode.x);
                    circle.setAttribute('cy', topicNode.y);
                }
            }
        });
    }
    
    updateNetworkConnections() {
        // Clear existing connections
        const connectionsGroup = this.networkSvg.querySelector('#connections');
        connectionsGroup.innerHTML = '';
        
        // Recreate connections with new positions (only broker to customers now)
        this.networkNodes.forEach((customerNode) => {
            // Recreate broker to customer connection
            this.createConnection(this.brokerNode, customerNode, customerNode.color);
        });
    }

    // D3 Bubbles Implementation
    updateD3Bubbles(messageData) {
        if (!this.d3BubblesSvg) {
            this.initializeD3Bubbles();
        }
        
        // Create a new bubble node for this message
        this.createD3Bubble(messageData);
    }
    
    initializeD3Bubbles() {
        // Clear existing content
        const existingSvg = this.domElements.messageFlow.querySelector('#d3-bubbles');
        if (existingSvg) {
            existingSvg.remove();
        }
        
        // Remove any existing message bubbles
        const bubbles = this.domElements.messageFlow.querySelectorAll('.message-bubble');
        bubbles.forEach(bubble => bubble.remove());
        
        // Clear any existing D3 network
        if (this.d3Svg) {
            this.d3Svg.remove();
            this.d3Svg = null;
            this.d3Simulation = null;
        }
        
        // Create D3 SVG for bubbles
        const container = this.domElements.messageFlow;
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.d3BubblesSvg = d3.select(container)
            .append('svg')
            .attr('id', 'd3-bubbles')
            .attr('width', width)
            .attr('height', height)
            .style('position', 'fixed')
            .style('top', '0')
            .style('left', '0')
            .style('width', '100vw')
            .style('height', '100vh')
            .style('z-index', '1');
        
        // Create container groups
        this.d3BubblesContainer = {
            bubbles: this.d3BubblesSvg.append('g').attr('class', 'bubbles'),
            labels: this.d3BubblesSvg.append('g').attr('class', 'labels')
        };
        
        // Initialize bubbles data array
        this.d3BubblesData = [];
        
        // Setup resize handling
        window.addEventListener('resize', () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            this.d3BubblesSvg
                .attr('width', newWidth)
                .attr('height', newHeight);
        });
    }
    
    createD3Bubble(messageData) {
        const flowWidth = window.innerWidth;
        const flowHeight = window.innerHeight;
        const color = this.getTopicColor(messageData.topic);
        const customer = this.extractCustomerFromTopic(messageData.topic);
        
        // Calculate starting position based on direction
        let startX, startY;
        const margin = 100;
        const cardWidth = 300; // Approximate bubble width
        
        if (this.bubbleDirection.y === -1) {
            // Moving up: start from bottom
            startX = margin + Math.random() * (flowWidth - cardWidth - 2 * margin);
            startY = flowHeight + 100;
        } else if (this.bubbleDirection.y === 1) {
            // Moving down: start from top
            startX = margin + Math.random() * (flowWidth - cardWidth - 2 * margin);
            startY = -100;
        } else if (this.bubbleDirection.x === -1) {
            // Moving left: start from right
            startX = flowWidth + 100;
            startY = margin + Math.random() * (flowHeight - 2 * margin);
        } else if (this.bubbleDirection.x === 1) {
            // Moving right: start from left
            startX = -cardWidth - 100;
            startY = margin + Math.random() * (flowHeight - 2 * margin);
        }
        
        // Create bubble data object
        const bubbleData = {
            id: Date.now() + Math.random(),
            x: startX,
            y: startY,
            startX: startX,
            startY: startY,
            color: color,
            customer: customer,
            topic: messageData.topic,
            time: this.formatTime(messageData.timestamp),
            messageData: messageData,
            startTime: Date.now()
        };
        
        this.d3BubblesData.push(bubbleData);
        
        // Create SVG group for this bubble
        const bubbleGroup = this.d3BubblesContainer.bubbles
            .append('g')
            .attr('class', 'bubble-group')
            .attr('transform', `translate(${startX}, ${startY})`);
        
        // Create bubble rectangle with rounded corners
        const bubbleRect = bubbleGroup
            .append('rect')
            .attr('class', 'bubble-rect')
            .attr('width', 280)
            .attr('height', 80)
            .attr('rx', 10)
            .attr('ry', 10)
            .attr('x', -140) // Center the rectangle
            .attr('y', -40)  // Center the rectangle
            .style('fill', color)
            .style('stroke', color)
            .style('stroke-width', '2px')
            .style('opacity', 1);
        
        // Add text labels
        const textGroup = bubbleGroup.append('g').attr('class', 'text-group');
        
        // Customer name
        textGroup.append('text')
            .attr('class', 'customer-text')
            .attr('x', 0)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .style('font-size', '18px')
            .style('font-weight', 'bold')
            .style('fill', '#fff')
            .style('text-shadow', '0 4px 8px rgba(0, 0, 0, 0.9)')
            .text(customer);
        
        // Topic
        textGroup.append('text')
            .attr('class', 'topic-text')
            .attr('x', 0)
            .attr('y', 8)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('fill', '#fff')
            .style('text-shadow', '0 4px 8px rgba(0, 0, 0, 0.9)')
            .text(messageData.topic);
        
        // Time
        textGroup.append('text')
            .attr('class', 'time-text')
            .attr('x', 0)
            .attr('y', 26)
            .attr('text-anchor', 'middle')
            .style('font-size', '14px')
            .style('fill', '#fff')
            .style('text-shadow', '0 4px 8px rgba(0, 0, 0, 0.9)')
            .text(bubbleData.time);
        
        // Add click handler
        bubbleGroup
            .style('cursor', 'pointer')
            .on('click', () => {
                this.showMessageModal(messageData);
            });
        
        // Store reference to the SVG group in the data
        bubbleData.svgGroup = bubbleGroup;
        
        // Start animation
        this.animateD3Bubble(bubbleData);
    }
    
    animateD3Bubble(bubbleData) {
        const duration = 20000; // 20 seconds
        const flowWidth = window.innerWidth;
        const flowHeight = window.innerHeight;
        const buffer = 500;
        
        // Calculate target position based on direction
        let targetX, targetY;
        
        if (this.bubbleDirection.x !== 0) {
            // Horizontal movement
            const travelDistance = flowWidth + buffer * 2;
            targetX = bubbleData.startX + (this.bubbleDirection.x * travelDistance);
            targetY = bubbleData.startY; // No vertical movement
        } else {
            // Vertical movement
            const travelDistance = flowHeight + buffer * 2;
            targetX = bubbleData.startX; // No horizontal movement
            targetY = bubbleData.startY + (this.bubbleDirection.y * travelDistance);
        }
        
        // Use D3 transition for smooth animation
        bubbleData.svgGroup
            .transition()
            .duration(duration)
            .attr('transform', `translate(${targetX}, ${targetY})`)
            .on('end', () => {
                // Remove bubble when animation completes
                this.removeD3Bubble(bubbleData);
            });
        
        // Check if bubble goes off screen and remove early
        const checkOffScreen = () => {
            const currentTransform = bubbleData.svgGroup.attr('transform');
            if (!currentTransform) return;
            
            const match = currentTransform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (!match) return;
            
            const currentX = parseFloat(match[1]);
            const currentY = parseFloat(match[2]);
            
            const isOffScreen = (currentX < -buffer || currentX > flowWidth + buffer || 
                               currentY < -buffer || currentY > flowHeight + buffer);
            
            if (isOffScreen) {
                this.removeD3Bubble(bubbleData);
            } else {
                // Continue checking
                setTimeout(checkOffScreen, 100);
            }
        };
        
        // Start off-screen checking
        setTimeout(checkOffScreen, 100);
    }
    
    removeD3Bubble(bubbleData) {
        if (bubbleData.svgGroup) {
            bubbleData.svgGroup.remove();
        }
        
        // Remove from data array
        const index = this.d3BubblesData.findIndex(d => d.id === bubbleData.id);
        if (index > -1) {
            this.d3BubblesData.splice(index, 1);
        }
    }

    // D3 Radial Implementation (using original DOM bubbles with D3 animation)
    createD3RadialBubble(messageData) {
        // Limit concurrent animations to prevent crashes (same as original)
        if (this.activeRadialAnimations >= this.maxRadialAnimations) {
            return;
        }
        
        // Create the bubble using the original method to maintain visual consistency
        const bubble = this.getBubbleFromPool();
        bubble.className = 'message-bubble';
        
        // Get or create color for topic
        const color = this.getTopicColor(messageData.topic);
        
        // Apply original styling (same as createMessageBubble)
        const styles = {
            background: `linear-gradient(135deg, ${color}, ${color}E6)`,
            border: `2px solid ${color}`,
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
            filter: 'brightness(1.0)'
        };
        
        bubble.dataset.brightness = '1.0';
        bubble.dataset.scale = '0.3'; // Start small for radial mode
        bubble.dataset.createdAt = Date.now().toString();
        
        Object.assign(bubble.style, styles);
        
        // Create message content with template (same as original)
        const customer = this.extractCustomerFromTopic(messageData.topic);
        const template = document.createElement('template');
        template.innerHTML = `
            <div class="message-customer">${customer}</div>
            <div class="message-topic">${messageData.topic}</div>
            <div class="message-time">${this.formatTime(messageData.timestamp)}</div>
        `;
        
        bubble.appendChild(template.content);
        
        // Add click event listener
        bubble.addEventListener('click', () => {
            this.showMessageModal(messageData);
        });
        
        // Position at center (same as original)
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        const startX = flowWidth / 2;
        const startY = flowHeight / 2;
        
        // Set initial position and styling (same as original)
        bubble.style.transition = 'none';
        bubble.style.left = `${startX}px`;
        bubble.style.top = `${startY}px`;
        bubble.style.opacity = '1';
        bubble.style.transform = 'scale(1)'; // Original starts at scale(1)
        
        // Set z-index (same as original)
        bubble.style.zIndex = this.messageZIndex;
        this.getNextZIndex();
        
        // Add to DOM
        this.domElements.messageFlow.appendChild(bubble);
        
        // Use D3 for smooth animation instead of requestAnimationFrame
        this.animateD3RadialBubble(bubble, startX, startY);
        
        // Store reference for cleanup
        const bubbleId = Date.now() + Math.random();
        this.activeAnimations.set(bubbleId, bubble);
    }
    
    animateD3RadialBubble(bubble, startX, startY) {
        this.activeRadialAnimations++;
        
        // Generate random angle and target (same as original)
        const angle = Math.random() * 2 * Math.PI;
        const maxDistance = 600;
        const targetX = startX + Math.cos(angle) * maxDistance;
        const targetY = startY + Math.sin(angle) * maxDistance;
        
        const duration = 20000; // 20 seconds (same as original)
        const fadeStartPoint = 0.2; // Start fading after 20% (same as original)
        
        // Create D3 selection for the bubble
        const d3Bubble = d3.select(bubble);
        
        // Animate position using D3
        d3Bubble
            .transition()
            .duration(duration)
            .style('left', `${targetX}px`)
            .style('top', `${targetY}px`)
            .on('end', () => {
                // Remove bubble when position animation completes
                this.removeRadialBubble(bubble);
            });
        
        // Animate scaling from 0.3 to 1.5 (same as original)
        d3Bubble
            .transition()
            .duration(duration)
            .styleTween('transform', () => {
                const minScale = 0.3;
                const maxScale = 1.5;
                const interpolator = d3.interpolate(minScale, maxScale);
                return function(t) {
                    const scale = interpolator(t);
                    return `scale(${scale})`;
                };
            });
        
        // Handle opacity fade after fadeStartPoint (same as original)
        const fadeDelay = duration * fadeStartPoint;
        const fadeDuration = duration * (1 - fadeStartPoint);
        
        d3Bubble
            .transition()
            .delay(fadeDelay)
            .duration(fadeDuration)
            .style('opacity', 0)
            .on('end', () => {
                // Alternative removal path
                this.removeRadialBubble(bubble);
            });
    }
    
    removeRadialBubble(bubble) {
        if (bubble && bubble.parentNode) {
            bubble.parentNode.removeChild(bubble);
            this.returnBubbleToPool(bubble);
            this.activeRadialAnimations--;
        }
    }

    // Visualization switching
    switchVisualization(mode) {
        if (!mode) {
            // If no mode provided, get from current active button
            const activeBtn = document.querySelector('.viz-icon-btn.active, .viz-mode-btn.active');
            mode = activeBtn ? activeBtn.dataset.mode : 'bubbles';
        }
        
        this.visualizationMode = mode;
        
        // Update active states for both icon and mode buttons
        this.updateVisualizationButtonStates(mode);
        
        // Clear current visualizations
        this.clearAllVisualizations();
        
        // Reset color legend and topic tracking
        this.resetVisualizationState();
        
        // Remove all mode classes first
        this.domElements.messageFlow.classList.remove('network-mode', 'starfield-mode', 'radial-mode');
        
        // Show/hide appropriate containers using cached elements
        if (mode === 'network') {
            this.domElements.messageFlow.style.display = 'block';
            this.domElements.messageFlow.classList.add('network-mode');
            
            // Initialize network graph if switching to network mode
            if (this.visualizationMode !== 'network') {
                this.initializeD3Network();
            }
        } else if (mode === 'bubbles' || mode === 'radial' || mode === 'starfield') {
            this.domElements.messageFlow.style.display = 'block';
            
            // Add specific classes for different modes
            if (mode === 'starfield') {
                this.domElements.messageFlow.classList.add('starfield-mode');
            } else if (mode === 'radial') {
                this.domElements.messageFlow.classList.add('radial-mode');
            } else if (mode === 'bubbles') {
                // Initialize D3 bubbles if switching to bubbles mode
                if (this.visualizationMode !== 'bubbles') {
                    this.initializeD3Bubbles();
                }
            }
        }
    }
    
    // Update active states for visualization buttons
    updateVisualizationButtonStates(activeMode) {
        // Update icon buttons (collapsed sidebar)
        this.domElements.vizIconButtons.forEach(btn => {
            if (btn.dataset.mode === activeMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Update mode buttons (expanded sidebar)
        this.domElements.vizModeButtons.forEach(btn => {
            if (btn.dataset.mode === activeMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    clearAllVisualizations() {
        // Cancel all active animation frames
        this.animationFramePool.forEach(frameId => {
            cancelAnimationFrame(frameId);
        });
        this.animationFramePool.clear();
        
        // Clear bubbles and return to pool where possible
        const bubbles = document.querySelectorAll('.message-bubble');
        bubbles.forEach(bubble => {
            if (bubble.parentNode) {
                bubble.parentNode.removeChild(bubble);
                if (!this.returnBubbleToPool(bubble)) {
                    bubble.innerHTML = '';
                }
            }
        });
        
        this.activeAnimations.clear();
        this.activeRadialAnimations = 0;
        
        // Clear D3.js network graph
        const existingD3Svg = document.querySelector('#d3-network');
        if (existingD3Svg) {
            existingD3Svg.remove();
        }
        
        // Clear D3.js bubbles
        const existingD3Bubbles = document.querySelector('#d3-bubbles');
        if (existingD3Bubbles) {
            existingD3Bubbles.remove();
        }
        
        // Clear D3 bubbles data
        this.d3BubblesSvg = null;
        this.d3BubblesContainer = null;
        this.d3BubblesData = [];
        
        // Stop D3 simulation and brightness decay
        if (this.d3Simulation) {
            this.d3Simulation.stop();
            this.d3Simulation = null;
        }
        
        // Stop brightness decay interval
        if (this.brightnessInterval) {
            clearInterval(this.brightnessInterval);
            this.brightnessInterval = null;
        }
        
        // Clear D3 data
        this.d3Nodes = [];
        this.d3Links = [];
        this.d3Svg = null;
        this.d3Container = null;
        
        // Clear old network data structures (legacy)
        if (this.networkNodes) this.networkNodes.clear();
        if (this.networkTopics) this.networkTopics.clear();
        if (this.networkMessages) this.networkMessages.clear();
        this.networkPulses = [];
        this.networkSvg = null;
        this.brokerNode = null;
        
        // Cleanup resize observer
        if (this.networkResizeObserver) {
            this.networkResizeObserver.disconnect();
            this.networkResizeObserver = null;
        }
        
        // Clear resize timeout
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
    }
    
    resetVisualizationState() {
        // Clear topic and customer color mappings
        this.topicColors.clear();
        this.customerColors.clear();
        this.activeTopics.clear();
        
        // Hide and clear the color legend
        this.domElements.colorLegend.style.display = 'none';
        this.domElements.legendItems.innerHTML = '';
        
        // Reset stats
        this.domElements.activeTopics.textContent = '0';
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

    // Z-index management with bounds checking
    getNextZIndex() {
        // Decrement z-index for depth layering (newer cards behind older ones)
        this.messageZIndex--;
        
        // Reset to max when hitting minimum to prevent overflow
        if (this.messageZIndex < this.minZIndex) {
            this.messageZIndex = this.maxZIndex;
        }
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
    
    createTopicLabel(topic) {
        const parts = topic.split('/');
        
        // Show only device ID (2nd level) 
        return parts[1] || parts[parts.length - 1] || 'topic';
    }
    
    extractDeviceFromTopic(topic) {
        const parts = topic.split('/');
        
        // Return device ID (2nd level) for grouping
        return parts[1] || parts[parts.length - 1] || 'device';
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
        
        // Hide UI elements when disconnected
        this.domElements.statsPanel.style.display = 'none';
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
    
    detectPassiveSupport() {
        let supportsPassive = false;
        try {
            const opts = Object.defineProperty({}, 'passive', {
                get: function() {
                    supportsPassive = true;
                }
            });
            window.addEventListener('test', null, opts);
            window.removeEventListener('test', null, opts);
        } catch (e) {}
        return supportsPassive;
    }
    
    // Optimized animation frame pooling
    requestOptimizedFrame(callback) {
        const frameId = requestAnimationFrame((timestamp) => {
            this.animationFramePool.delete(frameId);
            callback(timestamp);
        });
        this.animationFramePool.add(frameId);
        return frameId;
    }
    
    cancelOptimizedFrame(frameId) {
        if (this.animationFramePool.has(frameId)) {
            cancelAnimationFrame(frameId);
            this.animationFramePool.delete(frameId);
        }
    }
    
    // Object pooling for message bubbles
    getBubbleFromPool() {
        if (this.bubblePool.length > 0) {
            const bubble = this.bubblePool.pop();
            // Reset bubble properties
            bubble.className = 'message-bubble';
            bubble.style.cssText = '';
            bubble.innerHTML = '';
            bubble.removeAttribute('data-reused');
            return bubble;
        }
        return document.createElement('div');
    }
    
    returnBubbleToPool(bubble) {
        if (this.bubblePool.length < this.maxPoolSize) {
            // Clean up bubble
            bubble.style.display = 'none';
            bubble.innerHTML = '';
            bubble.className = '';
            bubble.setAttribute('data-reused', 'true');
            this.bubblePool.push(bubble);
            return true;
        }
        return false;
    }
    
    startFrameRateMonitoring() {
        let lastStatsUpdate = Date.now();
        
        const updateFrameRate = () => {
            this.frameCount++;
            const now = Date.now();
            const timeDiff = now - lastStatsUpdate;
            
            // Update stats every second
            if (timeDiff >= 1000) {
                const fps = Math.round((this.frameCount * 1000) / timeDiff);
                
                // Update DOM elements directly
                if (this.domElements.frameRate) {
                    this.domElements.frameRate.textContent = fps;
                }
                
                // Count active message cards
                const activeCards = document.querySelectorAll('.message-bubble').length;
                if (this.domElements.activeCards) {
                    this.domElements.activeCards.textContent = activeCards;
                }
                
                this.frameCount = 0;
                lastStatsUpdate = now;
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