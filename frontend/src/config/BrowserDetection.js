/**
 * Browser Detection Utilities
 *
 * Collection of utility functions to detect browser capabilities and features.
 * Used for progressive enhancement and compatibility handling.
 */

/**
 * Detect if browser supports passive event listeners
 * @returns {boolean} True if passive listeners are supported
 */
export function detectPassiveSupport() {
    let supportsPassive = false;
    try {
        const opts = Object.defineProperty({}, 'passive', {
            get: function() {
                supportsPassive = true;
            }
        });
        window.addEventListener('test', null, opts);
        window.removeEventListener('test', null, opts);
    } catch (e) {}
    return supportsPassive;
}

/**
 * Detect if browser supports IntersectionObserver
 * @returns {boolean} True if IntersectionObserver is supported
 */
export function hasIntersectionObserver() {
    return 'IntersectionObserver' in window;
}

/**
 * Detect if browser supports requestIdleCallback
 * @returns {boolean} True if requestIdleCallback is supported
 */
export function hasRequestIdleCallback() {
    return 'requestIdleCallback' in window;
}

/**
 * Get all browser capabilities at once
 * @returns {Object} Object containing all capability flags
 */
export function getBrowserCapabilities() {
    return {
        supportsPassiveListeners: detectPassiveSupport(),
        hasIntersectionObserver: hasIntersectionObserver(),
        hasRequestIdleCallback: hasRequestIdleCallback()
    };
}