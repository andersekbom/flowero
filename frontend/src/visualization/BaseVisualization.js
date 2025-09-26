/**
 * Base Visualization Component
 *
 * Provides common functionality for all visualization modes including:
 * - Circle rendering and animation management
 * - Color management and theme integration
 * - Message processing and data transformation
 * - Performance tracking and optimization
 */

/**
 * Reusable Circle Renderer for consistent styling across all visualization modes
 */
class CircleRenderer {
    static createCircleElement(color, deviceId, options = {}) {
        const {
            size = 50,
            showLabel = true,
            className = 'circle-element'
        } = options;

        // Create main container
        const element = document.createElement('div');
        element.className = className;

        // Apply base styles
        Object.assign(element.style, {
            width: `${size}px`,
            height: `${size}px`,
            backgroundColor: color,
            borderRadius: '50%',
            position: 'absolute',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 2px 8px ${color}40`,
            border: `2px solid ${color}`,
            overflow: 'hidden'
        });

        // Add label if requested
        if (showLabel && deviceId) {
            const label = document.createElement('div');
            label.textContent = deviceId;
            label.style.cssText = `
                color: white;
                font-size: 10px;
                font-weight: bold;
                text-align: center;
                pointer-events: none;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            `;
            element.appendChild(label);
        }

        return element;
    }

    static createSVGCircle(container, color, deviceId, x, y, options = {}) {
        const {
            radius = 25,
            showLabel = true,
            opacity = 0.8
        } = options;

        // Create SVG circle element
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', radius);
        circle.setAttribute('fill', color);
        circle.setAttribute('opacity', opacity);
        circle.setAttribute('stroke', color);
        circle.setAttribute('stroke-width', '2');
        circle.style.cursor = 'pointer';

        // Add to container
        if (container) {
            container.appendChild(circle);
        }

        // Add label if requested
        if (showLabel && deviceId) {
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x);
            text.setAttribute('y', y + 4); // Center vertically
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('fill', 'white');
            text.setAttribute('font-size', '10');
            text.setAttribute('font-weight', 'bold');
            text.style.pointerEvents = 'none';
            text.textContent = deviceId;

            if (container) {
                container.appendChild(text);
            }
        }

        return circle;
    }

    static getDefaultOptions() {
        return {
            size: 50,
            radius: 25,
            showLabel: true,
            className: 'circle-element',
            opacity: 0.8
        };
    }
}

/**
 * Base Visualization Class
 * Provides common functionality for all visualization modes
 */
class BaseVisualization {
    constructor(domManager, eventEmitter, themeManager, options = {}) {
        this.domManager = domManager;
        this.eventEmitter = eventEmitter;
        this.themeManager = themeManager;

        this.options = {
            enableAnimations: true,
            maxElements: 200,
            cleanupInterval: 5000,
            enablePerformanceTracking: true,
            enableColorManagement: true,
            ...options
        };

        this.initialized = false;
        this.isActive = false;
        this.currentMode = null;

        // Color management
        this.topicColors = new Map();
        this.customerColors = new Map();
        this.colorIndex = 0;

        // Animation and performance tracking
        this.animationFramePool = new Set();
        this.activeAnimations = new Map();
        this.performanceMetrics = {
            elementsCreated: 0,
            elementsDestroyed: 0,
            averageRenderTime: 0,
            lastCleanup: Date.now()
        };

        // DOM container
        this.container = null;
        this.svgContainer = null;
    }

    /**
     * Initialize the visualization system
     */
    initialize() {
        this.cacheElements();
        this.setupEventListeners();
        this.initializeColorManagement();

        this.initialized = true;
        console.log('BaseVisualization: Initialized successfully');
        return this;
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.container = this.domManager.get('messageFlow');

        if (!this.container) {
            console.warn('BaseVisualization: Message flow container not found');
            return;
        }

        // Create or find SVG container for SVG-based visualizations
        this.svgContainer = this.container.querySelector('svg');
        if (!this.svgContainer) {
            this.svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this.svgContainer.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1;
            `;
            this.container.appendChild(this.svgContainer);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for theme changes
        this.eventEmitter.on('theme_changed', (data) => {
            this.handleThemeChange(data);
        });

        // Listen for cleanup requests
        this.eventEmitter.on('visualization_cleanup', () => {
            this.cleanup();
        });

        // Listen for mode switches
        this.eventEmitter.on('visualization_mode_changed', (mode) => {
            this.handleModeChange(mode);
        });

        // Performance monitoring
        if (this.options.enablePerformanceTracking) {
            this.eventEmitter.on('performance_check', () => {
                this.emitPerformanceMetrics();
            });
        }
    }

    /**
     * Initialize color management system
     */
    initializeColorManagement() {
        if (!this.options.enableColorManagement) {
            return;
        }

        // Get initial theme colors
        this.refreshThemeColors();

        // Set up periodic color cleanup
        setInterval(() => {
            this.cleanupUnusedColors();
        }, 30000); // Clean up every 30 seconds
    }

    /**
     * Process message data into standardized format
     */
    processMessage(messageData) {
        if (!messageData) {
            console.warn('BaseVisualization: Invalid message data');
            return null;
        }

        const customer = this.extractCustomerFromTopic(messageData.topic);
        const deviceId = this.extractDeviceFromTopic(messageData.topic);

        return {
            ...messageData,
            customer,
            deviceId,
            color: this.getTopicColor(messageData.topic),
            customerColor: this.getCustomerColor(customer),
            processedAt: Date.now()
        };
    }

    /**
     * Create a circle element using the renderer
     */
    createCircleElement(processedMessage, options = {}) {
        const mergedOptions = {
            ...CircleRenderer.getDefaultOptions(),
            ...options
        };

        const element = CircleRenderer.createCircleElement(
            processedMessage.color,
            processedMessage.deviceId,
            mergedOptions
        );

        // Track creation
        this.performanceMetrics.elementsCreated++;
        this.eventEmitter.emit('element_created', {
            type: 'circle',
            element,
            message: processedMessage
        });

        return element;
    }

    /**
     * Create an SVG circle element
     */
    createSVGElement(container, processedMessage, x, y, options = {}) {
        const mergedOptions = {
            ...CircleRenderer.getDefaultOptions(),
            ...options
        };

        const element = CircleRenderer.createSVGCircle(
            container,
            processedMessage.color,
            processedMessage.deviceId,
            x, y,
            mergedOptions
        );

        // Track creation
        this.performanceMetrics.elementsCreated++;
        this.eventEmitter.emit('element_created', {
            type: 'svg_circle',
            element,
            message: processedMessage
        });

        return element;
    }

    /**
     * Get color for a topic
     */
    getTopicColor(topic) {
        if (!this.options.enableColorManagement) {
            return '#4ECDC4'; // Default color
        }

        if (!this.topicColors.has(topic)) {
            const customer = this.extractCustomerFromTopic(topic);
            const color = this.getCustomerColor(customer);
            this.topicColors.set(topic, color);
        }
        return this.topicColors.get(topic);
    }

    /**
     * Get color for a customer
     */
    getCustomerColor(customer) {
        if (!this.options.enableColorManagement) {
            return '#4ECDC4'; // Default color
        }

        if (!this.customerColors.has(customer)) {
            const colors = this.getThemeColors();
            const color = colors[this.colorIndex % colors.length];
            this.customerColors.set(customer, color);
            this.colorIndex++;
        }
        return this.customerColors.get(customer);
    }

    /**
     * Get current theme colors
     */
    getThemeColors() {
        if (this.themeManager) {
            return this.themeManager.getCurrentColors();
        }

        // Fallback colors
        return [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
        ];
    }

    /**
     * Extract customer from topic
     */
    extractCustomerFromTopic(topic) {
        if (!topic) return 'unknown';
        const parts = topic.split('/');
        return parts[0] || 'unknown';
    }

    /**
     * Extract device from topic
     */
    extractDeviceFromTopic(topic) {
        if (!topic) return 'device';
        const parts = topic.split('/');
        return parts[1] || parts[parts.length - 1] || 'device';
    }

    /**
     * Handle theme changes
     */
    handleThemeChange(themeData) {
        console.log(`BaseVisualization: Theme changed to ${themeData.newTheme}`);
        this.refreshThemeColors();
        this.eventEmitter.emit('visualization_theme_updated', themeData);
    }

    /**
     * Refresh color mappings based on new theme
     */
    refreshThemeColors() {
        if (!this.options.enableColorManagement) {
            return;
        }

        // Clear existing colors to regenerate with new theme
        this.topicColors.clear();
        this.customerColors.clear();
        this.colorIndex = 0;

        console.log('BaseVisualization: Theme colors refreshed');
    }

    /**
     * Handle mode changes
     */
    handleModeChange(newMode) {
        const oldMode = this.currentMode;
        this.currentMode = newMode;

        console.log(`BaseVisualization: Mode changed from ${oldMode} to ${newMode}`);
        this.eventEmitter.emit('visualization_mode_transition', { oldMode, newMode });
    }

    /**
     * Activate visualization
     */
    activate() {
        this.isActive = true;
        this.eventEmitter.emit('visualization_activated', { mode: this.currentMode });
    }

    /**
     * Deactivate visualization
     */
    deactivate() {
        this.isActive = false;
        this.cleanup();
        this.eventEmitter.emit('visualization_deactivated', { mode: this.currentMode });
    }

    /**
     * Clean up all visualization elements
     */
    cleanup() {
        const startTime = Date.now();

        // Cancel all active animation frames
        this.animationFramePool.forEach(frameId => {
            cancelAnimationFrame(frameId);
        });
        this.animationFramePool.clear();

        // Clear active animations
        this.activeAnimations.clear();

        // Remove DOM elements
        if (this.container) {
            const elements = this.container.querySelectorAll('.message-bubble, .circle-element, .network-node');
            elements.forEach(element => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                this.performanceMetrics.elementsDestroyed++;
            });
        }

        // Clear SVG elements
        if (this.svgContainer) {
            while (this.svgContainer.firstChild) {
                this.svgContainer.removeChild(this.svgContainer.firstChild);
            }
        }

        const cleanupTime = Date.now() - startTime;
        this.performanceMetrics.lastCleanup = Date.now();

        console.log(`BaseVisualization: Cleanup completed in ${cleanupTime}ms`);
        this.eventEmitter.emit('visualization_cleaned', {
            cleanupTime,
            elementsRemoved: this.performanceMetrics.elementsDestroyed
        });
    }

    /**
     * Clean up unused colors
     */
    cleanupUnusedColors() {
        // This would be implemented by checking which colors are still in use
        // For now, just log the cleanup
        console.log('BaseVisualization: Color cleanup performed');
    }

    /**
     * Add animation frame to pool for tracking
     */
    addAnimationFrame(frameId) {
        this.animationFramePool.add(frameId);
        return frameId;
    }

    /**
     * Remove animation frame from pool
     */
    removeAnimationFrame(frameId) {
        this.animationFramePool.delete(frameId);
        if (frameId) {
            cancelAnimationFrame(frameId);
        }
    }

    /**
     * Get container dimensions
     */
    getContainerDimensions() {
        if (!this.container) {
            return { width: 0, height: 0 };
        }

        return {
            width: this.container.clientWidth,
            height: this.container.clientHeight
        };
    }

    /**
     * Emit performance metrics
     */
    emitPerformanceMetrics() {
        const metrics = {
            ...this.performanceMetrics,
            activeAnimations: this.animationFramePool.size,
            topicColors: this.topicColors.size,
            customerColors: this.customerColors.size
        };

        this.eventEmitter.emit('visualization_performance', metrics);
        return metrics;
    }

    /**
     * Get current state
     */
    getState() {
        return {
            initialized: this.initialized,
            isActive: this.isActive,
            currentMode: this.currentMode,
            performanceMetrics: this.performanceMetrics,
            colorStats: {
                topics: this.topicColors.size,
                customers: this.customerColors.size
            },
            animations: {
                active: this.animationFramePool.size,
                tracked: this.activeAnimations.size
            }
        };
    }

    /**
     * Destroy the visualization
     */
    destroy() {
        this.cleanup();

        // Remove event listeners
        this.eventEmitter.off('theme_changed');
        this.eventEmitter.off('visualization_cleanup');
        this.eventEmitter.off('visualization_mode_changed');
        this.eventEmitter.off('performance_check');

        this.initialized = false;
        console.log('BaseVisualization: Destroyed');
    }
}

export { BaseVisualization, CircleRenderer };
export default BaseVisualization;