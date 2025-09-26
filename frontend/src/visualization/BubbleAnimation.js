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
            ...options
        };

        // D3 components
        this.svg = null;
        this.bubblesGroup = null;
        this.bubbleData = [];
        this.bubbleIdCounter = 0;

        // Animation state
        this.isRunning = false;
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
            vx: 0,
            vy: 0,
            radius: this.options.bubbleRadius,

            // Timing
            startTime: Date.now(),

            // Visual
            opacity: 1
        };

        this.bubbleData.push(bubble);
        this.renderBubble(bubble);
        this.animateBubble(bubble);

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

        // Add circle
        bubbleGroup.append('circle')
            .attr('r', bubble.radius)
            .attr('fill', bubble.color)
            .attr('stroke', 'white')
            .attr('stroke-width', 1)
            .attr('opacity', bubble.opacity)
            .style('filter', 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))');

        // Add device label
        if (bubble.deviceId) {
            bubbleGroup.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', '0.35em')
                .attr('fill', 'white')
                .attr('font-size', '10px')
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
     * Animate bubble with gravity physics using D3
     */
    animateBubble(bubble) {
        const containerHeight = this.container.clientHeight;
        const endY = containerHeight + bubble.radius * 2;
        const bubbleElement = this.bubblesGroup.select(`#${bubble.id}`);

        console.log('🎬 Bubble animation:', {
            bubbleId: bubble.id,
            startY: bubble.y,
            containerHeight: containerHeight,
            endY: endY,
            duration: this.options.fallDuration
        });

        if (this.options.gravityAcceleration) {
            // Use D3's easeQuadIn for gravity acceleration
            bubbleElement
                .transition()
                .duration(this.options.fallDuration)
                .ease(d3.easeQuadIn)
                .attr('transform', `translate(${bubble.x}, ${endY})`)
                .on('end', () => {
                    this.removeBubble(bubble.id);
                });
        } else {
            // Linear fall without acceleration
            bubbleElement
                .transition()
                .duration(this.options.fallDuration)
                .ease(d3.easeLinear)
                .attr('transform', `translate(${bubble.x}, ${endY})`)
                .on('end', () => {
                    this.removeBubble(bubble.id);
                });
        }
    }

    /**
     * Remove a specific bubble
     */
    removeBubble(bubbleId) {
        // Remove from D3
        this.bubblesGroup.select(`#${bubbleId}`).remove();

        // Remove from data array
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