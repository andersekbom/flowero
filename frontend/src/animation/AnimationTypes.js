/**
 * Animation Types and Constants
 *
 * Centralized constants and type definitions for all animation systems.
 * Provides consistent configuration values and direction vectors.
 */

/**
 * Animation type constants
 */
export const ANIMATION_TYPES = {
    LINEAR: 'linear',
    FORCE: 'force',
    CLUSTERS: 'clusters'
};

/**
 * Standard direction vectors for linear animations
 */
export const DIRECTIONS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
    UP_LEFT: { x: -1, y: -1 },
    UP_RIGHT: { x: 1, y: -1 },
    DOWN_LEFT: { x: -1, y: 1 },
    DOWN_RIGHT: { x: 1, y: 1 }
};

/**
 * Default animation durations (in milliseconds)
 */
export const DURATIONS = {
    VERY_FAST: 2000,
    FAST: 4000,
    NORMAL: 6000,
    SLOW: 8000,
    VERY_SLOW: 12000
};

/**
 * Easing function constants (D3 easing names)
 */
export const EASING = {
    LINEAR: 'easeLinear',
    QUAD_IN: 'easeQuadIn',
    QUAD_OUT: 'easeQuadOut',
    QUAD_IN_OUT: 'easeQuadInOut',
    CUBIC_IN: 'easeCubicIn',
    CUBIC_OUT: 'easeCubicOut',
    CUBIC_IN_OUT: 'easeCubicInOut',
    BACK_OUT: 'easeBackOut',
    BOUNCE_OUT: 'easeBounceOut',
    ELASTIC_OUT: 'easeElasticOut'
};

/**
 * Performance mode constants
 */
export const PERFORMANCE_MODES = {
    HIGH_QUALITY: 'high_quality',
    BALANCED: 'balanced',
    HIGH_PERFORMANCE: 'high_performance'
};

/**
 * Force simulation constants
 */
export const FORCE_DEFAULTS = {
    VELOCITY_DECAY: 0.75,
    ALPHA_DECAY: 0.01,
    ALPHA_MIN: 0.001,
    LINK_DISTANCE: 250,
    LINK_STRENGTH: 0.2,
    CHARGE_STRENGTH: -800,
    CHARGE_DISTANCE_MAX: 400,
    CENTER_STRENGTH: 0.05,
    COLLISION_RADIUS: 25,
    COLLISION_STRENGTH: 0.3,
    BOUNDARY_PADDING: 30
};

/**
 * Cluster animation constants
 */
export const CLUSTER_DEFAULTS = {
    MAX_NODES: 200,
    CLUSTER_STRENGTH: 0.8,
    COLLISION_PADDING: 2,
    INTER_CLUSTER_PADDING: 6,
    VELOCITY_DECAY: 0.8,
    ALPHA_DECAY: 0.02,
    ALPHA_MIN: 0.005,
    NODE_RADIUS: {
        MIN: 8,
        MAX: 25,
        SCALE: 1.2
    }
};

/**
 * Linear animation constants
 */
export const LINEAR_DEFAULTS = {
    DURATION: 11250,
    MARGIN: 100,
    ELEMENT_SIZE: {
        WIDTH: 50,
        HEIGHT: 50
    }
};

/**
 * Animation status constants
 */
export const ANIMATION_STATUS = {
    CREATED: 'created',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    STOPPED: 'stopped',
    ERROR: 'error'
};

/**
 * Get default options for a specific animation type
 * @param {string} animationType - Type of animation
 * @param {string} performanceMode - Performance mode
 * @returns {Object} Default options object
 */
export function getDefaultOptions(animationType, performanceMode = PERFORMANCE_MODES.BALANCED) {
    const baseOptions = {
        [ANIMATION_TYPES.LINEAR]: {
            ...LINEAR_DEFAULTS,
            direction: DIRECTIONS.DOWN
        },
        [ANIMATION_TYPES.FORCE]: {
            ...FORCE_DEFAULTS
        },
        [ANIMATION_TYPES.CLUSTERS]: {
            ...CLUSTER_DEFAULTS
        }
    };

    let options = { ...baseOptions[animationType] };

    // Apply performance mode adjustments
    switch (performanceMode) {
        case PERFORMANCE_MODES.HIGH_PERFORMANCE:
            if (animationType === ANIMATION_TYPES.LINEAR) {
                options.duration *= 0.7; // Faster animations
            } else if (animationType === ANIMATION_TYPES.FORCE) {
                options.alphaDecay *= 1.5; // Faster settling
                options.velocityDecay *= 1.2; // More damping
            } else if (animationType === ANIMATION_TYPES.CLUSTERS) {
                options.maxNodes = Math.min(options.maxNodes, 100);
                options.alphaDecay *= 1.3;
            }
            break;

        case PERFORMANCE_MODES.HIGH_QUALITY:
            if (animationType === ANIMATION_TYPES.LINEAR) {
                options.duration *= 1.3; // Slower, smoother animations
            } else if (animationType === ANIMATION_TYPES.FORCE) {
                options.alphaDecay *= 0.8; // Slower settling
                options.velocityDecay *= 0.9; // Less damping
            } else if (animationType === ANIMATION_TYPES.CLUSTERS) {
                options.maxNodes = Math.min(options.maxNodes, 300);
                options.alphaDecay *= 0.8;
            }
            break;

        case PERFORMANCE_MODES.BALANCED:
        default:
            // Use base options as-is
            break;
    }

    return options;
}

/**
 * Validate direction vector
 * @param {Object} direction - Direction object with x and y properties
 * @returns {boolean} True if direction is valid
 */
export function isValidDirection(direction) {
    return direction &&
           typeof direction.x === 'number' &&
           typeof direction.y === 'number' &&
           (direction.x !== 0 || direction.y !== 0);
}

/**
 * Normalize direction vector to unit length
 * @param {Object} direction - Direction object with x and y properties
 * @returns {Object} Normalized direction vector
 */
export function normalizeDirection(direction) {
    if (!isValidDirection(direction)) {
        return DIRECTIONS.DOWN; // Default fallback
    }

    const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    if (magnitude === 0) {
        return DIRECTIONS.DOWN; // Default fallback
    }

    return {
        x: direction.x / magnitude,
        y: direction.y / magnitude
    };
}