/**
 * Animation Manager
 *
 * Centralized coordination system for all animation types in the application.
 * Manages animation lifecycle, provides factory methods for animation creation,
 * and handles global animation settings and cleanup.
 */
import LinearAnimation from './LinearAnimation.js';
import ForceAnimation from './ForceAnimation.js';
import ClustersAnimation from './ClustersAnimation.js';

class AnimationManager {
    constructor() {
        this.activeAnimations = new Map(); // animationId -> animation instance
        this.animationCounter = 0;
        this.globalOptions = {
            enableAnimations: true,
            performanceMode: false, // Reduces animation quality for better performance
            maxConcurrentAnimations: 10
        };
    }

    /**
     * Create a linear animation instance
     * @param {Object} container - Animation container
     * @param {Object} direction - Direction vector {x, y}
     * @param {Object} layoutCalculator - Layout calculator instance
     * @param {Object} options - Animation options
     * @returns {Object} LinearAnimation instance with ID
     */
    createLinearAnimation(container, direction, layoutCalculator = null, options = {}) {
        const mergedOptions = this.mergeGlobalOptions(options);
        const animation = new LinearAnimation(container, direction, layoutCalculator, mergedOptions);
        const animationId = this.registerAnimation(animation, 'linear');

        return {
            id: animationId,
            animation: animation,
            type: 'linear'
        };
    }

    /**
     * Create a force-based animation instance
     * @param {Object} container - Animation container
     * @param {Array} nodes - Array of nodes
     * @param {Array} links - Array of links
     * @param {Object} options - Animation options
     * @returns {Object} ForceAnimation instance with ID
     */
    createForceAnimation(container, nodes, links, options = {}) {
        const mergedOptions = this.mergeGlobalOptions(options);
        const animation = new ForceAnimation(container, nodes, links, mergedOptions);
        const animationId = this.registerAnimation(animation, 'force');

        return {
            id: animationId,
            animation: animation,
            type: 'force'
        };
    }

    /**
     * Create a clusters animation instance
     * @param {Object} containerGroup - SVG container group
     * @param {Object} layoutCalculator - Layout calculator instance
     * @param {Object} elementSystem - Element system instance
     * @param {Object} options - Animation options
     * @returns {Object} ClustersAnimation instance with ID
     */
    createClustersAnimation(containerGroup, layoutCalculator, elementSystem, options = {}) {
        const mergedOptions = this.mergeGlobalOptions(options);
        const animation = new ClustersAnimation(containerGroup, layoutCalculator, elementSystem, mergedOptions);
        const animationId = this.registerAnimation(animation, 'clusters');

        return {
            id: animationId,
            animation: animation,
            type: 'clusters'
        };
    }

    /**
     * Register an animation instance
     * @param {Object} animation - Animation instance
     * @param {string} type - Animation type
     * @returns {string} Animation ID
     */
    registerAnimation(animation, type) {
        const animationId = `${type}-${++this.animationCounter}`;
        this.activeAnimations.set(animationId, {
            instance: animation,
            type: type,
            createdAt: Date.now(),
            status: 'created'
        });

        // Cleanup old animations if we exceed the limit
        this.enforceAnimationLimit();

        return animationId;
    }

    /**
     * Get an animation by ID
     * @param {string} animationId - Animation ID
     * @returns {Object|null} Animation data or null if not found
     */
    getAnimation(animationId) {
        return this.activeAnimations.get(animationId) || null;
    }

    /**
     * Stop and remove an animation
     * @param {string} animationId - Animation ID
     * @returns {boolean} True if animation was found and stopped
     */
    stopAnimation(animationId) {
        const animationData = this.activeAnimations.get(animationId);
        if (!animationData) return false;

        // Stop the animation if it has a stop method
        if (animationData.instance && typeof animationData.instance.stop === 'function') {
            animationData.instance.stop();
        }

        // Remove from active animations
        this.activeAnimations.delete(animationId);

        console.log(`AnimationManager: Stopped animation ${animationId}`);
        return true;
    }

    /**
     * Stop all animations of a specific type
     * @param {string} type - Animation type ('linear', 'force', 'clusters')
     * @returns {number} Number of animations stopped
     */
    stopAnimationsByType(type) {
        let stoppedCount = 0;

        for (const [animationId, animationData] of this.activeAnimations) {
            if (animationData.type === type) {
                this.stopAnimation(animationId);
                stoppedCount++;
            }
        }

        return stoppedCount;
    }

    /**
     * Stop all active animations
     * @returns {number} Number of animations stopped
     */
    stopAllAnimations() {
        const activeIds = Array.from(this.activeAnimations.keys());
        activeIds.forEach(id => this.stopAnimation(id));

        console.log(`AnimationManager: Stopped ${activeIds.length} animations`);
        return activeIds.length;
    }

    /**
     * Update global animation options
     * @param {Object} options - Global options to update
     */
    updateGlobalOptions(options) {
        this.globalOptions = { ...this.globalOptions, ...options };

        // If animations are disabled, stop all current animations
        if (!this.globalOptions.enableAnimations) {
            this.stopAllAnimations();
        }
    }

    /**
     * Merge global options with animation-specific options
     * @param {Object} options - Animation-specific options
     * @returns {Object} Merged options
     */
    mergeGlobalOptions(options) {
        const merged = { ...options };

        // Apply performance mode adjustments
        if (this.globalOptions.performanceMode) {
            merged.duration = (merged.duration || 3000) * 0.7; // Faster animations
            merged.alphaDecay = (merged.alphaDecay || 0.01) * 1.5; // Faster settling
            merged.maxNodes = Math.min(merged.maxNodes || 100, 50); // Fewer nodes
        }

        return merged;
    }

    /**
     * Enforce maximum concurrent animations limit
     */
    enforceAnimationLimit() {
        if (this.activeAnimations.size <= this.globalOptions.maxConcurrentAnimations) {
            return;
        }

        // Sort animations by creation time and stop the oldest ones
        const sortedAnimations = Array.from(this.activeAnimations.entries())
            .sort((a, b) => a[1].createdAt - b[1].createdAt);

        const toRemove = sortedAnimations.slice(0,
            this.activeAnimations.size - this.globalOptions.maxConcurrentAnimations);

        toRemove.forEach(([animationId]) => {
            console.log(`AnimationManager: Auto-stopping animation ${animationId} due to limit`);
            this.stopAnimation(animationId);
        });
    }

    /**
     * Get statistics about active animations
     * @returns {Object} Animation statistics
     */
    getStatistics() {
        const stats = {
            total: this.activeAnimations.size,
            byType: {},
            oldestCreatedAt: null,
            newestCreatedAt: null
        };

        for (const [id, data] of this.activeAnimations) {
            // Count by type
            stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;

            // Track age range
            if (!stats.oldestCreatedAt || data.createdAt < stats.oldestCreatedAt) {
                stats.oldestCreatedAt = data.createdAt;
            }
            if (!stats.newestCreatedAt || data.createdAt > stats.newestCreatedAt) {
                stats.newestCreatedAt = data.createdAt;
            }
        }

        return stats;
    }

    /**
     * Get all active animation IDs
     * @returns {Array} Array of animation IDs
     */
    getActiveAnimationIds() {
        return Array.from(this.activeAnimations.keys());
    }

    /**
     * Check if animations are enabled globally
     * @returns {boolean} True if animations are enabled
     */
    areAnimationsEnabled() {
        return this.globalOptions.enableAnimations;
    }

    /**
     * Check if performance mode is enabled
     * @returns {boolean} True if performance mode is enabled
     */
    isPerformanceModeEnabled() {
        return this.globalOptions.performanceMode;
    }

    /**
     * Cleanup all resources
     */
    destroy() {
        this.stopAllAnimations();
        this.activeAnimations.clear();
        this.animationCounter = 0;

        console.log('AnimationManager: Destroyed');
    }
}

export default AnimationManager;