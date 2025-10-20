/**
 * Color Legend Component
 *
 * Shared component for displaying customer color mappings across all visualization modes.
 * Provides real-time updates as new customers appear in message streams.
 */
class ColorLegend {
    constructor(domManager, themeManager, options = {}) {
        this.domManager = domManager;
        this.themeManager = themeManager;
        this.options = {
            maxVisible: 10,
            animationDuration: 300,
            fadeOutDelay: 30000, // 30 seconds before inactive colors fade
            ...options
        };

        // State
        this.customerColors = new Map();
        this.colorIndex = 0;
        this.lastUpdateTimes = new Map(); // Track when each customer was last seen
        this.initialized = false;

        // DOM elements
        this.legendContainer = null;
        this.legendItems = null;
    }

    /**
     * Initialize the color legend
     */
    initialize() {
        this.cacheElements();
        this.setupAutoCleanup();
        this.initialized = true;
        console.log('ColorLegend: Initialized successfully');
        return this;
    }

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.legendContainer = this.domManager.get('colorLegend');
        this.legendItems = this.domManager.get('legendItems');

        if (!this.legendContainer || !this.legendItems) {
            console.warn('ColorLegend: Legend elements not found in DOM');
        }
    }

    /**
     * Get or assign color for a customer
     */
    getCustomerColor(customer) {
        if (!customer) return '#999999';

        // Update last seen time
        this.lastUpdateTimes.set(customer, Date.now());

        // Return existing color if available
        if (this.customerColors.has(customer)) {
            return this.customerColors.get(customer);
        }

        // Assign new color
        const colors = this.getThemeColors();
        const color = colors[this.colorIndex % colors.length];
        this.customerColors.set(customer, color);
        this.colorIndex++;

        // Update legend display
        this.updateLegendDisplay();

        return color;
    }

    /**
     * Get current theme colors from theme manager
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
     * Update the legend display
     */
    updateLegendDisplay() {
        if (!this.legendItems) return;

        // Get active customers (recently seen)
        const now = Date.now();
        const activeCustomers = Array.from(this.customerColors.entries())
            .filter(([customer, color]) => {
                const lastSeen = this.lastUpdateTimes.get(customer) || 0;
                return (now - lastSeen) < this.options.fadeOutDelay;
            })
            .slice(0, this.options.maxVisible);

        // Clear existing items
        this.legendItems.innerHTML = '';

        // Add legend items
        activeCustomers.forEach(([customer, color]) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="background-color: ${color};"></div>
                <span class="legend-label">${customer}</span>
            `;

            // Add fade-in animation
            item.style.opacity = '0';
            item.style.transform = 'translateX(-10px)';
            this.legendItems.appendChild(item);

            // Animate in
            requestAnimationFrame(() => {
                item.style.transition = `all ${this.options.animationDuration}ms ease`;
                item.style.opacity = '1';
                item.style.transform = 'translateX(0)';
            });
        });

        // Show/hide legend container based on content
        if (this.legendContainer) {
            this.legendContainer.style.display = activeCustomers.length > 0 ? 'block' : 'none';
        }
    }

    /**
     * Handle theme changes by regenerating colors
     */
    handleThemeChange() {
        // Clear existing colors to regenerate with new theme
        this.customerColors.clear();
        this.colorIndex = 0;
        this.updateLegendDisplay();
        console.log('ColorLegend: Theme colors refreshed');
    }

    /**
     * Show the color legend
     */
    show() {
        if (this.legendContainer) {
            this.legendContainer.style.display = '';
        }
    }

    /**
     * Hide the color legend
     */
    hide() {
        if (this.legendContainer) {
            this.legendContainer.style.display = 'none';
        }
    }

    /**
     * Setup automatic cleanup of old colors
     */
    setupAutoCleanup() {
        setInterval(() => {
            this.cleanupOldColors();
        }, 10000); // Clean up every 10 seconds
    }

    /**
     * Remove colors for customers not seen recently
     */
    cleanupOldColors() {
        const now = Date.now();
        let cleaned = 0;

        for (const [customer, lastSeen] of this.lastUpdateTimes.entries()) {
            if (now - lastSeen > this.options.fadeOutDelay) {
                this.customerColors.delete(customer);
                this.lastUpdateTimes.delete(customer);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            this.updateLegendDisplay();
            console.log(`ColorLegend: Cleaned up ${cleaned} inactive colors`);
        }
    }

    /**
     * Get all current customer colors
     */
    getAllColors() {
        return new Map(this.customerColors);
    }

    /**
     * Get statistics about color usage
     */
    getStats() {
        return {
            totalCustomers: this.customerColors.size,
            activeCustomers: Array.from(this.lastUpdateTimes.entries()).filter(
                ([customer, lastSeen]) => (Date.now() - lastSeen) < this.options.fadeOutDelay
            ).length,
            colorIndex: this.colorIndex
        };
    }

    /**
     * Reset all colors (useful for testing or manual reset)
     */
    reset() {
        this.customerColors.clear();
        this.lastUpdateTimes.clear();
        this.colorIndex = 0;
        this.updateLegendDisplay();
    }

    /**
     * Destroy the color legend
     */
    destroy() {
        this.customerColors.clear();
        this.lastUpdateTimes.clear();
        this.initialized = false;
        console.log('ColorLegend: Destroyed');
    }
}

export default ColorLegend;