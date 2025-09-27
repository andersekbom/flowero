/**
 * D3 Bubble Animation System
 *
 * Clean D3.js implementation of falling bubble visualization with gravity acceleration.
 * Features:
 * - Circles fall from top with realistic gravity physics
 * - Customer-based color coding
 * - Smooth D3 transitions and animations
 * - Click interactions for message details
 */

import { BaseVisualization } from './BaseVisualization.js';

class BubbleAnimation extends BaseVisualization {
    constructor(domManager, eventEmitter, themeManager, colorLegend, options = {}) {
        super(domManager, eventEmitter, themeManager, options);

        this.colorLegend = colorLegend;
        this.options = {
            ...this.options,
            bubbleRadius: 25,
            fallDuration: 4000, // 4 seconds to fall
            spawnWidth: 0.8, // Use 80% of container width for spawning
            maxBubbles: 100,
            gravityAcceleration: true,
            bounceEnabled: true,
            bounceVelocityMultiplier: 0.7, // Energy loss on bounce
            gravity: 0.5, // Gravity acceleration strength
            maxBounces: 3, // Maximum number of bounces before removal
            ...options
        };

        // D3 components
        this.svg = null;
        this.bubblesGroup = null;
        this.bubbleData = [];
        this.bubbleIdCounter = 0;

        // Animation state
        this.isRunning = false;
        this.animationFrame = null;
        this.lastFrameTime = 0;
    }

    /**
     * Initialize the bubble animation system
     */
    initialize() {
        console.log('🚀 BubbleAnimation: Starting initialization...');
        super.initialize();
        console.log('🚀 BubbleAnimation: Base class initialized, container:', this.container);

        if (!this.container) {
            console.error('❌ BubbleAnimation: No container found after base initialization!');
            return this;
        }

        this.setupD3Container();
        this.setupResizeHandler();
        console.log('BubbleAnimation: Initialized successfully');
        return this;
    }

    /**
     * Setup D3 SVG container
     */
    setupD3Container() {
        if (!this.container) {
            console.error('BubbleAnimation: Container not found');
            return;
        }

        // Remove any existing SVG
        const existingSvg = this.container.querySelector('svg.bubble-animation');
        if (existingSvg) {
            existingSvg.remove();
        }

        // Get container dimensions
        const rect = this.container.getBoundingClientRect();

        console.log('🔧 SVG Container setup:', {
            container: this.container,
            containerRect: rect,
            width: rect.width,
            height: rect.height,
            containerStyle: window.getComputedStyle(this.container),
            containerVisible: this.container.offsetParent !== null,
            containerDisplay: window.getComputedStyle(this.container).display,
            containerVisibility: window.getComputedStyle(this.container).visibility,
            containerOpacity: window.getComputedStyle(this.container).opacity
        });

        // Create SVG with D3
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('class', 'bubble-animation')
            .attr('width', rect.width)
            .attr('height', rect.height)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('pointer-events', 'auto')
            .style('z-index', '10');

        // Create groups for organization
        this.bubblesGroup = this.svg.append('g')
            .attr('class', 'bubbles-group');
        console.log('BubbleAnimation: D3 container setup complete');
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
        };

        window.addEventListener('resize', resizeHandler);

        // Store reference for cleanup
        this.resizeHandler = resizeHandler;
    }

    /**
     * Activate the bubble animation
     */
    activate() {
        super.activate();
        this.isRunning = true;
        console.log('BubbleAnimation: Activated');
    }

    /**
     * Deactivate the bubble animation
     */
    deactivate() {
        super.deactivate();
        this.isRunning = false;
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
        this.cleanup();
        console.log('BubbleAnimation: Deactivated');
    }

    /**
     * Add a new message bubble
     */
    addMessage(messageData) {
        if (!this.isRunning || !this.svg) return;

        // Process message with base class
        const processedMessage = this.processMessage(messageData);
        if (!processedMessage) return;

        // Get customer color from legend
        const customer = this.extractCustomerFromTopic(processedMessage.topic);
        const color = this.colorLegend.getCustomerColor(customer);

        // Create bubble data
        const bubbleId = `bubble-${this.bubbleIdCounter++}`;
        const containerRect = this.container.getBoundingClientRect();

        const bubble = {
            id: bubbleId,
            customer: customer,
            deviceId: processedMessage.deviceId,
            color: color,
            message: processedMessage,

            // Position
            x: this.getRandomSpawnX(containerRect.width),
            y: -this.options.bubbleRadius * 2, // Start above container

            // Physics
            vx: (Math.random() - 0.5) * 2, // Small random horizontal velocity
            vy: 2, // Initial downward velocity
            radius: this.options.bubbleRadius,
            bounceCount: 0,

            // Timing
            startTime: Date.now(),

            // Visual
            opacity: 1
        };

        this.bubbleData.push(bubble);
        this.renderBubble(bubble);

        // Start physics animation if not already running
        if (!this.animationFrame) {
            this.startPhysicsAnimation();
        }

        // Limit number of active bubbles
        if (this.bubbleData.length > this.options.maxBubbles) {
            this.removeOldestBubble();
        }

        // Track performance
        this.performanceMetrics.elementsCreated++;
    }

    /**
     * Get random spawn X position
     */
    getRandomSpawnX(containerWidth) {
        const spawnWidth = containerWidth * this.options.spawnWidth;
        const offset = (containerWidth - spawnWidth) / 2;
        return offset + Math.random() * spawnWidth;
    }

    /**
     * Render a bubble using D3
     */
    renderBubble(bubble) {
        // Create bubble group
        const bubbleGroup = this.bubblesGroup
            .append('g')
            .attr('class', 'bubble')
            .attr('id', bubble.id)
            .attr('transform', `translate(${bubble.x}, ${bubble.y})`)
            .style('cursor', 'pointer')
            .style('pointer-events', 'all');

        // Add circle (styled to match network graph)
        bubbleGroup.append('circle')
            .attr('r', bubble.radius)
            .attr('fill', bubble.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('opacity', bubble.opacity);

        // Add device label (positioned below circle like network graph)
        if (bubble.deviceId) {
            bubbleGroup.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', bubble.radius + 15)
                .attr('fill', 'white')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .style('pointer-events', 'none')
                .style('user-select', 'none')
                .text(bubble.deviceId);
        }

        // Add click handler
        bubbleGroup.on('click', () => {
            this.eventEmitter.emit('bubble_clicked', {
                bubble: bubble,
                message: bubble.message
            });
        });

        // Add hover effects
        bubbleGroup
            .on('mouseenter', function() {
                d3.select(this).select('circle')
                    .transition()
                    .duration(150)
                    .attr('r', bubble.radius * 1.1)
                    .style('filter', 'drop-shadow(4px 4px 8px rgba(0,0,0,0.4))');
            })
            .on('mouseleave', function() {
                d3.select(this).select('circle')
                    .transition()
                    .duration(150)
                    .attr('r', bubble.radius)
                    .style('filter', 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))');
            });
    }

    /**
     * Start physics-based animation loop
     */
    startPhysicsAnimation() {
        if (this.animationFrame) return;

        const animate = (currentTime) => {
            if (!this.isRunning || this.bubbleData.length === 0) {
                this.animationFrame = null;
                return;
            }

            const deltaTime = currentTime - this.lastFrameTime;
            if (deltaTime > 16) { // ~60fps
                this.updateBubblePhysics(deltaTime / 1000); // Convert to seconds
                this.lastFrameTime = currentTime;
            }

            this.animationFrame = requestAnimationFrame(animate);
        };

        this.lastFrameTime = performance.now();
        this.animationFrame = requestAnimationFrame(animate);
    }

    /**
     * Update physics for all bubbles
     */
    updateBubblePhysics(deltaTime) {
        const containerHeight = this.container.clientHeight;
        const containerWidth = this.container.clientWidth;

        for (let i = this.bubbleData.length - 1; i >= 0; i--) {
            const bubble = this.bubbleData[i];

            // Apply gravity
            bubble.vy += this.options.gravity * deltaTime * 60; // Scale for 60fps

            // Update position
            bubble.x += bubble.vx * deltaTime * 60;
            bubble.y += bubble.vy * deltaTime * 60;

            // Bounce off bottom
            if (bubble.y + bubble.radius >= containerHeight) {
                bubble.y = containerHeight - bubble.radius;
                bubble.vy = -Math.abs(bubble.vy) * this.options.bounceVelocityMultiplier;
                bubble.vx += (Math.random() - 0.5) * 5; // Add random horizontal velocity on bounce
                bubble.bounceCount++;

                // Remove bubble after max bounces
                if (bubble.bounceCount >= this.options.maxBounces) {
                    this.removeBubble(bubble.id);
                    continue;
                }
            }

            // Bounce off walls
            if (bubble.x - bubble.radius <= 0 || bubble.x + bubble.radius >= containerWidth) {
                bubble.vx = -bubble.vx * 0.8; // Slight energy loss on wall bounce
                bubble.x = Math.max(bubble.radius, Math.min(containerWidth - bubble.radius, bubble.x));
            }

            // Remove bubbles that are too old
            if (Date.now() - bubble.startTime > this.options.fallDuration * 2) {
                this.removeBubble(bubble.id);
                continue;
            }

            // Update visual position
            const bubbleElement = this.bubblesGroup.select(`#${bubble.id}`);
            if (bubbleElement.node()) {
                bubbleElement.attr('transform', `translate(${bubble.x}, ${bubble.y})`);
            }
        }
    }

    /**
     * Remove a specific bubble with pop animation
     */
    removeBubble(bubbleId) {
        const bubbleElement = this.bubblesGroup.select(`#${bubbleId}`);

        if (bubbleElement.node()) {
            // Get current radius
            const currentRadius = parseFloat(bubbleElement.select('circle').attr('r')) || this.options.bubbleRadius;

            // Create pop animation: scale up quickly then fade out
            bubbleElement.select('circle')
                .transition()
                .duration(150)
                .ease(d3.easeCubicOut)
                .attr('r', currentRadius * 1.4) // Scale up 40%
                .transition()
                .duration(100)
                .ease(d3.easeQuadIn)
                .attr('r', 0)
                .style('opacity', 0)
                .on('end', () => {
                    // Remove the entire bubble group after animation
                    bubbleElement.remove();
                });

            // Fade out the text simultaneously
            bubbleElement.select('text')
                .transition()
                .duration(250)
                .style('opacity', 0);
        }

        // Remove from data array immediately to prevent physics updates
        const index = this.bubbleData.findIndex(b => b.id === bubbleId);
        if (index >= 0) {
            this.bubbleData.splice(index, 1);
            this.performanceMetrics.elementsDestroyed++;
        }
    }

    /**
     * Remove the oldest bubble to limit memory usage
     */
    removeOldestBubble() {
        if (this.bubbleData.length > 0) {
            const oldest = this.bubbleData[0];
            this.removeBubble(oldest.id);
        }
    }

    /**
     * Clean up all bubbles and animations
     */
    cleanup() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        if (this.bubblesGroup) {
            this.bubblesGroup.selectAll('.bubble').remove();
        }

        this.bubbleData = [];
        this.bubbleIdCounter = 0;

        console.log('BubbleAnimation: Cleanup completed');
        super.cleanup();
    }

    /**
     * Handle theme changes
     */
    handleThemeChange(themeData) {
        super.handleThemeChange(themeData);

        // Update existing bubbles with new theme colors
        this.bubbleData.forEach(bubble => {
            const newColor = this.colorLegend.getCustomerColor(bubble.customer);
            bubble.color = newColor;

            const bubbleElement = this.bubblesGroup.select(`#${bubble.id}`);
            if (bubbleElement.node()) {
                bubbleElement.select('circle')
                    .transition()
                    .duration(300)
                    .attr('fill', newColor)
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
            activeBubbles: this.bubbleData.length,
            bubbleOptions: this.options
        };
    }

    /**
     * Destroy the bubble animation
     */
    destroy() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        this.cleanup();

        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }

        if (this.svg) {
            this.svg.remove();
        }

        super.destroy();
        console.log('BubbleAnimation: Destroyed');
    }
}

export default BubbleAnimation;