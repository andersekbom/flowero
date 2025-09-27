/**
 * Performance Manager
 *
 * Handles frame rate tracking, performance monitoring, and optimization metrics
 * for the application. Provides centralized performance data collection.
 */

class PerformanceManager {
    constructor() {
        // Frame rate tracking
        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        this.frameRate = 0;
        this.isMonitoring = false;
        this.animationFrameId = null;

        // Performance metrics
        this.metrics = {
            averageFrameRate: 0,
            minFrameRate: Infinity,
            maxFrameRate: 0,
            frameRateHistory: [],
            maxHistorySize: 60 // Keep last 60 FPS measurements
        };

        // Performance callbacks
        this.onFrameRateUpdate = null;
        this.onPerformanceAlert = null;

        // Performance thresholds
        this.lowFrameRateThreshold = 30;
        this.highFrameRateThreshold = 55;
    }

    /**
     * Start frame rate monitoring
     * @param {Function} onUpdate - Optional callback for frame rate updates
     */
    startMonitoring(onUpdate = null) {
        if (this.isMonitoring) {
            console.log('PerformanceManager: Already monitoring performance');
            return;
        }

        this.isMonitoring = true;
        this.onFrameRateUpdate = onUpdate;
        this.lastFrameTime = Date.now();
        this.frameCount = 0;

        console.log('PerformanceManager: Started performance monitoring');
        this.updateFrameRate();
    }

    /**
     * Stop frame rate monitoring
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            return;
        }

        this.isMonitoring = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        console.log('PerformanceManager: Stopped performance monitoring');
    }

    /**
     * Internal frame rate update loop
     */
    updateFrameRate() {
        if (!this.isMonitoring) {
            return;
        }

        this.frameCount++;
        const now = Date.now();
        const timeDiff = now - this.lastFrameTime;

        // Update every second
        if (timeDiff >= 1000) {
            const fps = Math.round((this.frameCount * 1000) / timeDiff);
            this.frameRate = fps;

            // Update metrics
            this.updateMetrics(fps);

            // Call update callback if provided
            if (this.onFrameRateUpdate) {
                this.onFrameRateUpdate(fps, this.metrics);
            }

            // Check for performance alerts
            this.checkPerformanceThresholds(fps);

            // Reset counters
            this.frameCount = 0;
            this.lastFrameTime = now;
        }

        this.animationFrameId = requestAnimationFrame(() => this.updateFrameRate());
    }

    /**
     * Update performance metrics with new frame rate
     * @param {number} fps - Current frame rate
     */
    updateMetrics(fps) {
        // Update min/max
        this.metrics.minFrameRate = Math.min(this.metrics.minFrameRate, fps);
        this.metrics.maxFrameRate = Math.max(this.metrics.maxFrameRate, fps);

        // Add to history
        this.metrics.frameRateHistory.push(fps);
        if (this.metrics.frameRateHistory.length > this.metrics.maxHistorySize) {
            this.metrics.frameRateHistory.shift();
        }

        // Calculate average
        const sum = this.metrics.frameRateHistory.reduce((a, b) => a + b, 0);
        this.metrics.averageFrameRate = Math.round(sum / this.metrics.frameRateHistory.length);
    }

    /**
     * Check if frame rate crosses performance thresholds
     * @param {number} fps - Current frame rate
     */
    checkPerformanceThresholds(fps) {
        if (fps < this.lowFrameRateThreshold && this.onPerformanceAlert) {
            this.onPerformanceAlert('low', fps, this.lowFrameRateThreshold);
        } else if (fps > this.highFrameRateThreshold && this.onPerformanceAlert) {
            this.onPerformanceAlert('high', fps, this.highFrameRateThreshold);
        }
    }

    /**
     * Get current frame rate
     * @returns {number} Current FPS
     */
    getCurrentFrameRate() {
        return this.frameRate;
    }

    /**
     * Get comprehensive performance metrics
     * @returns {Object} Performance metrics object
     */
    getMetrics() {
        return {
            current: this.frameRate,
            average: this.metrics.averageFrameRate,
            min: this.metrics.minFrameRate === Infinity ? 0 : this.metrics.minFrameRate,
            max: this.metrics.maxFrameRate,
            history: [...this.metrics.frameRateHistory],
            isMonitoring: this.isMonitoring
        };
    }

    /**
     * Reset all performance metrics
     */
    resetMetrics() {
        this.metrics.averageFrameRate = 0;
        this.metrics.minFrameRate = Infinity;
        this.metrics.maxFrameRate = 0;
        this.metrics.frameRateHistory = [];
        this.frameCount = 0;
        this.lastFrameTime = Date.now();

        console.log('PerformanceManager: Reset performance metrics');
    }

    /**
     * Set performance alert callback
     * @param {Function} callback - Function to call on performance alerts
     */
    setPerformanceAlertCallback(callback) {
        this.onPerformanceAlert = callback;
    }

    /**
     * Set frame rate thresholds for alerts
     * @param {number} lowThreshold - Low frame rate threshold
     * @param {number} highThreshold - High frame rate threshold
     */
    setThresholds(lowThreshold, highThreshold) {
        this.lowFrameRateThreshold = lowThreshold;
        this.highFrameRateThreshold = highThreshold;
    }

    /**
     * Get performance summary for debugging
     * @returns {Object} Summary of performance data
     */
    getSummary() {
        const metrics = this.getMetrics();
        return {
            status: this.isMonitoring ? 'monitoring' : 'stopped',
            frameRate: {
                current: metrics.current,
                average: metrics.average,
                range: `${metrics.min}-${metrics.max}`
            },
            dataPoints: metrics.history.length,
            thresholds: {
                low: this.lowFrameRateThreshold,
                high: this.highFrameRateThreshold
            }
        };
    }

    /**
     * Check if performance is considered good
     * @returns {boolean} True if performance is above low threshold
     */
    isPerformanceGood() {
        return this.frameRate >= this.lowFrameRateThreshold;
    }

    /**
     * Get performance level as string
     * @returns {string} Performance level: 'excellent', 'good', 'fair', 'poor'
     */
    getPerformanceLevel() {
        if (this.frameRate >= 55) return 'excellent';
        if (this.frameRate >= 45) return 'good';
        if (this.frameRate >= 30) return 'fair';
        return 'poor';
    }
}

export default PerformanceManager;