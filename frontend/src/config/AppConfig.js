/**
 * Application Configuration
 *
 * Centralized configuration constants for the MQTT Visualizer application.
 * Contains performance settings, animation parameters, and visual defaults.
 */

export const AppConfig = {
    // Z-Index Management
    Z_INDEX: {
        MESSAGE_START: 1000,
        MAX: 1000,
        MIN: 1
    },

    // Performance Settings
    PERFORMANCE: {
        MAX_POOL_SIZE: 50,
        FRAME_RATE_THRESHOLD_LOW: 30,
        FRAME_RATE_THRESHOLD_HIGH: 55,
        STATS_UPDATE_INTERVAL: 1000, // ms
        ANIMATION_FRAME_POOL_SIZE: 100
    },

    // Animation Durations
    ANIMATION: {
        BUBBLE_CROSS_SCREEN_DURATION: 20000, // 20 seconds
        FADE_DURATION: 3000, // 3 seconds
        TRANSITION_DURATION: 500, // 0.5 seconds
        POP_DURATION: 200 // 0.2 seconds
    },

    // Network Graph Settings
    NETWORK: {
        NODE_RADIUS_DEFAULT: 20,
        NODE_PADDING: 30,
        FORCE_STRENGTH_MIN: 0.1,
        FORCE_STRENGTH_MAX: 0.8,
        DECAY_RATE: 0.005, // 0.5% per update
        MIN_BRIGHTNESS: 0.3, // 30% minimum
        MIN_SIZE_SCALE: 0.5, // 50% minimum
        UPDATE_FREQUENCY: 100 // ms between updates
    },

    // Element Sizing
    ELEMENTS: {
        CIRCLE_SIZE_DEFAULT: 50,
        CIRCLE_SIZE_MIN: 20,
        CIRCLE_SIZE_MAX: 100,
        LABEL_FONT_SIZE: 12,
        ICON_SIZE: 16
    },

    // Color Management
    COLORS: {
        DEFAULT_HUE_INCREMENT: 30,
        SATURATION: 70,
        LIGHTNESS: 50,
        ALPHA_DEFAULT: 0.8,
        ALPHA_FADE: 0.3
    },

    // Layout Settings
    LAYOUT: {
        SIDEBAR_WIDTH: 300,
        HEADER_HEIGHT: 60,
        PADDING: 20,
        RESPONSIVE_BREAKPOINT: 768
    },

    // Message Processing
    MESSAGES: {
        RATE_CALCULATION_WINDOW: 5000, // 5 seconds
        MAX_HISTORY_SIZE: 1000,
        THROTTLE_DELAY: 16, // ~60fps
        BATCH_SIZE: 10
    },

    // Visualization Modes
    MODES: {
        DEFAULT: 'bubbles',
        AVAILABLE: ['bubbles', 'starfield', 'network', 'clusters'],
        TRANSITION_DELAY: 100 // ms
    },

    // DOM Element Classes
    CSS_CLASSES: {
        MESSAGE_BUBBLE: 'message-bubble',
        CIRCLE_ELEMENT: 'circle-element',
        NETWORK_NODE: 'network-node',
        CLUSTER_GROUP: 'cluster-group',
        VISUALIZATION_CONTAINER: 'visualization-container'
    },

    // Error Handling
    ERRORS: {
        RECONNECT_DELAY: 3000, // 3 seconds
        MAX_RECONNECT_ATTEMPTS: 5,
        TIMEOUT_DURATION: 30000 // 30 seconds
    },

    // Feature Flags
    FEATURES: {
        ENABLE_PERFORMANCE_MONITORING: true,
        ENABLE_DEBUG_LOGGING: false,
        ENABLE_ANIMATION_RECYCLING: true,
        ENABLE_ADAPTIVE_PERFORMANCE: true
    }
};

// Export individual sections for convenience
export const { Z_INDEX, PERFORMANCE, ANIMATION, NETWORK, ELEMENTS, COLORS, LAYOUT, MESSAGES, MODES, CSS_CLASSES, ERRORS, FEATURES } = AppConfig;

export default AppConfig;