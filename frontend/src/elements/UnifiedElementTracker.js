/**
 * Unified Element Tracker
 *
 * Comprehensive element lifecycle tracking system for all visualization modes.
 * Provides performance monitoring, element counting, and debug capabilities.
 */
class UnifiedElementTracker {
    constructor() {
        this.activeElements = new Map(); // elementId -> elementInfo
        this.counters = {
            total: 0,
            byType: {
                radial: 0,
                linear: 0,
                network: 0
            },
            byStatus: {
                animating: 0,
                fading: 0,
                completed: 0
            }
        };

        this.nextElementId = 1;
    }

    /**
     * Register a new element for tracking
     * @param {Object} svgGroup - D3 SVG group element
     * @param {Object} elementInfo - Element metadata
     * @returns {string} Generated element ID
     */
    trackElement(svgGroup, elementInfo = {}) {
        const elementId = `element_${this.nextElementId++}`;

        const trackedElement = {
            id: elementId,
            svgGroup: svgGroup,
            type: elementInfo.type || 'unknown',
            createdAt: Date.now(),
            status: 'animating',
            animationType: elementInfo.animationType || 'unknown',
            ...elementInfo
        };

        this.activeElements.set(elementId, trackedElement);

        // Update counters
        this.counters.total++;
        this.counters.byType[trackedElement.type] = (this.counters.byType[trackedElement.type] || 0) + 1;
        this.counters.byStatus.animating++;

        // Store elementId on the SVG node for easy lookup
        if (svgGroup && svgGroup.node()) {
            svgGroup.node().__elementId = elementId;
        }

        return elementId;
    }

    /**
     * Update element status
     * @param {string} elementId - Element ID
     * @param {string} newStatus - New status ('animating', 'fading', 'completed')
     * @returns {boolean} True if status was updated
     */
    updateElementStatus(elementId, newStatus) {
        const element = this.activeElements.get(elementId);
        if (element) {
            const oldStatus = element.status;
            element.status = newStatus;

            // Update status counters
            this.counters.byStatus[oldStatus]--;
            this.counters.byStatus[newStatus]++;
            return true;
        }
        return false;
    }

    /**
     * Remove element from tracking
     * @param {string} elementId - Element ID to remove
     * @returns {boolean} True if element was removed
     */
    untrackElement(elementId) {
        const element = this.activeElements.get(elementId);
        if (element) {
            // Update counters
            this.counters.total--;
            this.counters.byType[element.type]--;
            this.counters.byStatus[element.status]--;

            // Remove from tracking
            this.activeElements.delete(elementId);

            // Clean up SVG node reference
            if (element.svgGroup && element.svgGroup.node()) {
                delete element.svgGroup.node().__elementId;
            }

            return true;
        }
        return false;
    }

    /**
     * Get element by SVG group
     * @param {Object} svgGroup - D3 SVG group element
     * @returns {Object|null} Element data or null if not found
     */
    getElementBySvg(svgGroup) {
        if (svgGroup && svgGroup.node() && svgGroup.node().__elementId) {
            return this.activeElements.get(svgGroup.node().__elementId);
        }
        return null;
    }

    /**
     * Get current element counts
     * @returns {Object} Count data by type and status
     */
    getCounts() {
        return {
            total: this.counters.total,
            byType: { ...this.counters.byType },
            byStatus: { ...this.counters.byStatus }
        };
    }

    /**
     * Get all active elements of a specific type
     * @param {string} type - Element type to filter by
     * @returns {Array} Array of elements of the specified type
     */
    getElementsByType(type) {
        const elements = [];
        for (const element of this.activeElements.values()) {
            if (element.type === type) {
                elements.push(element);
            }
        }
        return elements;
    }

    /**
     * Get elements older than specified age
     * @param {number} ageMs - Age threshold in milliseconds
     * @returns {Array} Array of elements older than the threshold
     */
    getElementsOlderThan(ageMs) {
        const cutoffTime = Date.now() - ageMs;
        const oldElements = [];

        for (const element of this.activeElements.values()) {
            if (element.createdAt < cutoffTime) {
                oldElements.push(element);
            }
        }

        return oldElements;
    }

    /**
     * Get performance statistics
     * @returns {Object} Performance and age statistics
     */
    getStats() {
        const now = Date.now();
        let totalAge = 0;
        let oldestAge = 0;

        for (const element of this.activeElements.values()) {
            const age = now - element.createdAt;
            totalAge += age;
            oldestAge = Math.max(oldestAge, age);
        }

        return {
            totalElements: this.counters.total,
            averageAge: this.counters.total > 0 ? totalAge / this.counters.total : 0,
            oldestAge: oldestAge,
            byType: { ...this.counters.byType },
            byStatus: { ...this.counters.byStatus }
        };
    }

    /**
     * Clear all element tracking (for mode switches)
     */
    clearAll() {
        this.activeElements.clear();
        this.counters.total = 0;
        this.counters.byType = {
            radial: 0,
            linear: 0,
            network: 0
        };
        this.counters.byStatus = {
            animating: 0,
            fading: 0,
            completed: 0
        };
    }

    /**
     * Remove element from tracking by SVG group
     * @param {Object} svgGroup - D3 SVG group element
     * @returns {boolean} True if element was removed
     */
    removeElement(svgGroup) {
        if (!svgGroup || !svgGroup.node()) {
            return false;
        }

        const elementId = svgGroup.node().__elementId;
        if (!elementId) {
            return false;
        }

        const element = this.activeElements.get(elementId);
        if (!element) {
            return false;
        }

        // Update counters
        this.counters.total = Math.max(0, this.counters.total - 1);
        this.counters.byType[element.type] = Math.max(0, (this.counters.byType[element.type] || 1) - 1);
        this.counters.byStatus[element.status] = Math.max(0, (this.counters.byStatus[element.status] || 1) - 1);

        // Remove from tracking
        this.activeElements.delete(elementId);

        // Clear element ID from SVG node
        delete svgGroup.node().__elementId;

        return true;
    }

    /**
     * Get debug information about all tracked elements
     * @returns {Object} Comprehensive debug information
     */
    getDebugInfo() {
        const elements = Array.from(this.activeElements.values()).map(el => ({
            id: el.id,
            type: el.type,
            status: el.status,
            age: Date.now() - el.createdAt
        }));

        return {
            counts: this.getCounts(),
            stats: this.getStats(),
            elements: elements
        };
    }

    /**
     * Reset all tracking data
     */
    reset() {
        console.log('UnifiedElementTracker: Resetting all tracking');

        this.activeElements.clear();
        this.counters.total = 0;
        this.counters.byType = {
            radial: 0,
            linear: 0,
            network: 0
        };
        this.counters.byStatus = {
            animating: 0,
            fading: 0,
            completed: 0
        };

        console.log('UnifiedElementTracker: Reset complete');
    }

    /**
     * Get all active element IDs
     * @returns {Array} Array of all tracked element IDs
     */
    getAllElementIds() {
        return Array.from(this.activeElements.keys());
    }

    /**
     * Get element by ID
     * @param {string} elementId - Element ID
     * @returns {Object|null} Element data or null if not found
     */
    getElementById(elementId) {
        return this.activeElements.get(elementId) || null;
    }

    /**
     * Check if an element is being tracked
     * @param {string} elementId - Element ID to check
     * @returns {boolean} True if element is tracked
     */
    isTracking(elementId) {
        return this.activeElements.has(elementId);
    }

    /**
     * Update element metadata
     * @param {string} elementId - Element ID
     * @param {Object} metadata - New metadata to merge
     * @returns {boolean} True if metadata was updated
     */
    updateElementMetadata(elementId, metadata) {
        const element = this.activeElements.get(elementId);
        if (element) {
            Object.assign(element, metadata);
            return true;
        }
        return false;
    }
}

export default UnifiedElementTracker;