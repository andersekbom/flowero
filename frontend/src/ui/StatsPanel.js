/**
 * Stats Panel Controller
 *
 * Manages statistics display, real-time updates, and performance metrics.
 * Provides reusable statistics system for monitoring MQTT message flow.
 */
class StatsPanel {
    constructor(domManager, eventEmitter, options = {}) {
        this.domManager = domManager;
        this.eventEmitter = eventEmitter;
        this.options = {
            updateInterval: 1000,      // Update frequency in milliseconds
            enableFrameRate: true,     // Show frame rate stats
            enableMessageRate: true,   // Show message rate stats
            enableTopicStats: true,    // Show topic statistics
            enablePerformanceStats: true, // Show performance metrics
            messageHistoryWindow: 60,  // Window for message rate calculation (seconds)
            ...options
        };

        this.initialized = false;
        this.updateIntervals = [];

        // Statistics data
        this.stats = {
            totalMessages: 0,
            messageRate: 0,
            activeTopics: new Set(),
            frameRate: 0,
            activeCards: 0,
            connectionUptime: 0,
            lastMessageTime: null
        };

        // Message rate tracking
        this.messageHistory = [];
        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        this.connectionStartTime = null;

        // DOM elements - cached from DOMManager
        this.elements = null;
    }

    /**
     * Initialize the stats panel
     */
    initialize() {
        this.cacheElements();
        this.setupEventListeners();
        this.startUpdateLoop();

        this.initialized = true;
        console.log('StatsPanel: Initialized successfully');
        return this;
    }

    /**
     * Cache required DOM elements
     */
    cacheElements() {
        this.elements = {
            statsPanel: this.domManager.get('statsPanel'),
            totalMessages: this.domManager.get('totalMessages'),
            messageRate: this.domManager.get('messageRate'),
            activeTopics: this.domManager.get('activeTopics'),
            frameRate: this.domManager.get('frameRate'),
            activeCards: this.domManager.get('activeCards')
        };

        if (!this.elements.statsPanel) {
            console.warn('StatsPanel: Stats panel element not found');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Listen for MQTT connection events
        this.eventEmitter.on('connection_established', () => {
            this.onConnectionEstablished();
        });

        this.eventEmitter.on('connection_lost', () => {
            this.onConnectionLost();
        });

        // Listen for message events
        this.eventEmitter.on('mqtt_message', (messageData) => {
            this.onMessageReceived(messageData);
        });

        // Listen for visualization updates
        this.eventEmitter.on('element_created', () => {
            this.updateActiveCards();
        });

        this.eventEmitter.on('element_removed', () => {
            this.updateActiveCards();
        });

        // Listen for frame updates
        this.eventEmitter.on('frame_rendered', () => {
            this.incrementFrameCount();
        });

        // Listen for external stats requests
        this.eventEmitter.on('stats_request', () => {
            this.emitStats();
        });

        this.eventEmitter.on('stats_reset', () => {
            this.resetStats();
        });
    }

    /**
     * Start the update loop
     */
    startUpdateLoop() {
        // Main stats update loop
        const mainUpdate = setInterval(() => {
            this.updateDisplay();
        }, this.options.updateInterval);

        this.updateIntervals.push(mainUpdate);

        // Frame rate update (more frequent)
        if (this.options.enableFrameRate) {
            this.startFrameRateTracking();
        }
    }

    /**
     * Start frame rate tracking
     */
    startFrameRateTracking() {
        let lastStatsUpdate = Date.now();

        const updateFrameRate = () => {
            const now = Date.now();
            this.frameCount++;

            // Update frame rate every 500ms for smooth display
            if (now - lastStatsUpdate >= 500) {
                const elapsed = (now - lastStatsUpdate) / 1000;
                const fps = Math.round(this.frameCount / elapsed);

                this.stats.frameRate = fps;

                if (this.elements.frameRate) {
                    this.elements.frameRate.textContent = fps;
                }

                this.frameCount = 0;
                lastStatsUpdate = now;
            }

            requestAnimationFrame(updateFrameRate);
        };

        requestAnimationFrame(updateFrameRate);
    }

    /**
     * Handle connection established
     */
    onConnectionEstablished() {
        this.connectionStartTime = Date.now();
        this.show();
        this.resetStats();

        console.log('StatsPanel: Connection established, showing panel');
    }

    /**
     * Handle connection lost
     */
    onConnectionLost() {
        this.connectionStartTime = null;
        this.hide();

        console.log('StatsPanel: Connection lost, hiding panel');
    }

    /**
     * Handle message received
     */
    onMessageReceived(messageData) {
        if (!messageData || !this.options.enableMessageRate) {
            return;
        }

        // Update total message count
        this.stats.totalMessages++;

        // Update message rate tracking
        this.updateMessageRate();

        // Track topic
        if (messageData.topic && this.options.enableTopicStats) {
            this.stats.activeTopics.add(messageData.topic);
        }

        // Update last message time
        this.stats.lastMessageTime = Date.now();
    }

    /**
     * Update message rate calculation
     */
    updateMessageRate() {
        const now = Date.now();
        this.messageHistory.push(now);

        // Keep only messages within the window for rate calculation
        const cutoffTime = now - (this.options.messageHistoryWindow * 1000);
        let i = 0;
        while (i < this.messageHistory.length && this.messageHistory[i] < cutoffTime) {
            i++;
        }
        if (i > 0) {
            this.messageHistory.splice(0, i);
        }

        // Calculate rate (messages per second)
        this.stats.messageRate = this.messageHistory.length / this.options.messageHistoryWindow;
    }

    /**
     * Increment frame count
     */
    incrementFrameCount() {
        this.frameCount++;
    }

    /**
     * Update active cards count
     */
    updateActiveCards() {
        // This would be updated by external systems
        // We emit an event to request the current count
        this.eventEmitter.emit('active_cards_request');
    }

    /**
     * Set active cards count (called externally)
     */
    setActiveCards(count) {
        this.stats.activeCards = count;
    }

    /**
     * Update all display elements
     */
    updateDisplay() {
        if (!this.elements.statsPanel || !this.initialized) {
            return;
        }

        // Update message rate
        if (this.elements.messageRate && this.options.enableMessageRate) {
            this.elements.messageRate.textContent = this.stats.messageRate.toFixed(1);
        }

        // Update active topics
        if (this.elements.activeTopics && this.options.enableTopicStats) {
            this.elements.activeTopics.textContent = this.stats.activeTopics.size;
        }

        // Update total messages
        if (this.elements.totalMessages) {
            this.elements.totalMessages.textContent = this.stats.totalMessages;
        }

        // Update active cards
        if (this.elements.activeCards) {
            this.elements.activeCards.textContent = this.stats.activeCards;
        }

        // Update connection uptime
        if (this.connectionStartTime) {
            this.stats.connectionUptime = Date.now() - this.connectionStartTime;
        }

        // Emit stats update event
        this.emitStats();
    }

    /**
     * Emit current statistics
     */
    emitStats() {
        this.eventEmitter.emit('stats_updated', {
            ...this.stats,
            activeTopics: this.stats.activeTopics.size // Convert Set to number
        });
    }

    /**
     * Reset all statistics
     */
    resetStats() {
        this.stats.totalMessages = 0;
        this.stats.messageRate = 0;
        this.stats.activeTopics.clear();
        this.stats.activeCards = 0;
        this.stats.connectionUptime = 0;
        this.stats.lastMessageTime = null;

        this.messageHistory = [];
        this.frameCount = 0;
        this.lastFrameTime = Date.now();

        // Update display immediately
        this.updateDisplay();

        console.log('StatsPanel: Statistics reset');
        this.eventEmitter.emit('stats_reset_complete');
    }

    /**
     * Show the stats panel
     */
    show() {
        if (this.elements.statsPanel) {
            this.elements.statsPanel.style.display = 'block';
        }
        this.eventEmitter.emit('stats_panel_shown');
    }

    /**
     * Hide the stats panel
     */
    hide() {
        if (this.elements.statsPanel) {
            this.elements.statsPanel.style.display = 'none';
        }
        this.eventEmitter.emit('stats_panel_hidden');
    }

    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isVisible()) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Check if panel is visible
     */
    isVisible() {
        if (!this.elements.statsPanel) {
            return false;
        }

        const style = window.getComputedStyle(this.elements.statsPanel);
        return style.display !== 'none';
    }

    /**
     * Get current statistics
     */
    getStats() {
        return {
            ...this.stats,
            activeTopics: this.stats.activeTopics.size,
            uptime: this.stats.connectionUptime,
            isVisible: this.isVisible()
        };
    }

    /**
     * Update specific statistic
     */
    updateStat(key, value) {
        if (this.stats.hasOwnProperty(key)) {
            this.stats[key] = value;

            // Special handling for topics
            if (key === 'activeTopics' && typeof value === 'string') {
                this.stats.activeTopics.add(value);
            }
        }
    }

    /**
     * Get performance metrics
     */
    getPerformanceMetrics() {
        return {
            frameRate: this.stats.frameRate,
            messageRate: this.stats.messageRate,
            activeCards: this.stats.activeCards,
            memoryUsage: this.getMemoryUsage(),
            lastUpdate: Date.now()
        };
    }

    /**
     * Get memory usage (if available)
     */
    getMemoryUsage() {
        if (performance && performance.memory) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    /**
     * Format uptime for display
     */
    formatUptime(milliseconds) {
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    /**
     * Get state for debugging
     */
    getState() {
        return {
            initialized: this.initialized,
            isVisible: this.isVisible(),
            stats: this.getStats(),
            options: this.options,
            elements: this.elements ? Object.keys(this.elements) : []
        };
    }

    /**
     * Destroy the stats panel
     */
    destroy() {
        // Clear all intervals
        this.updateIntervals.forEach(interval => {
            clearInterval(interval);
        });
        this.updateIntervals = [];

        // Remove event listeners
        this.eventEmitter.off('connection_established');
        this.eventEmitter.off('connection_lost');
        this.eventEmitter.off('mqtt_message');
        this.eventEmitter.off('element_created');
        this.eventEmitter.off('element_removed');
        this.eventEmitter.off('frame_rendered');
        this.eventEmitter.off('stats_request');
        this.eventEmitter.off('stats_reset');

        // Hide panel
        this.hide();

        this.initialized = false;
        console.log('StatsPanel: Destroyed');
    }
}

export default StatsPanel;