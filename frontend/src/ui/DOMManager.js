/**
 * DOM Manager
 *
 * Centralized DOM element caching and management system.
 * Provides lazy loading, validation, and error handling for DOM elements.
 */
class DOMManager {
    constructor() {
        this.cache = new Map();
        this.requiredElements = new Set();
        this.optionalElements = new Set();
        this.initialized = false;
    }

    /**
     * Initialize the DOM manager with element definitions
     */
    initialize() {
        this.defineElementStructure();
        this.cacheAllElements();
        this.validateRequiredElements();
        this.initialized = true;
        return this;
    }

    /**
     * Define the structure of DOM elements
     */
    defineElementStructure() {
        // Define required elements (app won't work without these)
        this.requiredElements = new Set([
            'host', 'port', 'connectBtn', 'subscribeBtn', 'topic', 'messageFlow'
        ]);

        // Define optional elements (app degrades gracefully without these)
        this.optionalElements = new Set([
            'username', 'password', 'ssl', 'tlsVerify', 'caCert', 'clientCert', 'clientKey',
            'status', 'connectionStatus', 'liveIndicator', 'brokerUrlDisplay', 'brokerUrl',
            'totalMessages', 'messageRate', 'activeTopics', 'frameRate', 'activeCards',
            'modal', 'modalClose', 'modalCustomer', 'modalTopic', 'modalTimestamp',
            'modalPayload', 'modalQos', 'modalRetain',
            'colorLegend', 'legendItems', 'statsPanel', 'themeMode', 'sidebar', 'sidebarToggle'
        ]);
    }

    /**
     * Cache all DOM elements
     */
    cacheAllElements() {
        console.log('🔍 DOMManager: Starting to cache all elements...');
        const elements = {
            // Connection elements
            host: this.getElementById('host'),
            port: this.getElementById('port'),
            username: this.getElementById('username'),
            password: this.getElementById('password'),
            ssl: this.getElementById('ssl'),
            tlsVerify: this.getElementById('tlsVerify'),
            caCert: this.getElementById('caCert'),
            clientCert: this.getElementById('clientCert'),
            clientKey: this.getElementById('clientKey'),
            connectBtn: this.getElementById('connectBtn'),
            subscribeBtn: this.getElementById('subscribeBtn'),
            topic: this.getElementById('topic'),

            // Status elements
            status: this.getElementById('status'),
            connectionStatus: this.getElementById('connectionStatus'),
            liveIndicator: this.getElementById('liveIndicator'),
            brokerUrlDisplay: this.getElementById('brokerUrlDisplay'),
            brokerUrl: this.getElementById('brokerUrl'),

            // Stats elements
            totalMessages: this.getElementById('totalMessages'),
            messageRate: this.getElementById('messageRate'),
            activeTopics: this.getElementById('activeTopics'),
            frameRate: this.getElementById('frameRate'),
            activeCards: this.getElementById('activeCards'),

            // Visualization elements
            messageFlow: this.getElementById('messageFlow'),

            // Visualization mode buttons
            vizIconButtons: this.getElementsByClass('viz-icon-btn'),
            vizModeButtons: this.getElementsByClass('viz-mode-btn'),

            // Modal elements
            modal: this.getElementById('messageModal'),
            modalClose: this.getElementById('modalClose'),
            modalCustomer: this.getElementById('modalCustomer'),
            modalTopic: this.getElementById('modalTopic'),
            modalTimestamp: this.getElementById('modalTimestamp'),
            modalPayload: this.getElementById('modalPayload'),
            modalQos: this.getElementById('modalQos'),
            modalRetain: this.getElementById('modalRetain'),

            // Legend elements
            colorLegend: this.getElementById('colorLegend'),
            legendItems: this.getElementById('legendItems'),

            // Stats panel
            statsPanel: this.getElementById('statsPanel'),

            // Theme elements
            themeMode: this.getElementById('themeMode'),
            sidebar: this.getElementById('sidebar'),
            sidebarToggle: this.getElementById('sidebarToggle')
        };

        // Cache all elements
        Object.entries(elements).forEach(([key, element]) => {
            this.cache.set(key, element);
            if (element) {
                console.log(`✅ Found element: ${key}`);
            } else {
                console.log(`❌ Missing element: ${key}`);
            }
        });

        return elements;
    }

    /**
     * Get element by ID with error handling
     */
    getElementById(id) {
        try {
            const element = document.getElementById(id);
            if (!element) {
                const isRequired = this.requiredElements.has(id);
                if (isRequired) {
                    console.error(`DOMManager: Required element not found: ${id}`);
                } else if (this.optionalElements.has(id)) {
                    console.warn(`DOMManager: Optional element not found: ${id}`);
                }
            }
            return element;
        } catch (error) {
            console.error(`DOMManager: Error getting element ${id}:`, error);
            return null;
        }
    }

    /**
     * Get elements by class with error handling
     */
    getElementsByClass(className) {
        try {
            const elements = document.querySelectorAll(`.${className}`);
            if (elements.length === 0) {
                console.warn(`DOMManager: No elements found with class: ${className}`);
            }
            return elements;
        } catch (error) {
            console.error(`DOMManager: Error getting elements with class ${className}:`, error);
            return [];
        }
    }

    /**
     * Get cached element with lazy loading
     */
    get(elementId) {
        if (!this.initialized) {
            throw new Error('DOMManager not initialized. Call initialize() first.');
        }

        if (this.cache.has(elementId)) {
            return this.cache.get(elementId);
        }

        // Lazy load if not in cache
        const element = this.getElementById(elementId);
        this.cache.set(elementId, element);
        return element;
    }

    /**
     * Get all cached elements
     */
    getAll() {
        if (!this.initialized) {
            throw new Error('DOMManager not initialized. Call initialize() first.');
        }

        const elements = {};
        this.cache.forEach((element, key) => {
            elements[key] = element;
        });
        return elements;
    }

    /**
     * Validate that all required elements exist
     */
    validateRequiredElements() {
        const missingElements = [];

        this.requiredElements.forEach(elementId => {
            const element = this.cache.get(elementId);
            if (!element) {
                missingElements.push(elementId);
            }
        });

        if (missingElements.length > 0) {
            const error = new Error(`Missing required DOM elements: ${missingElements.join(', ')}`);
            console.error('DOMManager validation failed:', error);
            throw error;
        }

        console.log('DOMManager: All required elements validated successfully');
    }

    /**
     * Check if element exists and is visible
     */
    isElementVisible(elementId) {
        const element = this.get(elementId);
        if (!element) return false;

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 &&
               window.getComputedStyle(element).visibility !== 'hidden';
    }

    /**
     * Refresh cache for specific element
     */
    refreshElement(elementId) {
        const element = this.getElementById(elementId);
        this.cache.set(elementId, element);
        return element;
    }

    /**
     * Clear cache and reinitialize
     */
    refresh() {
        this.cache.clear();
        return this.initialize();
    }

    /**
     * Add event listener with automatic cleanup
     */
    addEventListener(elementId, event, handler, options = {}) {
        const element = this.get(elementId);
        if (!element) {
            console.warn(`DOMManager: Cannot add event listener to non-existent element: ${elementId}`);
            return null;
        }

        element.addEventListener(event, handler, options);

        // Return cleanup function
        return () => {
            if (element) {
                element.removeEventListener(event, handler, options);
            }
        };
    }

    /**
     * Get element dimensions safely
     */
    getDimensions(elementId) {
        const element = this.get(elementId);
        if (!element) {
            return { width: 0, height: 0, top: 0, left: 0 };
        }

        const rect = element.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left
        };
    }

    /**
     * Check if all required elements are ready for use
     */
    isReady() {
        if (!this.initialized) {
            return false;
        }

        return Array.from(this.requiredElements).every(elementId => {
            const element = this.cache.get(elementId);
            return element !== null && element !== undefined;
        });
    }

    /**
     * Get debug info about cached elements
     */
    getDebugInfo() {
        const info = {
            initialized: this.initialized,
            totalCached: this.cache.size,
            requiredElements: Array.from(this.requiredElements),
            optionalElements: Array.from(this.optionalElements),
            missingRequired: [],
            missingOptional: []
        };

        // Check which elements are missing
        this.requiredElements.forEach(id => {
            if (!this.cache.get(id)) {
                info.missingRequired.push(id);
            }
        });

        this.optionalElements.forEach(id => {
            if (!this.cache.get(id)) {
                info.missingOptional.push(id);
            }
        });

        return info;
    }
}

export default DOMManager;