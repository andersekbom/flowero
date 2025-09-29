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

// Import modular components
import EventEmitter from './src/utils/EventEmitter.js';
import MQTTConnectionManager from './src/mqtt/MQTTConnectionManager.js';
import DOMManager from './src/ui/DOMManager.js';
import SidebarController from './src/ui/SidebarController.js';
import ThemeManager from './src/ui/ThemeManager.js';
import ModalController from './src/ui/ModalController.js';
import StatsPanel from './src/ui/StatsPanel.js';
import ColorLegend from './src/ui/ColorLegend.js';
import { BaseVisualization, CircleRenderer } from './src/visualization/BaseVisualization.js';
import BubbleAnimation from './src/visualization/BubbleAnimation.js';
import NetworkGraph from './src/visualization/NetworkGraph.js';
import ClusteredBubbles from './src/visualization/ClusteredBubbles.js';
import StarfieldVisualization from './src/visualization/StarfieldVisualization.js';
import RadialVisualization from './src/visualization/RadialVisualization.js';
import { detectPassiveSupport, hasIntersectionObserver, hasRequestIdleCallback } from './src/config/BrowserDetection.js';
import LayoutCalculator from './src/core/LayoutCalculator.js';
import MessageProcessor from './src/core/MessageProcessor.js';
import CleanupManager from './src/core/CleanupManager.js';
import LinearAnimation from './src/animation/LinearAnimation.js';
import ForceAnimation from './src/animation/ForceAnimation.js';
import AnimationManager from './src/animation/AnimationManager.js';
import { DIRECTIONS, ANIMATION_TYPES } from './src/animation/AnimationTypes.js';
import UnifiedElementSystem from './src/elements/UnifiedElementSystem.js';
import UnifiedElementTracker from './src/elements/UnifiedElementTracker.js';
import ElementFactory from './src/elements/ElementFactory.js';
import ContainerSystem from './src/core/ContainerSystem.js';
import ModeManager from './src/modes/ModeManager.js';
import PerformanceManager from './src/core/PerformanceManager.js';
import AppConfig from './src/config/AppConfig.js';
import { setupGlobalFunctions } from './src/config/GlobalFunctions.js';
import { VISUALIZATION_MODES, CONNECTION_STATES } from './src/config/Constants.js';

// Container management moved to src/core/ContainerSystem.js


// Element management classes moved to src/elements/

// Removed: CircleRenderer class - now imported from BaseVisualization module
    
// Removed: createSVGCircle method - now available in imported CircleRenderer

// Phase 2: Animation Engine - Reusable Movement Patterns






// Element lifecycle management moved to src/elements/

// Mode management moved to src/modes/ModeManager.js

class MQTTVisualizer {
    constructor() {
        // Initialize screen dimensions - will be calculated when needed
        this.SCREEN_WIDTH = null;
        this.SCREEN_HEIGHT = null;
        this.SCREEN_CENTER_X = null;
        this.SCREEN_CENTER_Y = null;
        
        // Unified container system
        this.unifiedContainer = null;

        // Message processing system
        this.messageProcessor = new MessageProcessor((topic) => this.getTopicColor(topic));

        // Unified element system (all modes use same circles)
        this.elementSystem = new UnifiedElementSystem('circle');

        // Unified element tracking system
        this.elementTracker = new UnifiedElementTracker();

        // Mode switching management system
        this.modeSwitchingManager = new ModeManager(this);

        // Performance monitoring system
        this.performanceManager = new PerformanceManager();

        // Layout management system
        this.layoutCalculator = null; // Initialized after DOM elements

        // Event system for inter-component communication
        this.eventEmitter = new EventEmitter();

        // MQTT Connection Management (will be initialized after DOM elements are cached)
        this.mqttConnectionManager = null;

        // Legacy connection state compatibility
        this.isConnected = false;
        
        // Message tracking
        this.messageRate = 0;
        this.messageHistory = [];
        
        // Performance tracking (legacy radial counters removed)
        
        // Z-index tracking for depth layering
        this.messageZIndex = AppConfig.Z_INDEX.MESSAGE_START;
        this.maxZIndex = AppConfig.Z_INDEX.MAX;
        this.minZIndex = AppConfig.Z_INDEX.MIN;
        
        // Frame rate tracking moved to PerformanceManager
        
        // Performance optimizations
        this.animationFramePool = new Set();
        this.bubblePool = [];
        this.maxPoolSize = AppConfig.PERFORMANCE.MAX_POOL_SIZE;
        this.activeAnimations = new Map();
        
        // Browser compatibility
        this.hasIntersectionObserver = hasIntersectionObserver();
        this.hasRequestIdleCallback = hasRequestIdleCallback();
        this.supportsPassiveListeners = detectPassiveSupport();
        
        // Topic and color management
        this.topicColors = new Map();
        this.customerColors = new Map();
        this.activeTopics = new Set();
        
        // Visualization state
        this.visualizationMode = null; // Will be set by ModeSwitchingManager
        this.currentAngle = 0;
        
        // Legacy bubble direction removed - now handled by BubbleAnimation component
        
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
        
        // Initialize DOM Manager
        console.log('MQTTVisualizer: Initializing DOMManager...');
        this.domManager = new DOMManager().initialize();
        this.domElements = this.domManager.getAll();
        console.log('MQTTVisualizer: DOMManager initialized, elements:', Object.keys(this.domElements));

        // Initialize MQTT Connection Manager
        console.log('MQTTVisualizer: Initializing MQTT Connection Manager...');
        this.mqttConnectionManager = new MQTTConnectionManager(this.domElements, this.eventEmitter);
        console.log('MQTTVisualizer: MQTT Connection Manager created:', this.mqttConnectionManager);
        this.setupMQTTEventListeners();
        console.log('MQTTVisualizer: MQTT event listeners setup complete');

        // Initialize Sidebar Controller
        console.log('MQTTVisualizer: Initializing SidebarController...');
        try {
            this.sidebarController = new SidebarController(this.domManager, this.eventEmitter).initialize();
            console.log('MQTTVisualizer: SidebarController initialized successfully');
            this.setupSidebarEventListeners();
        } catch (error) {
            console.error('MQTTVisualizer: Failed to initialize SidebarController:', error);
        }

        // Initialize Theme Manager
        this.themeManager = new ThemeManager(this.domManager, this.eventEmitter).initialize();
        this.setupThemeEventListeners();

        // Initialize Modal Controller
        this.modalController = new ModalController(this.domManager, this.eventEmitter).initialize();
        this.modalController.setColorProvider((topic) => this.getTopicColor(topic));
        this.setupModalEventListeners();

        // Initialize Stats Panel
        this.statsPanel = new StatsPanel(this.domManager, this.eventEmitter).initialize();
        this.setupStatsEventListeners();

        // Initialize Base Visualization
        this.baseVisualization = new BaseVisualization(this.domManager, this.eventEmitter, this.themeManager).initialize();
        this.setupVisualizationEventListeners();

        // Initialize Color Legend (shared by all visualizations)
        this.colorLegend = new ColorLegend(this.domManager, this.themeManager).initialize();
        this.setupColorLegendEventListeners();

        // Initialize Bubble Animation System
        console.log('📝 Creating BubbleAnimation instance...');
        this.bubbleAnimation = new BubbleAnimation(this.domManager, this.eventEmitter, this.themeManager, this.colorLegend);
        console.log('📝 BubbleAnimation created:', this.bubbleAnimation);
        console.log('📝 Calling initialize()...');
        this.bubbleAnimation.initialize();
        console.log('📝 BubbleAnimation initialization complete');

        // Initialize Network Graph System
        console.log('🌐 Creating NetworkGraph instance...');
        this.networkGraph = new NetworkGraph(this.domManager, this.eventEmitter, this.themeManager, this.colorLegend);
        console.log('🌐 NetworkGraph created:', this.networkGraph);
        console.log('🌐 Calling initialize()...');
        this.networkGraph.initialize();
        console.log('🌐 NetworkGraph initialization complete');

        // Initialize Starfield Visualization System
        console.log('🌟 Creating StarfieldVisualization instance...');
        this.starfieldVisualization = new StarfieldVisualization(this.domManager, this.eventEmitter, this.themeManager, this.colorLegend);
        console.log('🌟 StarfieldVisualization created:', this.starfieldVisualization);
        console.log('🌟 Calling initialize()...');
        this.starfieldVisualization.initialize();
        console.log('🌟 StarfieldVisualization initialization complete');

        // Initialize Radial Visualization System
        console.log('🔴 Creating RadialVisualization instance...');
        this.radialVisualization = new RadialVisualization(this.domManager, this.eventEmitter, this.themeManager, this.colorLegend);
        console.log('🔴 RadialVisualization created:', this.radialVisualization);
        console.log('🔴 Calling initialize()...');
        this.radialVisualization.initialize();
        console.log('🔴 RadialVisualization initialization complete');

        // Initialize Clustered Bubbles Visualization System
        console.log('🟡 Creating ClusteredBubbles instance...');
        this.clusteredBubbles = new ClusteredBubbles(this.domManager, this.eventEmitter, this.themeManager, this.colorLegend);
        console.log('🟡 ClusteredBubbles created:', this.clusteredBubbles);
        console.log('🟡 Calling initialize()...');
        this.clusteredBubbles.initialize();
        console.log('🟡 ClusteredBubbles initialization complete');

        // Initialize layout management system
        this.layoutCalculator = new LayoutCalculator(this.domElements.messageFlow);

        // Smart cleanup system for element lifecycle management
        this.cleanupManager = new CleanupManager(this.domElements.messageFlow, this.layoutCalculator);
        
        // Initialize all systems
        this.initialize();

        // Set bubbles as default visualization mode
        this.switchVisualization('bubbles');

        // Start frame rate monitoring
        this.startFrameRateMonitoring();
    }

    calculateScreenDimensions() {
        // Use the message flow container dimensions instead of full window
        const container = this.domElements.messageFlow;
        this.SCREEN_WIDTH = container.clientWidth;
        this.SCREEN_HEIGHT = container.clientHeight;
        this.SCREEN_CENTER_X = this.SCREEN_WIDTH / 2;
        this.SCREEN_CENTER_Y = this.SCREEN_HEIGHT / 2;
    }


    initialize() {
        this.initializeEventListeners();
        this.initializeVisualizationButtons();
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
        
        // Legacy arrow key handlers removed - bubble direction now handled by D3 BubbleAnimation component
    }

    
    initializeVisualizationButtons() {
        // Setup visualization button handlers using sidebar controller
        this.sidebarController.setupVisualizationButtons((mode) => {
            this.switchVisualization(mode);
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

    showMessageModal(messageData) {
        this.modalController.showMessageModal(messageData);
    }

    closeModal() {
        this.modalController.close();
    }

    setupMQTTEventListeners() {
        // Listen to MQTT connection events
        this.eventEmitter.on('connection_established', () => {
            this.isConnected = true;
            console.log('MQTT connection established');
            // Update UI elements when connected
            this.domElements.subscribeBtn.disabled = false;
            this.domElements.liveIndicator.style.display = 'flex';
            // StatsPanel handles its own display through events
        });

        this.eventEmitter.on('connection_lost', () => {
            this.isConnected = false;
            console.log('MQTT connection lost');
            // Update UI elements when disconnected
            this.domElements.subscribeBtn.disabled = true;
            this.domElements.liveIndicator.style.display = 'none';
            // StatsPanel handles its own display through events
        });

        this.eventEmitter.on('connection_error', (error) => {
            console.error('MQTT connection error:', error);
            this.isConnected = false;
            alert('Connection error: ' + error.userFriendly);
        });

        this.eventEmitter.on('mqtt_message', (messageData) => {
            this.handleMQTTMessage(messageData);
        });

        this.eventEmitter.on('topic_subscribed', (topic) => {
            console.log('Successfully subscribed to:', topic);
        });

        this.eventEmitter.on('topic_unsubscribed', (topic) => {
            console.log('Successfully unsubscribed from:', topic);
        });

        this.eventEmitter.on('broker_info', (brokerInfo) => {
            this.updateBrokerInfo(brokerInfo);
        });
    }

    updateBrokerInfo(brokerInfo) {
        // Update broker URL display
        const brokerUrl = `${this.domElements.host.value}:${this.domElements.port.value}`;
        this.domElements.brokerUrl.textContent = brokerUrl;
        this.domElements.brokerUrlDisplay.style.display = 'block';
    }

    setupSidebarEventListeners() {
        // Listen to sidebar state changes
        this.eventEmitter.on('sidebar_state_changed', (state) => {
            console.log(`Sidebar state changed - collapsed: ${state.collapsed}`);
        });

        this.eventEmitter.on('sidebar_transition_complete', (state) => {
            // Update unified container position when sidebar transition completes
            if (this.unifiedContainer && this.layoutCalculator) {
                this.unifiedContainer.updateDimensions(this.layoutCalculator);

                // Network mode dimensions are now handled by NetworkGraph component
            }
        });

        // Handle automatic collapse on small screens
        this.eventEmitter.on('sidebar_auto_collapsed', (data) => {
            console.log('Sidebar auto-collapsed due to:', data.reason);
        });

        // Handle resize events
        this.eventEmitter.on('sidebar_resize', (dimensions) => {
            // Update layout calculations if needed
            if (this.layoutCalculator) {
                // Force recalculation of layout dimensions
                this.layoutCalculator.refresh?.();
            }
        });
    }

    setupThemeEventListeners() {
        // Listen to theme changes
        this.eventEmitter.on('theme_changed', (data) => {
            console.log(`Theme changed from '${data.oldTheme}' to '${data.newTheme}'`);
        });

        this.eventEmitter.on('theme_applied', (data) => {
            // Refresh colors when theme is applied
            this.refreshThemeColors(data.colors);
        });

        this.eventEmitter.on('system_theme_changed', (data) => {
            console.log(`System theme changed to '${data.theme}'`);
        });
    }

    setupModalEventListeners() {
        // Listen to modal events
        this.eventEmitter.on('modal_opened', (data) => {
            console.log(`Modal opened for: ${data.type}`, data.messageData?.topic || '');
        });

        this.eventEmitter.on('modal_closed', () => {
            console.log('Modal closed');
        });
    }

    setupStatsEventListeners() {
        // Listen to stats panel events
        this.eventEmitter.on('stats_updated', (stats) => {
            // Optional: Log stats updates or perform additional processing
            if (this.options?.debugStats) {
                console.log('Stats updated:', stats);
            }
        });

        this.eventEmitter.on('active_cards_request', () => {
            // Provide current active cards count to stats panel
            let activeCards = 0;

            if (this.visualizationMode === 'bubbles' && this.bubbleAnimation) {
                // For bubbles mode, get count from BubbleAnimation
                const state = this.bubbleAnimation.getState();
                activeCards = state.activeBubbles || 0;
            } else if (this.visualizationMode === 'network' && this.networkGraph) {
                // For network mode, get count from NetworkGraph
                const state = this.networkGraph.getState();
                activeCards = state.activeNodes || 0;
            } else if (this.visualizationMode === 'starfield' && this.starfieldVisualization) {
                // For starfield mode, get count from StarfieldVisualization
                const state = this.starfieldVisualization.getState();
                activeCards = state.activeStars || 0;
            } else if (this.visualizationMode === 'radial' && this.radialVisualization) {
                // For radial mode, get count from RadialVisualization
                const state = this.radialVisualization.getState();
                activeCards = state.activeElements || 0;
            } else if (this.visualizationMode === 'clusters' && this.clusteredBubbles) {
                // For clusters mode, get count from ClusteredBubbles
                const state = this.clusteredBubbles.getState();
                activeCards = state.activeNodes || 0;
            } else {
                // For other modes, use unified element tracker
                activeCards = this.elementTracker ? this.elementTracker.getCounts().total : 0;
            }

            this.statsPanel.setActiveCards(activeCards);
        });

        this.eventEmitter.on('stats_panel_shown', () => {
            console.log('Stats panel shown');
        });

        this.eventEmitter.on('stats_panel_hidden', () => {
            console.log('Stats panel hidden');
        });
    }

    setupVisualizationEventListeners() {
        // Listen to visualization events
        this.eventEmitter.on('element_created', (data) => {
            // Track element creation for performance monitoring
            if (this.options?.debugVisualization) {
                console.log('Element created:', data.type, data.message?.topic);
            }
        });

        this.eventEmitter.on('visualization_cleaned', (data) => {
            console.log(`Visualization cleaned: ${data.elementsRemoved} elements in ${data.cleanupTime}ms`);
        });

        this.eventEmitter.on('visualization_performance', (metrics) => {
            if (this.options?.debugPerformance) {
                console.log('Visualization performance:', metrics);
            }
        });

        this.eventEmitter.on('visualization_theme_updated', (themeData) => {
            console.log(`Visualization theme updated: ${themeData.newTheme}`);
        });
    }

    setupColorLegendEventListeners() {
        // Listen to theme changes to update color legend
        this.eventEmitter.on('theme_changed', (themeData) => {
            this.colorLegend.handleThemeChange();
        });

        // Listen for bubble clicks to show message modal
        this.eventEmitter.on('bubble_clicked', (data) => {
            console.log('Bubble clicked:', data.message.topic);
            this.modalController.showMessageModal(data.message);
        });
    }

    refreshThemeColors(newColors) {
        // Clear existing colors to regenerate with new theme
        this.topicColors.clear();
        this.customerColors.clear();

        // If we have active topics, regenerate their colors
        if (this.activeTopics.size > 0) {
            this.activeTopics.forEach(topic => {
                this.getTopicColor(topic); // This will generate new colors for the current theme
            });
        }

        console.log('Theme colors refreshed');
    }

    // Legacy WebSocket Management removed - now handled by MQTTConnectionManager

    handleMQTTMessage(messageData) {

        // Route message to appropriate visualization system
        if (this.visualizationMode === 'bubbles' && this.bubbleAnimation) {
            console.log('📨 Routing message to BubbleAnimation system:', messageData);

            // Track active topics
            this.activeTopics.add(messageData.topic);

            // Send message to bubble animation system
            this.bubbleAnimation.addMessage(messageData);

            // Update stats
            this.eventEmitter.emit('message_processed', {
                topic: messageData.topic,
                timestamp: messageData.timestamp,
                mode: 'bubbles'
            });
        } else if (this.visualizationMode === 'network' && this.networkGraph) {
            // Track active topics
            this.activeTopics.add(messageData.topic);

            // Send message to network graph system
            this.networkGraph.addMessage(messageData);

            // Update stats
            this.eventEmitter.emit('message_processed', {
                topic: messageData.topic,
                timestamp: messageData.timestamp,
                mode: 'network'
            });
        } else if (this.visualizationMode === 'starfield' && this.starfieldVisualization) {
            console.log('🌟 Routing message to StarfieldVisualization system:', messageData);
            // Track active topics
            this.activeTopics.add(messageData.topic);
            // Send message to starfield visualization system
            this.starfieldVisualization.addMessage(messageData);
            // Update stats
            this.eventEmitter.emit('message_processed', {
                topic: messageData.topic,
                timestamp: messageData.timestamp,
                mode: 'starfield'
            });
        } else if (this.visualizationMode === 'radial' && this.radialVisualization) {
            console.log('🔴 Routing message to RadialVisualization system:', messageData);
            // Track active topics
            this.activeTopics.add(messageData.topic);
            // Send message to radial visualization system
            this.radialVisualization.addMessage(messageData);
            // Update stats
            this.eventEmitter.emit('message_processed', {
                topic: messageData.topic,
                timestamp: messageData.timestamp,
                mode: 'radial'
            });
        } else if (this.visualizationMode === 'clusters' && this.clusteredBubbles) {
            console.log('🟡 Routing message to ClusteredBubbles system:', messageData);
            // Track active topics
            this.activeTopics.add(messageData.topic);
            // Send message to clustered bubbles system
            this.clusteredBubbles.addMessage(messageData);
            // Update stats
            this.eventEmitter.emit('message_processed', {
                topic: messageData.topic,
                timestamp: messageData.timestamp,
                mode: 'clusters'
            });
        } else {
            // Route to other visualization modes (legacy)
            this.createVisualization(messageData);

            // Still track topics for UI
            this.activeTopics.add(messageData.topic);

            // Update stats
            this.eventEmitter.emit('message_processed', {
                topic: messageData.topic,
                timestamp: messageData.timestamp,
                mode: this.visualizationMode || 'unknown'
            });
        }
    }

    // Removed: updateMessageRate() - now handled by StatsPanel

    createVisualization(messageData) {
        if (this.visualizationMode === 'network') {
            this.updateNetworkGraph(messageData);
        }
        // Note: bubbles mode is now handled by BubbleAnimation component via handleMQTTMessage
        // Note: clusters mode is now handled by ClusteredBubbles component via handleMQTTMessage
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
        if (this.visualizationMode === 'bubbles') {
            // Start with full brightness, will be smoothly adjusted during animation
            styles.filter = 'brightness(1.0)';
            bubble.dataset.brightness = '1.0'; // Store initial brightness
            bubble.dataset.scale = '1.0'; // Normal scale for bubbles mode
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
        
        // Legacy bubbles mode: now handled by BubbleAnimation component
        // This fallback should not be reached since bubbles mode uses BubbleAnimation
        // Radial mode now handled by RadialVisualization component
        startX = flowWidth / 2;
        startY = flowHeight / 2;
        console.warn('createMessageBubble: Unexpected fallback to legacy mode');

        // For fallback bubbles mode, disable transitions for manual animation
        bubble.style.transition = 'none';
        bubble.style.left = `${startX}px`;
        bubble.style.top = `${startY}px`;
        
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

        // Legacy radial animation removed - now handled by RadialVisualization component
        // Legacy bubbles animation: now handled by BubbleAnimation component
        console.warn('animateMessage: Unexpected fallback to legacy bubbles mode');
        // Just fade out the bubble since this shouldn't happen
        bubble.style.transition = 'opacity 1s ease-out';
        bubble.style.opacity = '0';
        setTimeout(() => {
            if (bubble.parentNode) {
                bubble.parentNode.removeChild(bubble);
                this.returnBubbleToPool(bubble);
            }
        }, 1000);
    }

    // Network Graph Implementation is now handled by NetworkGraph component

    // Clusters Implementation - Now handled by ClusteredBubbles component via handleMQTTMessage

    // Initialize network mode (wrapper for D3 network initialization)
    initializeNetworkMode() {
        console.log('MQTTVisualizer: Initializing network mode');
        this.initializeD3Network();
        console.log('MQTTVisualizer: Network mode initialization complete');
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
            x: this.SCREEN_CENTER_X,
            y: this.SCREEN_CENTER_Y,
            fx: this.SCREEN_CENTER_X, // Fix position
            fy: this.SCREEN_CENTER_Y, // Fix position
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
        const minBrightness = 0.3; // Minimum 30% brightness
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
        // Update brightness and smooth scaling for message bubbles in bubbles mode only
        // (radial mode now handled by RadialVisualization component)
        if (this.visualizationMode !== 'bubbles') {
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

            // Scale handling for bubbles mode (legacy radial mode scaling removed)
            let targetScale = 1.0; // Normal scale for bubbles mode

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
            .attr('cx', d => {
                // Only use broker center positioning for network graph mode
                if (this.visualizationMode === 'network') {
                    // Start new nodes at broker center if not positioned
                    if (d.x !== undefined && d.x !== null) return d.x;
                    const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
                    return brokerNode ? brokerNode.x : this.SCREEN_CENTER_X;
                }
                return d.x || 0;
            })
            .attr('cy', d => {
                // Only use broker center positioning for network graph mode
                if (this.visualizationMode === 'network') {
                    // Start new nodes at broker center if not positioned
                    if (d.y !== undefined && d.y !== null) return d.y;
                    const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
                    return brokerNode ? brokerNode.y : this.SCREEN_CENTER_Y;
                }
                return d.y || 0;
            })
            .attr('fill', d => d.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', d => d.type === 'broker' ? 3 : 2)
            .attr('filter', 'url(#glow)')
            .style('opacity', d => d.brightness || 1.0);
        
        // Add labels with initial positions and brightness
        const textElements = nodeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('x', d => {
                // Only use broker center positioning for network graph mode
                if (this.visualizationMode === 'network') {
                    // Start new node labels at broker center if not positioned
                    if (d.x !== undefined && d.x !== null) return d.x;
                    const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
                    return brokerNode ? brokerNode.x : this.SCREEN_CENTER_X;
                }
                return d.x || 0;
            })
            .attr('y', d => {
                // Only use broker center positioning for network graph mode
                let baseY;
                if (this.visualizationMode === 'network') {
                    if (d.y !== undefined && d.y !== null) {
                        baseY = d.y;
                    } else {
                        const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
                        baseY = brokerNode ? brokerNode.y : this.SCREEN_CENTER_Y;
                    }
                } else {
                    baseY = d.y || 0;
                }
                return baseY + (d.radius || 20) + 25; // Position below circle: radius + 25px margin
            })
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
        
        // Ensure broker is at screen center if not positioned
        if (!brokerNode.x || !brokerNode.y || (brokerNode.x === 0 && brokerNode.y === 0)) {
            brokerNode.x = brokerNode.fx || this.SCREEN_CENTER_X;
            brokerNode.y = brokerNode.fy || this.SCREEN_CENTER_Y;
        }
        
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
    
    // Legacy updateCustomerNode method removed - functionality moved to addNetworkMessage()
    
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
    
    // calculatePositionScore method removed - legacy compatibility shim no longer needed
    
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

    // Legacy D3 Bubbles Implementation removed - now handled by BubbleAnimation component
    
    // Legacy createD3Bubble method removed - now handled by BubbleAnimation component

    

    // Visualization switching
    switchVisualization(mode) {
        if (!mode) {
            // If no mode provided, get from current active button
            const activeBtn = document.querySelector('.viz-icon-btn.active, .viz-mode-btn.active');
            mode = activeBtn ? activeBtn.dataset.mode : 'radial';
        }

        console.log(`Setting visualization mode to: ${mode}`);

        // Deactivate current visualization system (avoid deactivating the target)
        if (mode !== 'bubbles' && this.bubbleAnimation) {
            this.bubbleAnimation.deactivate();
        }
        if (mode !== 'network' && this.networkGraph) {
            this.networkGraph.deactivate();
        }
        if (mode !== 'starfield' && this.starfieldVisualization) {
            this.starfieldVisualization.deactivate();
        }
        if (mode !== 'radial' && this.radialVisualization) {
            this.radialVisualization.deactivate();
        }
        if (mode !== 'clusters' && this.clusteredBubbles) {
            this.clusteredBubbles.deactivate();
        }

        // Enable the requested mode
        if (mode === 'bubbles') {
            // Activate the bubble animation system
            this.bubbleAnimation.activate();
            this.visualizationMode = mode;

            // Update button states
            this.updateVisualizationButtonStates(mode);

            console.log('Bubbles mode activated successfully');
            return true;
        } else if (mode === 'network') {
            // Activate the network graph system
            this.networkGraph.activate();
            this.visualizationMode = mode;

            // Update button states
            this.updateVisualizationButtonStates(mode);

            console.log('Network mode activated successfully');
            return true;
        } else if (mode === 'starfield') {
            // Activate the starfield visualization system
            this.starfieldVisualization.activate();
            this.visualizationMode = mode;

            // Update button states
            this.updateVisualizationButtonStates(mode);

            console.log('Starfield mode activated successfully');
            return true;
        } else if (mode === 'radial') {
            // Activate the radial visualization system
            this.radialVisualization.activate();
            this.visualizationMode = mode;

            // Update button states
            this.updateVisualizationButtonStates(mode);

            console.log('Radial mode activated successfully');
            return true;
        } else if (mode === 'clusters') {
            // Activate the clustered bubbles visualization system
            this.clusteredBubbles.activate();
            this.visualizationMode = mode;

            // Update button states
            this.updateVisualizationButtonStates(mode);

            console.log('Clusters mode activated successfully');
            return true;
        }

        // Other visualization modes are temporarily disabled during refactoring
        console.log(`Visualization mode '${mode}' is temporarily disabled during refactoring`);

        // Show refactoring status instead
        this.showRefactoringStatus();

        // Still update the button states for UI testing
        this.updateVisualizationButtonStates(mode);

        return false;
    }

    showRefactoringStatus() {
        // Clear the message flow area and show refactoring status
        const messageFlow = this.domElements.messageFlow;
        if (!messageFlow) return;

        messageFlow.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px; background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%); color: white; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                <div style="background: rgba(0,0,0,0.2); padding: 30px; border-radius: 15px; max-width: 800px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
                    <h2 style="margin: 0 0 20px 0; color: #ecf0f1; font-size: 2.2em; font-weight: 300;">🔧 Refactoring in Progress</h2>

                    <div style="text-align: left; margin-bottom: 30px;">
                        <h3 style="color: #1abc9c; margin-bottom: 15px; border-bottom: 2px solid #1abc9c; padding-bottom: 5px;">✅ Completed Components (Available for Testing)</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li style="margin: 8px 0; padding: 8px; background: rgba(39, 174, 96, 0.2); border-left: 4px solid #27ae60; border-radius: 4px;">
                                <strong>🏗️ DOM Manager:</strong> Centralized element caching, validation, lazy loading
                            </li>
                            <li style="margin: 8px 0; padding: 8px; background: rgba(39, 174, 96, 0.2); border-left: 4px solid #27ae60; border-radius: 4px;">
                                <strong>📱 Sidebar Controller:</strong> Toggle sidebar, state persistence, responsive behavior
                            </li>
                            <li style="margin: 8px 0; padding: 8px; background: rgba(39, 174, 96, 0.2); border-left: 4px solid #27ae60; border-radius: 4px;">
                                <strong>🎨 Theme Manager:</strong> Multiple themes, system detection, custom themes
                            </li>
                            <li style="margin: 8px 0; padding: 8px; background: rgba(39, 174, 96, 0.2); border-left: 4px solid #27ae60; border-radius: 4px;">
                                <strong>🔌 MQTT Connection:</strong> SSL/TLS support, smart reconnection, WebSocket handling
                            </li>
                            <li style="margin: 8px 0; padding: 8px; background: rgba(39, 174, 96, 0.2); border-left: 4px solid #27ae60; border-radius: 4px;">
                                <strong>💫 Bubbles Visualization:</strong> D3.js falling bubbles with gravity physics
                            </li>
                            <li style="margin: 8px 0; padding: 8px; background: rgba(39, 174, 96, 0.2); border-left: 4px solid #27ae60; border-radius: 4px;">
                                <strong>🌐 Network Visualization:</strong> Force-directed graph with broker connections
                            </li>
                        </ul>
                    </div>

                    <div style="text-align: left; margin-bottom: 20px;">
                        <h3 style="color: #f39c12; margin-bottom: 15px; border-bottom: 2px solid #f39c12; padding-bottom: 5px;">🚧 Components Being Refactored</h3>
                        <ul style="list-style: none; padding: 0;">
                            <li style="margin: 8px 0; padding: 8px; background: rgba(243, 156, 18, 0.2); border-left: 4px solid #f39c12; border-radius: 4px;">
                                <strong>📋 Modal Controller:</strong> Reusable modal system, keyboard navigation
                            </li>
                            <li style="margin: 8px 0; padding: 8px; background: rgba(231, 76, 60, 0.2); border-left: 4px solid #e74c3c; border-radius: 4px;">
                                <strong>📊 Stats Panel:</strong> Performance monitoring, statistics display
                            </li>
                            <li style="margin: 8px 0; padding: 8px; background: rgba(231, 76, 60, 0.2); border-left: 4px solid #e74c3c; border-radius: 4px;">
                                <strong>📈 All Visualizations:</strong> D3.js optimization, modular design
                            </li>
                        </ul>
                    </div>

                    <div style="background: rgba(52, 152, 219, 0.3); padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <h4 style="color: #3498db; margin: 0 0 10px 0;">🧪 What You Can Test Right Now:</h4>
                        <div style="text-align: left; color: #ecf0f1;">
                            <p><strong>Sidebar:</strong> Toggle with the chevron button, test responsive behavior on different screen sizes</p>
                            <p><strong>Themes:</strong> Switch between themes in the dropdown (dark, spring, summer, autumn, winter)</p>
                            <p><strong>MQTT Connection:</strong> Test SSL/TLS connections, form validation, error handling</p>
                            <p><strong>Bubbles Mode:</strong> D3.js falling bubbles with gravity, customer colors, click interactions</p>
                            <p><strong>Network Mode:</strong> Force-directed graph showing broker → customer → topic connections</p>
                            <p><strong>UI Responsiveness:</strong> Resize window, test button states, form interactions</p>
                        </div>
                    </div>

                    <p style="margin: 20px 0 0 0; font-style: italic; color: #bdc3c7; font-size: 0.9em;">
                        Progress: 8/23 tasks completed (~35%) | Next: Modal Controller & Stats Panel
                    </p>
                </div>
            </div>
        `;
    }
    
    // Update active states for visualization buttons
    updateVisualizationButtonStates(activeMode) {
        // Use sidebar controller to update visualization buttons
        this.sidebarController.updateVisualizationButtons(activeMode);
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
        // Legacy radial animation counter removed
        
        // Clean up unified container (removes all visualizations)
        if (this.unifiedContainer) {
            this.unifiedContainer.cleanup();
        }
        
        // Clear legacy references
        this.d3BubblesSvg = null;
        this.d3BubblesContainer = null;
        this.d3BubblesData = [];
        
        // Legacy D3 radial references removed (now handled by RadialVisualization component)
        
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

    // Color Management - delegated to BaseVisualization
    getTopicColor(topic) {
        const color = this.baseVisualization.getTopicColor(topic);
        this.updateTopicLegend();
        return color;
    }

    getCustomerColor(customer) {
        return this.baseVisualization.getCustomerColor(customer);
    }

    // Get theme colors using theme manager
    getThemeColors() {
        return this.themeManager.getCurrentColors();
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
        return this.baseVisualization.extractCustomerFromTopic(topic);
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

    // Removed: updateStats() - now handled by StatsPanel

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


    // Removed: startStatsUpdate() - now handled by StatsPanel

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
        console.log('=== MQTTVisualizer.toggleConnection called ===');
        console.log('Connection Manager status:', this.mqttConnectionManager ? 'Available' : 'NOT AVAILABLE');

        if (!this.mqttConnectionManager) {
            console.error('❌ MQTT Connection Manager not initialized!');
            alert('Connection manager not available. Please refresh the page.');
            return;
        }

        try {
            console.log('📞 Calling mqttConnectionManager.toggleConnection()...');
            const result = await this.mqttConnectionManager.toggleConnection();
            console.log('✅ mqttConnectionManager.toggleConnection() completed:', result);
        } catch (error) {
            console.error('❌ Toggle connection failed:', error);
            alert('Connection failed: ' + error.message);
        }
    }

    async connect() {
        try {
            await this.mqttConnectionManager.connect();
        } catch (error) {
            console.error('Connection failed:', error);
            alert('Connection failed: ' + error.message);
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
            await this.mqttConnectionManager.disconnect();
        } catch (error) {
            console.error('Disconnect failed:', error);
            // Still update UI even if API call fails
            this.updateConnectionStatus('disconnected');
            this.isConnected = false;
        }
    }

    resetClientState() {
        this.isConnected = false;
        this.activeTopics.clear();
        this.topicColors.clear();
        this.messageHistory = [];
        
        this.updateTopicLegend();
        this.baseVisualization.cleanup();

        // StatsPanel handles display through events
    }

    async subscribeToTopic() {
        const topic = this.domElements.topic.value;

        try {
            await this.mqttConnectionManager.subscribeToTopic(topic);
            this.domElements.topic.value = '';
        } catch (error) {
            console.error('Subscription failed:', error);
            alert('Subscription failed: ' + error.message);
        }
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
        
        // Start performance monitoring with frame rate updates
        this.performanceManager.startMonitoring((fps, metrics) => {
            // Emit frame rate event for StatsPanel
            this.eventEmitter.emit('frame_rendered');

            // Emit active cards request
            this.eventEmitter.emit('active_cards_request');
        });
    }
    
}

// Main application initialization
let visualizer;

console.log('🎯 APP.JS LOADED SUCCESSFULLY! Starting initialization...');

/**
 * Initialize the application
 */
function initializeApplication() {
    console.log('🚀 Initializing MQTT Visualizer...');
    try {
        console.log('📝 Creating new MQTTVisualizer instance...');
        visualizer = new MQTTVisualizer();

        // Setup global functions for HTML onclick handlers
        setupGlobalFunctions(visualizer);

        console.log('✅ Visualizer initialized successfully:', visualizer);
        console.log('🎯 Global functions available:', typeof window.toggleConnection);

        return visualizer;
    } catch (error) {
        console.error('❌ Failed to initialize visualizer:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error details:', error.name, error.message);
        throw error;
    }
}

// Initialize when page loads
console.log('🔧 Setting up DOMContentLoaded listener...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOMContentLoaded event fired!');
    initializeApplication();
});

console.log('✅ DOMContentLoaded listener added successfully');

// Also try immediate initialization if DOM is already loaded
if (document.readyState === 'loading') {
    console.log('📋 DOM is still loading, waiting for DOMContentLoaded...');
} else {
    console.log('📋 DOM already loaded, initializing immediately...');
    initializeApplication();
}