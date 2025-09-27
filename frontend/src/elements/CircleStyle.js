/**
 * Circle Style
 *
 * Implementation of circle-based element styling for visualization.
 * Provides both DOM and SVG element creation using the CircleRenderer.
 */
import { CircleRenderer } from '../visualization/BaseVisualization.js';

class CircleStyle {
    /**
     * Create a DOM circle element
     * @param {Object} processedMessage - Processed message data
     * @param {Object} options - Element options
     * @returns {Element} Created DOM element
     */
    static createElement(processedMessage, options = {}) {
        return CircleRenderer.createCircleElement(
            processedMessage.color,
            processedMessage.deviceId,
            options
        );
    }

    /**
     * Create an SVG circle element
     * @param {Object} container - SVG container
     * @param {Object} processedMessage - Processed message data
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     * @param {Object} options - Element options
     * @returns {Object} Created SVG element
     */
    static createSVGElement(container, processedMessage, x, y, options = {}) {
        return CircleRenderer.createSVGCircle(
            container,
            processedMessage.color,
            processedMessage.deviceId,
            x, y,
            options
        );
    }

    /**
     * Get default options for circle elements
     * @returns {Object} Default options object
     */
    static getDefaultOptions() {
        return {
            size: 50,
            showLabel: true,
            className: 'circle-element'
        };
    }

    /**
     * Validate element options
     * @param {Object} options - Options to validate
     * @returns {boolean} True if options are valid
     */
    static validateOptions(options) {
        const defaults = this.getDefaultOptions();
        const requiredKeys = Object.keys(defaults);

        // Check that all required keys exist and have correct types
        for (const key of requiredKeys) {
            if (options.hasOwnProperty(key)) {
                if (typeof options[key] !== typeof defaults[key]) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Merge options with defaults
     * @param {Object} options - User-provided options
     * @returns {Object} Merged options object
     */
    static mergeOptions(options = {}) {
        const defaults = this.getDefaultOptions();
        return { ...defaults, ...options };
    }
}

export default CircleStyle;