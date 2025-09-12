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
        this.messageZIndex = 1000; // Start with high z-index
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
        if (this.visualizationMode === 'bubbles' || this.visualizationMode === 'radial' || this.visualizationMode === 'starfield') {
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
            // Reduce brightness by 10% for falling boxes and radial burst modes
            styles.filter = 'brightness(0.9)';
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
            const safeCardWidth = 400; // Use CSS max-width value
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
            const cardMaxSize = 400 * 8; // max card width * max scale
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
                }
            };
            
            animate();
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
        
        // Show/hide appropriate containers using cached elements
        if (mode === 'bubbles' || mode === 'radial' || mode === 'starfield') {
            this.domElements.messageFlow.style.display = 'block';
            
            // Add specific classes for different modes
            if (mode === 'starfield') {
                this.domElements.messageFlow.classList.add('starfield-mode');
                this.domElements.messageFlow.classList.remove('radial-mode');
            } else if (mode === 'radial') {
                this.domElements.messageFlow.classList.add('radial-mode');
                this.domElements.messageFlow.classList.remove('starfield-mode');
            } else {
                this.domElements.messageFlow.classList.remove('starfield-mode');
                this.domElements.messageFlow.classList.remove('radial-mode');
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