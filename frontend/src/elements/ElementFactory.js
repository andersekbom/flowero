/**
 * Element Factory
 *
 * Centralized factory for creating DOM and SVG elements across different
 * visualization modes. Coordinates between element system and tracker.
 */
import UnifiedElementSystem from './UnifiedElementSystem.js';
import UnifiedElementTracker from './UnifiedElementTracker.js';

class ElementFactory {
    constructor(styleType = 'circle') {
        this.elementSystem = new UnifiedElementSystem(styleType);
        this.elementTracker = new UnifiedElementTracker();
        this.currentStyleType = styleType;
    }

    /**
     * Create and track a DOM element
     * @param {Object} processedMessage - Processed message data
     * @param {Object} options - Element creation options
     * @returns {Object} Object containing element and tracking ID
     */
    createTrackedElement(processedMessage, options = {}) {
        const element = this.elementSystem.createElement(processedMessage, options);

        const elementInfo = {
            type: this.currentStyleType,
            animationType: 'dom',
            deviceId: processedMessage.deviceId,
            color: processedMessage.color,
            ...options
        };

        // Note: For DOM elements, we'll track by a unique identifier
        // since we don't have SVG groups
        const trackingId = this.elementTracker.trackElement(null, elementInfo);

        return {
            element,
            trackingId,
            elementInfo
        };
    }

    /**
     * Create and track an SVG element
     * @param {Object} container - SVG container
     * @param {Object} processedMessage - Processed message data
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} options - Element creation options
     * @returns {Object} Object containing SVG element and tracking ID
     */
    createTrackedSVGElement(container, processedMessage, x, y, options = {}) {
        const svgElement = this.elementSystem.createSVGElement(
            container, processedMessage, x, y, options
        );

        const elementInfo = {
            type: this.currentStyleType,
            animationType: 'svg',
            deviceId: processedMessage.deviceId,
            color: processedMessage.color,
            x: x,
            y: y,
            ...options
        };

        const trackingId = this.elementTracker.trackElement(svgElement, elementInfo);

        return {
            svgElement,
            trackingId,
            elementInfo
        };
    }

    /**
     * Create multiple tracked DOM elements
     * @param {Array} processedMessages - Array of processed message data
     * @param {Object} options - Element creation options
     * @returns {Array} Array of tracked element objects
     */
    createTrackedElements(processedMessages, options = {}) {
        return processedMessages.map(message =>
            this.createTrackedElement(message, options)
        );
    }

    /**
     * Create multiple tracked SVG elements
     * @param {Object} container - SVG container
     * @param {Array} messageData - Array of {message, x, y} objects
     * @param {Object} options - Element creation options
     * @returns {Array} Array of tracked SVG element objects
     */
    createTrackedSVGElements(container, messageData, options = {}) {
        return messageData.map(({ message, x, y }) =>
            this.createTrackedSVGElement(container, message, x, y, options)
        );
    }

    /**
     * Remove and untrack an element by tracking ID
     * @param {string} trackingId - Element tracking ID
     * @returns {boolean} True if element was removed
     */
    removeTrackedElement(trackingId) {
        return this.elementTracker.untrackElement(trackingId);
    }

    /**
     * Remove and untrack an SVG element by SVG group
     * @param {Object} svgGroup - D3 SVG group element
     * @returns {boolean} True if element was removed
     */
    removeTrackedSVGElement(svgGroup) {
        return this.elementTracker.removeElement(svgGroup);
    }

    /**
     * Update element status
     * @param {string} trackingId - Element tracking ID
     * @param {string} newStatus - New status ('animating', 'fading', 'completed')
     * @returns {boolean} True if status was updated
     */
    updateElementStatus(trackingId, newStatus) {
        return this.elementTracker.updateElementStatus(trackingId, newStatus);
    }

    /**
     * Get element by tracking ID
     * @param {string} trackingId - Element tracking ID
     * @returns {Object|null} Element data or null if not found
     */
    getTrackedElement(trackingId) {
        return this.elementTracker.getElementById(trackingId);
    }

    /**
     * Get element by SVG group
     * @param {Object} svgGroup - D3 SVG group element
     * @returns {Object|null} Element data or null if not found
     */
    getElementBySvg(svgGroup) {
        return this.elementTracker.getElementBySvg(svgGroup);
    }

    /**
     * Switch element style for new elements
     * @param {string} styleType - Style type to switch to
     * @returns {boolean} True if style was changed successfully
     */
    setStyle(styleType) {
        if (this.elementSystem.setStyle(styleType)) {
            this.currentStyleType = styleType;
            return true;
        }
        return false;
    }

    /**
     * Get current style type
     * @returns {string} Current style type
     */
    getCurrentStyleType() {
        return this.currentStyleType;
    }

    /**
     * Get element tracker statistics
     * @returns {Object} Tracking statistics
     */
    getTrackerStats() {
        return this.elementTracker.getStats();
    }

    /**
     * Get element counts by type and status
     * @returns {Object} Count data
     */
    getElementCounts() {
        return this.elementTracker.getCounts();
    }

    /**
     * Get elements older than specified age
     * @param {number} ageMs - Age threshold in milliseconds
     * @returns {Array} Array of elements older than the threshold
     */
    getOldElements(ageMs) {
        return this.elementTracker.getElementsOlderThan(ageMs);
    }

    /**
     * Clear all tracked elements
     */
    clearAll() {
        this.elementTracker.clearAll();
    }

    /**
     * Reset all tracking data
     */
    reset() {
        this.elementTracker.reset();
    }

    /**
     * Get debug information about factory and tracker
     * @returns {Object} Comprehensive debug information
     */
    getDebugInfo() {
        return {
            currentStyle: this.currentStyleType,
            availableStyles: this.elementSystem.getAvailableStyles(),
            systemStatus: this.elementSystem.getStatus(),
            trackerDebug: this.elementTracker.getDebugInfo()
        };
    }

    /**
     * Validate element options for current style
     * @param {Object} options - Options to validate
     * @returns {boolean} True if options are valid
     */
    validateOptions(options) {
        return this.elementSystem.validateOptions(options);
    }

    /**
     * Get default options for current style
     * @returns {Object} Default options object
     */
    getDefaultOptions() {
        return this.elementSystem.getDefaultOptions();
    }
}

export default ElementFactory;