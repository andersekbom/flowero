/**
 * Cleanup Manager
 *
 * Smart cleanup system for tracking and removing off-screen animated elements.
 * Prevents memory leaks and performance degradation by automatically removing
 * elements that are no longer visible or have exceeded their lifecycle.
 */
class CleanupManager {
    constructor(containerElement, layoutCalculator) {
        this.containerElement = containerElement;
        this.layoutCalculator = layoutCalculator;
        this.activeElements = new Set(); // Track all active animated elements
        this.cleanupInterval = null;
        this.resizeTimeout = null;

        // Cleanup configuration
        this.config = {
            checkInterval: 1000, // Check every 1 second (more frequent)
            bufferZone: 100, // Smaller buffer zone for more aggressive cleanup
            maxAge: 30000, // Maximum element age in milliseconds (30 seconds)
            maxElements: 200 // Lower threshold for aggressive cleanup
        };

        this.startPeriodicCleanup();
        this.setupResizeHandler();
    }

    /**
     * Register an animated element for tracking
     * @param {Object} svgGroup - D3 SVG group element
     * @param {Object} animationInfo - Optional animation metadata
     * @returns {Object} Element data object
     */
    trackElement(svgGroup, animationInfo = {}) {
        const elementData = {
            svgGroup: svgGroup,
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
            animationType: animationInfo.type || 'unknown',
            bounds: animationInfo.bounds || null,
            onCleanup: animationInfo.onCleanup || null
        };

        this.activeElements.add(elementData);

        // Add cleanup data to the SVG element for easy access
        svgGroup.node().__cleanupData = elementData;

        return elementData;
    }

    /**
     * Remove element from tracking
     * @param {Object} svgGroup - D3 SVG group element
     */
    untrackElement(svgGroup) {
        const elementData = svgGroup.node().__cleanupData;
        if (elementData) {
            this.activeElements.delete(elementData);
            delete svgGroup.node().__cleanupData;
        }
    }

    /**
     * Check if element is off-screen
     * @param {Object} svgGroup - D3 SVG group element
     * @param {number} bufferZone - Buffer zone around screen bounds
     * @returns {boolean} True if element is off-screen
     */
    isOffScreen(svgGroup, bufferZone = this.config.bufferZone) {
        if (!svgGroup.node()) return true;

        try {
            const transform = svgGroup.attr('transform');
            if (!transform) return false;

            const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (!match) return false;

            const x = parseFloat(match[1]);
            const y = parseFloat(match[2]);

            // Get current effective dimensions
            const dimensions = this.layoutCalculator ?
                this.layoutCalculator.getEffectiveDimensions() :
                {
                    width: this.containerElement.clientWidth,
                    height: this.containerElement.clientHeight
                };

            // Debug logging for first few checks
            if (Math.random() < 0.1) { // 10% of the time
                console.log(`CleanupManager debug: Element at (${x.toFixed(1)}, ${y.toFixed(1)}), container: ${dimensions.width}x${dimensions.height}, buffer: ${bufferZone}`);
            }

            return (
                x < -bufferZone ||
                x > dimensions.width + bufferZone ||
                y < -bufferZone ||
                y > dimensions.height + bufferZone
            );
        } catch (error) {
            console.warn('Error checking element bounds:', error);
            return true; // Remove problematic elements
        }
    }

    /**
     * Check if element is too old (fallback cleanup)
     * @param {Object} elementData - Element data object
     * @returns {boolean} True if element is expired
     */
    isExpired(elementData) {
        return (Date.now() - elementData.createdAt) > this.config.maxAge;
    }

    /**
     * Remove an element safely
     * @param {Object} elementData - Element data object
     */
    removeElement(elementData) {
        try {
            if (elementData.svgGroup && elementData.svgGroup.node()) {
                // Call custom cleanup callback if provided
                if (elementData.onCleanup) {
                    elementData.onCleanup();
                }

                // Remove from DOM
                elementData.svgGroup.remove();
            }

            // Remove from tracking
            this.activeElements.delete(elementData);
        } catch (error) {
            console.warn('Error removing element:', error);
        }
    }

    /**
     * Perform cleanup sweep
     * @param {boolean} aggressive - Whether to perform aggressive cleanup
     * @returns {number} Number of elements removed
     */
    performCleanup(aggressive = false) {
        const startTime = Date.now();
        let removedCount = 0;
        const elementsToRemove = [];

        // Check all tracked elements
        for (const elementData of this.activeElements) {
            let shouldRemove = false;

            // Check if element still exists in DOM
            if (!elementData.svgGroup.node() || !elementData.svgGroup.node().parentNode) {
                shouldRemove = true;
            }
            // Check if off-screen
            else if (this.isOffScreen(elementData.svgGroup)) {
                shouldRemove = true;
            }
            // Check if expired
            else if (this.isExpired(elementData)) {
                shouldRemove = true;
            }
            // Aggressive cleanup if too many elements
            else if (aggressive && this.activeElements.size > this.config.maxElements) {
                const age = Date.now() - elementData.createdAt;
                if (age > 10000) { // Remove elements older than 10 seconds during aggressive cleanup
                    shouldRemove = true;
                }
            }

            if (shouldRemove) {
                elementsToRemove.push(elementData);
            }
        }

        // Remove flagged elements
        elementsToRemove.forEach(elementData => {
            this.removeElement(elementData);
            removedCount++;
        });

        const duration = Date.now() - startTime;

        if (removedCount > 0 || this.activeElements.size > 0) {
            console.log(`Cleanup: Removed ${removedCount} elements in ${duration}ms. Active: ${this.activeElements.size}${aggressive ? ' (AGGRESSIVE)' : ''}`);
        }

        // Also log if we have many active elements
        if (this.activeElements.size > 50) {
            console.warn(`CleanupManager: High element count: ${this.activeElements.size} active elements`);
        }

        return removedCount;
    }

    /**
     * Start periodic cleanup
     */
    startPeriodicCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }

        this.cleanupInterval = setInterval(() => {
            const aggressive = this.activeElements.size > this.config.maxElements;
            this.performCleanup(aggressive);
        }, this.config.checkInterval);
    }

    /**
     * Handle window resize events
     */
    setupResizeHandler() {
        window.addEventListener('resize', () => {
            // Debounce resize events
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }

            this.resizeTimeout = setTimeout(() => {
                console.log('Window resized - performing cleanup sweep');
                this.performCleanup(true); // Aggressive cleanup on resize
            }, 300);
        });
    }

    /**
     * Manual cleanup trigger
     * @returns {number} Number of elements removed
     */
    forceCleanup() {
        return this.performCleanup(true);
    }

    /**
     * Get status information
     * @returns {Object} Status object with current state
     */
    getStatus() {
        return {
            activeElements: this.activeElements.size,
            maxElements: this.config.maxElements,
            cleanupInterval: this.config.checkInterval
        };
    }

    /**
     * Stop cleanup system and clean up all resources
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }

        // Clean up all remaining elements
        this.activeElements.forEach(elementData => {
            this.removeElement(elementData);
        });

        this.activeElements.clear();
    }

    /**
     * Reset all tracking and clear all elements
     */
    reset() {
        console.log('CleanupManager: Resetting all tracking');

        // Clear all tracked elements
        this.activeElements.forEach(elementData => {
            this.removeElement(elementData);
        });

        this.activeElements.clear();

        // Clear any timeouts
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }

        console.log('CleanupManager: Reset complete');
    }
}

export default CleanupManager;