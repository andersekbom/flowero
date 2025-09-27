/**
 * Style Provider
 *
 * Base interface for different element style variations.
 * Provides a factory pattern for style selection and future extensibility.
 */
import CircleStyle from './CircleStyle.js';

class StyleProvider {
    /**
     * Get style implementation for specified type
     * @param {string} type - Style type ('circle', 'card', 'hexagon', etc.)
     * @returns {Object} Style implementation class
     */
    static getStyle(type = 'circle') {
        switch (type) {
            case 'circle':
                return CircleStyle;
            // Future styles can be added here: 'card', 'hexagon', etc.
            default:
                return CircleStyle;
        }
    }

    /**
     * Get available style types
     * @returns {Array} Array of available style type names
     */
    static getAvailableStyles() {
        return ['circle'];
    }

    /**
     * Check if a style type is supported
     * @param {string} type - Style type to check
     * @returns {boolean} True if style type is supported
     */
    static isStyleSupported(type) {
        return this.getAvailableStyles().includes(type);
    }
}

export default StyleProvider;