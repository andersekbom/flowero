/**
 * Unified Element System
 *
 * Provides a unified interface for creating DOM and SVG elements using
 * pluggable style providers. Handles option merging and style switching.
 */
import StyleProvider from './StyleProvider.js';

class UnifiedElementSystem {
    constructor(styleType = 'circle') {
        this.styleProvider = StyleProvider.getStyle(styleType);
        this.currentStyleType = styleType;
    }

    /**
     * Create DOM element using current style
     * @param {Object} processedMessage - Processed message data
     * @param {Object} options - Element creation options
     * @returns {Element} Created DOM element
     */
    createElement(processedMessage, options = {}) {
        const defaultOptions = this.styleProvider.getDefaultOptions();
        const finalOptions = { ...defaultOptions, ...options };
        return this.styleProvider.createElement(processedMessage, finalOptions);
    }

    /**
     * Create SVG element using current style
     * @param {Object} container - SVG container
     * @param {Object} processedMessage - Processed message data
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} options - Element creation options
     * @returns {Object} Created SVG element
     */
    createSVGElement(container, processedMessage, x, y, options = {}) {
        const defaultOptions = this.styleProvider.getDefaultOptions();
        const finalOptions = { ...defaultOptions, ...options };
        return this.styleProvider.createSVGElement(container, processedMessage, x, y, finalOptions);
    }

    /**
     * Switch to different style (future expansion)
     * @param {string} styleType - Style type to switch to
     * @returns {boolean} True if style was changed successfully
     */
    setStyle(styleType) {
        if (!StyleProvider.isStyleSupported(styleType)) {
            console.warn(`UnifiedElementSystem: Unsupported style type: ${styleType}`);
            return false;
        }

        this.styleProvider = StyleProvider.getStyle(styleType);
        this.currentStyleType = styleType;
        return true;
    }

    /**
     * Get current style type
     * @returns {string} Current style type
     */
    getCurrentStyleType() {
        return this.currentStyleType;
    }

    /**
     * Get available style types
     * @returns {Array} Array of available style types
     */
    getAvailableStyles() {
        return StyleProvider.getAvailableStyles();
    }

    /**
     * Get default options for current style
     * @returns {Object} Default options object
     */
    getDefaultOptions() {
        return this.styleProvider.getDefaultOptions();
    }

    /**
     * Validate options for current style
     * @param {Object} options - Options to validate
     * @returns {boolean} True if options are valid
     */
    validateOptions(options) {
        if (this.styleProvider.validateOptions) {
            return this.styleProvider.validateOptions(options);
        }
        return true; // Assume valid if style doesn't provide validation
    }

    /**
     * Create multiple DOM elements from message array
     * @param {Array} processedMessages - Array of processed message data
     * @param {Object} options - Element creation options
     * @returns {Array} Array of created DOM elements
     */
    createElements(processedMessages, options = {}) {
        return processedMessages.map(message => this.createElement(message, options));
    }

    /**
     * Create multiple SVG elements from message array
     * @param {Object} container - SVG container
     * @param {Array} messageData - Array of {message, x, y} objects
     * @param {Object} options - Element creation options
     * @returns {Array} Array of created SVG elements
     */
    createSVGElements(container, messageData, options = {}) {
        return messageData.map(({ message, x, y }) =>
            this.createSVGElement(container, message, x, y, options)
        );
    }

    /**
     * Get system status and configuration
     * @returns {Object} System status object
     */
    getStatus() {
        return {
            currentStyle: this.currentStyleType,
            availableStyles: this.getAvailableStyles(),
            defaultOptions: this.getDefaultOptions()
        };
    }
}

export default UnifiedElementSystem;