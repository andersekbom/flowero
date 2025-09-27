/**
 * Application Constants
 *
 * Application-wide constants, enums, and static values used throughout
 * the MQTT Visualizer. These values should not change at runtime.
 */

// Visualization Mode Constants
export const VISUALIZATION_MODES = Object.freeze({
    BUBBLES: 'bubbles',
    STARFIELD: 'starfield',
    NETWORK: 'network',
    CLUSTERS: 'clusters',
    RADIAL: 'radial' // Legacy mode
});

// Connection States
export const CONNECTION_STATES = Object.freeze({
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    ERROR: 'error'
});

// Element Types
export const ELEMENT_TYPES = Object.freeze({
    CIRCLE: 'circle',
    CARD: 'card',
    HEXAGON: 'hexagon',
    NODE: 'node'
});

// Animation Types
export const ANIMATION_TYPES = Object.freeze({
    FADE_IN: 'fadeIn',
    FADE_OUT: 'fadeOut',
    SLIDE_IN: 'slideIn',
    SLIDE_OUT: 'slideOut',
    BOUNCE: 'bounce',
    POP: 'pop',
    SPIN: 'spin'
});

// Message Status
export const MESSAGE_STATUS = Object.freeze({
    RECEIVED: 'received',
    PROCESSING: 'processing',
    DISPLAYED: 'displayed',
    ARCHIVED: 'archived'
});

// Element Status (for tracking)
export const ELEMENT_STATUS = Object.freeze({
    ANIMATING: 'animating',
    FADING: 'fading',
    COMPLETED: 'completed'
});

// Theme Types
export const THEMES = Object.freeze({
    DARK: 'dark',
    LIGHT: 'light',
    AUTO: 'auto'
});

// Event Types
export const EVENT_TYPES = Object.freeze({
    MESSAGE_RECEIVED: 'message_received',
    MESSAGE_PROCESSED: 'message_processed',
    ELEMENT_CREATED: 'element_created',
    ELEMENT_REMOVED: 'element_removed',
    MODE_CHANGED: 'mode_changed',
    CONNECTION_CHANGED: 'connection_changed',
    FRAME_RENDERED: 'frame_rendered',
    PERFORMANCE_ALERT: 'performance_alert'
});

// MQTT Default Ports
export const MQTT_PORTS = Object.freeze({
    STANDARD: 1883,
    SECURE: 8883,
    WEBSOCKET: 8080,
    WEBSOCKET_SECURE: 8081
});

// Browser Support Constants
export const BROWSER_FEATURES = Object.freeze({
    INTERSECTION_OBSERVER: 'IntersectionObserver',
    REQUEST_IDLE_CALLBACK: 'requestIdleCallback',
    PASSIVE_EVENTS: 'passiveEvents',
    WEB_WORKERS: 'Worker',
    LOCAL_STORAGE: 'localStorage'
});

// Performance Thresholds
export const PERFORMANCE_LEVELS = Object.freeze({
    EXCELLENT: { min: 55, label: 'Excellent' },
    GOOD: { min: 45, label: 'Good' },
    FAIR: { min: 30, label: 'Fair' },
    POOR: { min: 0, label: 'Poor' }
});

// CSS Breakpoints
export const BREAKPOINTS = Object.freeze({
    MOBILE: 480,
    TABLET: 768,
    DESKTOP: 1024,
    WIDE: 1440
});

// Z-Index Layers
export const Z_LAYERS = Object.freeze({
    BACKGROUND: 0,
    CONTENT: 1,
    OVERLAY: 100,
    MODAL: 1000,
    TOOLTIP: 2000,
    NOTIFICATION: 3000
});

// Color Palette
export const COLOR_PALETTE = Object.freeze({
    PRIMARY: '#007acc',
    SECONDARY: '#ff6b35',
    SUCCESS: '#28a745',
    WARNING: '#ffc107',
    ERROR: '#dc3545',
    INFO: '#17a2b8',
    LIGHT: '#f8f9fa',
    DARK: '#343a40'
});

// Default Topic Colors (HSL values)
export const DEFAULT_TOPIC_COLORS = Object.freeze([
    { h: 0, s: 70, l: 50 },     // Red
    { h: 30, s: 70, l: 50 },    // Orange
    { h: 60, s: 70, l: 50 },    // Yellow
    { h: 120, s: 70, l: 50 },   // Green
    { h: 180, s: 70, l: 50 },   // Cyan
    { h: 240, s: 70, l: 50 },   // Blue
    { h: 270, s: 70, l: 50 },   // Purple
    { h: 300, s: 70, l: 50 }    // Magenta
]);

// File Extensions
export const FILE_EXTENSIONS = Object.freeze({
    JSON: '.json',
    CSV: '.csv',
    XML: '.xml',
    LOG: '.log',
    CONFIG: '.config'
});

// API Endpoints (if any)
export const API_ENDPOINTS = Object.freeze({
    HEALTH: '/health',
    STATUS: '/status',
    CONFIG: '/config'
});

// Error Codes
export const ERROR_CODES = Object.freeze({
    NETWORK_ERROR: 'NETWORK_ERROR',
    AUTHENTICATION_ERROR: 'AUTH_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    PARSE_ERROR: 'PARSE_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR'
});

// Development Constants
export const DEV_CONSTANTS = Object.freeze({
    LOG_LEVEL: 'info',
    DEBUG_MODE: false,
    MOCK_DATA: false,
    PERFORMANCE_MONITORING: true
});

// Export all constants as a single object for convenience
export const CONSTANTS = Object.freeze({
    VISUALIZATION_MODES,
    CONNECTION_STATES,
    ELEMENT_TYPES,
    ANIMATION_TYPES,
    MESSAGE_STATUS,
    ELEMENT_STATUS,
    THEMES,
    EVENT_TYPES,
    MQTT_PORTS,
    BROWSER_FEATURES,
    PERFORMANCE_LEVELS,
    BREAKPOINTS,
    Z_LAYERS,
    COLOR_PALETTE,
    DEFAULT_TOPIC_COLORS,
    FILE_EXTENSIONS,
    API_ENDPOINTS,
    ERROR_CODES,
    DEV_CONSTANTS
});

export default CONSTANTS;