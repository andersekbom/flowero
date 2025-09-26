/**
 * D3 Starfield Visualization
 *
 * Clean D3.js implementation of starfield visualization with quadratic acceleration.
 * Features:
 * - Messages start from center and accelerate outward like stars in space
 * - Quadratic acceleration for dramatic starfield effect
 * - Size and brightness increase with distance
 * - Customer-based color coding
 * - Smooth D3 transitions and animations
 */

import { BaseVisualization } from './BaseVisualization.js';

class StarfieldVisualization extends BaseVisualization {
    constructor(domManager, eventEmitter, themeManager, colorLegend, options = {}) {
        super(domManager, eventEmitter, themeManager, options);

        this.colorLegend = colorLegend;
        this.options = {
            ...this.options,
            // Animation parameters
            duration: 15000, // 15 seconds to complete journey
            intensity: 8, // Quadratic acceleration intensity (higher = more dramatic)
            // Scale parameters
            minScale: 0.3,
            maxScale: 10.0,
            // Opacity parameters
            fadeInThreshold: 0.02, // Quick fade in during first 2% of journey
            // Brightness parameters
            minBrightness: 0.6, // Dark at center (60% brightness)
            maxBrightness: 1.0, // Full brightness at edge
            // Performance parameters
            maxStars: 150,
            ...options
        };

        // D3 components
        this.svg = null;
        this.starsGroup = null;
        this.starData = [];
        this.starIdCounter = 0;

        // Container dimensions
        this.centerX = 0;
        this.centerY = 0;
        this.maxDistance = 0;

        // Animation state
        this.isRunning = false;

    }

    /**
     * Initialize the starfield visualization system
     */
    initialize() {
        console.log('🌟 StarfieldVisualization: Starting initialization...');
        super.initialize();

        if (!this.container) {
            console.error('❌ StarfieldVisualization: No container found after base initialization!');
            return this;
        }

        this.setupD3Container();
        this.setupResizeHandler();
        this.updateDimensions();
        console.log('StarfieldVisualization: Initialized successfully');
        return this;
    }

    /**
     * Setup D3 SVG container
     */
    setupD3Container() {
        if (!this.container) {
            console.error('StarfieldVisualization: Container not found');
            return;
        }

        // Remove any existing SVG and background
        const existingSvg = this.container.querySelector('svg.starfield-visualization');
        if (existingSvg) {
            existingSvg.remove();
        }

        // Get container dimensions
        const rect = this.container.getBoundingClientRect();

        // The animated starfield background is handled by CSS when starfield-mode class is added

        // Create SVG with D3
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('class', 'starfield-visualization')
            .attr('width', rect.width)
            .attr('height', rect.height)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('pointer-events', 'auto')
            .style('z-index', '1')
            .style('background', 'transparent');

        // Create groups for organization
        this.starsGroup = this.svg.append('g')
            .attr('class', 'stars-group');

        console.log('StarfieldVisualization: D3 container setup complete');
    }

    /**
     * Add CSS override to ensure starfield background is visible
     */
    addStarfieldCSS() {
        // Check if our override CSS is already added
        if (document.getElementById('starfield-override-css')) {
            return;
        }

        // Calculate center point for background zoom
        const sidebarOffset = this.getSidebarOffset();
        const rect = this.container.getBoundingClientRect();
        const centerXPercent = ((rect.width + sidebarOffset) / 2) / rect.width * 100;
        const centerYPercent = 50; // Always center vertically

        const style = document.createElement('style');
        style.id = 'starfield-override-css';
        style.textContent = `
            .message-flow.starfield-mode::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background:
                    linear-gradient(rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.7)),
                    url('stars.jpg') ${centerXPercent}% ${centerYPercent}%/cover no-repeat;
                background-size: 100% 100%;
                z-index: 0 !important;
                animation: starfieldZoom 20s linear infinite;
                will-change: transform, opacity;
                backface-visibility: hidden;
                transform: translateZ(0);
                pointer-events: none;
            }

            .message-flow.starfield-mode::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: black;
                z-index: 0 !important;
                opacity: 0;
                animation: starfieldBlackout 20s linear infinite;
                pointer-events: none;
            }

            @keyframes starfieldZoom {
                0% {
                    background-size: 100% 100%;
                    background-position: ${centerXPercent}% ${centerYPercent}%;
                }
                94% {
                    background-size: 200% 200%;
                    background-position: ${centerXPercent}% ${centerYPercent}%;
                }
                96% {
                    background-size: 200% 200%;
                    background-position: ${centerXPercent}% ${centerYPercent}%;
                }
                96.1% {
                    background-size: 100% 100%;
                    background-position: ${centerXPercent}% ${centerYPercent}%;
                }
                100% {
                    background-size: 100% 100%;
                    background-position: ${centerXPercent}% ${centerYPercent}%;
                }
            }

            @keyframes starfieldBlackout {
                0% { opacity: 0; }
                93% { opacity: 0; }
                95% { opacity: 1; }
                97% { opacity: 0; }
                100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        console.log('StarfieldVisualization: Added CSS override for background');
    }

    /**
     * Update container dimensions and calculate center point
     */
    updateDimensions() {
        const rect = this.container.getBoundingClientRect();

        // Calculate true center of viewport, accounting for sidebar
        const sidebarOffset = this.getSidebarOffset();
        const viewportWidth = rect.width;
        const viewportHeight = rect.height;

        // Center point should be in the middle of the visible area (not including sidebar)
        this.centerX = (viewportWidth + sidebarOffset) / 2;
        this.centerY = viewportHeight / 2;

        // Calculate max distance (center to corner + buffer for star size)
        const maxScreenDistance = Math.sqrt(
            (viewportWidth / 2) * (viewportWidth / 2) +
            (viewportHeight / 2) * (viewportHeight / 2)
        );

        // Add buffer for maximum star size
        const starMaxSize = 400 * this.options.maxScale;
        const buffer = starMaxSize / 2;
        this.maxDistance = maxScreenDistance + buffer + 200;

        console.log('StarfieldVisualization: Dimensions updated', {
            centerX: this.centerX,
            centerY: this.centerY,
            sidebarOffset: sidebarOffset,
            maxDistance: this.maxDistance
        });
    }

    /**
     * Get sidebar offset to calculate proper center point
     */
    getSidebarOffset() {
        // Try to get sidebar width from the DOM or event emitter
        const sidebar = document.querySelector('.sidebar');
        if (sidebar && !sidebar.classList.contains('collapsed')) {
            return sidebar.offsetWidth || 0;
        }
        return 0;
    }

    /**
     * Setup window resize handler
     */
    setupResizeHandler() {
        const resizeHandler = () => {
            const rect = this.container.getBoundingClientRect();

            if (this.svg) {
                this.svg
                    .attr('width', rect.width)
                    .attr('height', rect.height);
            }


            this.updateDimensions();
        };

        window.addEventListener('resize', resizeHandler);
        this.resizeHandler = resizeHandler;
    }

    /**
     * Activate the starfield visualization
     */
    activate() {
        super.activate();
        this.isRunning = true;
        this.updateDimensions();

        // Debug: Check if container has starfield-mode class
        console.log('StarfieldVisualization: Activated');
        console.log('Container classes:', this.container.className);
        console.log('Container has starfield-mode:', this.container.classList.contains('starfield-mode'));

        // Force add the class if it's missing (temporary debug)
        if (!this.container.classList.contains('starfield-mode')) {
            console.log('Adding starfield-mode class manually for debugging');
            this.container.classList.add('starfield-mode');
        }

        // Add CSS override to fix z-index issue
        this.addStarfieldCSS();
    }

    /**
     * Deactivate the starfield visualization
     */
    deactivate() {
        super.deactivate();
        this.isRunning = false;
        this.cleanup();
        console.log('StarfieldVisualization: Deactivated');
    }

    /**
     * Add a new message star
     */
    addMessage(messageData) {
        if (!this.isRunning || !this.svg) return;

        // Process message with base class
        const processedMessage = this.processMessage(messageData);
        if (!processedMessage) return;

        // Get customer color from legend
        const customer = this.extractCustomerFromTopic(processedMessage.topic);
        const color = this.colorLegend.getCustomerColor(customer);

        // Generate random direction
        const angle = Math.random() * 2 * Math.PI;
        const directionX = Math.cos(angle);
        const directionY = Math.sin(angle);

        // Create star data
        const starId = `star-${this.starIdCounter++}`;

        const star = {
            id: starId,
            customer: customer,
            deviceId: processedMessage.deviceId,
            color: color,
            message: processedMessage,

            // Position and movement
            centerX: this.centerX,
            centerY: this.centerY,
            directionX: directionX,
            directionY: directionY,

            // Animation state
            startTime: Date.now(),
            currentDistance: 0,

            // Visual properties (will be calculated during animation)
            x: this.centerX,
            y: this.centerY,
            scale: this.options.minScale,
            opacity: 0.1,
            brightness: this.options.minBrightness
        };

        this.starData.push(star);
        this.renderStar(star);
        this.animateStar(star);

        // Limit number of active stars
        if (this.starData.length > this.options.maxStars) {
            this.removeOldestStar();
        }

        // Track performance
        this.performanceMetrics.elementsCreated++;
    }

    /**
     * Render a star using D3
     */
    renderStar(star) {
        // Create star group
        const starGroup = this.starsGroup
            .append('g')
            .attr('class', 'star')
            .attr('id', star.id)
            .attr('transform', `translate(${star.x}, ${star.y})`)
            .style('cursor', 'pointer')
            .style('pointer-events', 'all');

        // Create star visual elements
        this.createStarElements(starGroup, star);

        // Add click handler
        starGroup.on('click', () => {
            this.eventEmitter.emit('star_clicked', {
                star: star,
                message: star.message
            });
        });

        // Add hover effects
        starGroup
            .on('mouseenter', function() {
                d3.select(this).select('.star-main')
                    .transition()
                    .duration(150)
                    .attr('r', d => d.scale * 35)
                    .style('filter', 'brightness(1.2) drop-shadow(0 0 10px currentColor)');
            })
            .on('mouseleave', function() {
                d3.select(this).select('.star-main')
                    .transition()
                    .duration(150)
                    .attr('r', d => d.scale * 30)
                    .style('filter', `brightness(${star.brightness}) drop-shadow(2px 2px 4px rgba(0,0,0,0.3))`);
            });
    }

    /**
     * Create visual elements for a star
     */
    createStarElements(starGroup, star) {
        // Main star circle
        starGroup.append('circle')
            .attr('class', 'star-main')
            .attr('r', star.scale * 30)
            .attr('fill', star.color)
            .attr('opacity', star.opacity)
            .style('filter', `brightness(${star.brightness}) drop-shadow(2px 2px 4px rgba(0,0,0,0.3))`);

        // Inner bright core
        starGroup.append('circle')
            .attr('class', 'star-core')
            .attr('r', star.scale * 15)
            .attr('fill', 'white')
            .attr('opacity', star.opacity * 0.8);

        // Outer glow
        starGroup.append('circle')
            .attr('class', 'star-glow')
            .attr('r', star.scale * 50)
            .attr('fill', 'none')
            .attr('stroke', star.color)
            .attr('stroke-width', 2)
            .attr('opacity', star.opacity * 0.3);

        // Device label (only visible when star is large enough)
        if (star.deviceId && star.scale > 0.5) {
            starGroup.append('text')
                .attr('class', 'star-label')
                .attr('text-anchor', 'middle')
                .attr('dy', star.scale * 50 + 15)
                .attr('fill', 'white')
                .attr('font-size', Math.max(10, star.scale * 12))
                .attr('font-weight', 'bold')
                .attr('opacity', star.opacity * 0.8)
                .style('pointer-events', 'none')
                .style('user-select', 'none')
                .text(star.deviceId);
        }
    }

    /**
     * Animate star with quadratic acceleration physics using D3
     */
    animateStar(star) {
        const starElement = this.starsGroup.select(`#${star.id}`);

        const animate = () => {
            const elapsed = Date.now() - star.startTime;
            const state = this.calculateStarState(elapsed, star);

            // Update star data
            star.x = state.x;
            star.y = state.y;
            star.scale = state.scale;
            star.opacity = state.opacity;
            star.brightness = state.brightness;
            star.currentDistance = state.distance;

            // Update visual position and properties
            starElement.attr('transform', `translate(${star.x}, ${star.y})`);

            // Update star elements
            starElement.select('.star-main')
                .attr('r', star.scale * 30)
                .attr('opacity', star.opacity)
                .style('filter', `brightness(${star.brightness}) drop-shadow(2px 2px 4px rgba(0,0,0,0.3))`);

            starElement.select('.star-core')
                .attr('r', star.scale * 15)
                .attr('opacity', star.opacity * 0.8);

            starElement.select('.star-glow')
                .attr('r', star.scale * 50)
                .attr('opacity', star.opacity * 0.3);

            // Update label if it exists
            const label = starElement.select('.star-label');
            if (!label.empty()) {
                label
                    .attr('dy', star.scale * 50 + 15)
                    .attr('font-size', Math.max(10, star.scale * 12))
                    .attr('opacity', star.opacity * 0.8);
            }

            // Continue animation or clean up
            if (!state.isComplete && this.isRunning) {
                requestAnimationFrame(animate);
            } else {
                this.removeStar(star.id);
            }
        };

        animate();
    }

    /**
     * Calculate current star state based on elapsed time
     */
    calculateStarState(elapsed, star) {
        const timeRatio = Math.min(elapsed / this.options.duration, 1);

        // Quadratic acceleration for starfield effect
        const currentDistance = Math.pow(timeRatio, this.options.intensity) * this.maxDistance;

        // Position based on distance and direction
        const currentX = star.centerX + (star.directionX * currentDistance);
        const currentY = star.centerY + (star.directionY * currentDistance);

        // Calculate scale based on distance (further = bigger)
        const distanceRatio = Math.min(currentDistance / this.maxDistance, 1);
        const scale = this.options.minScale + (distanceRatio * distanceRatio * (this.options.maxScale - this.options.minScale));

        // Calculate opacity: fade in quickly during first part of animation
        let opacity;
        if (distanceRatio < this.options.fadeInThreshold) {
            opacity = distanceRatio * (1 / this.options.fadeInThreshold); // Quick fade in
        } else {
            opacity = 1.0; // Full opacity after fade in
        }

        // Calculate brightness: darker at center, brighter at edge
        const brightness = this.options.minBrightness + (distanceRatio * (this.options.maxBrightness - this.options.minBrightness));

        return {
            x: currentX,
            y: currentY,
            scale: scale,
            opacity: opacity,
            brightness: brightness,
            progress: timeRatio,
            distance: currentDistance,
            distanceRatio: distanceRatio,
            isComplete: timeRatio >= 1
        };
    }

    /**
     * Remove a specific star
     */
    removeStar(starId) {
        // Remove from D3
        this.starsGroup.select(`#${starId}`).remove();

        // Remove from data array
        const index = this.starData.findIndex(s => s.id === starId);
        if (index >= 0) {
            this.starData.splice(index, 1);
            this.performanceMetrics.elementsDestroyed++;
        }
    }

    /**
     * Remove the oldest star to limit memory usage
     */
    removeOldestStar() {
        if (this.starData.length > 0) {
            const oldest = this.starData[0];
            this.removeStar(oldest.id);
        }
    }

    /**
     * Clean up all stars and animations
     */
    cleanup() {
        // Remove starfield background

        // Clean up D3 elements
        if (this.starsGroup) {
            this.starsGroup.selectAll('.star').remove();
        }

        this.starData = [];
        this.starIdCounter = 0;

        console.log('StarfieldVisualization: Cleanup completed');
        super.cleanup();
    }

    /**
     * Handle theme changes
     */
    handleThemeChange(themeData) {
        super.handleThemeChange(themeData);

        // Update existing stars with new theme colors
        this.starData.forEach(star => {
            const newColor = this.colorLegend.getCustomerColor(star.customer);
            star.color = newColor;

            const starElement = this.starsGroup.select(`#${star.id}`);
            if (starElement.node()) {
                starElement.select('.star-main')
                    .transition()
                    .duration(300)
                    .attr('fill', newColor);

                starElement.select('.star-glow')
                    .transition()
                    .duration(300)
                    .attr('stroke', newColor);
            }
        });
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...super.getState(),
            isRunning: this.isRunning,
            activeStars: this.starData.length,
            starOptions: this.options,
            dimensions: {
                centerX: this.centerX,
                centerY: this.centerY,
                maxDistance: this.maxDistance
            }
        };
    }

    /**
     * Destroy the starfield visualization
     */
    destroy() {
        // Stop background animation

        this.cleanup();

        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }

        if (this.svg) {
            this.svg.remove();
        }

        super.destroy();
        console.log('StarfieldVisualization: Destroyed');
    }
}

export default StarfieldVisualization;