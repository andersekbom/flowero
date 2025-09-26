/**
 * D3 Radial Burst Visualization System
 *
 * Clean D3.js implementation of radial burst visualization with circular spreading pattern.
 * Features:
 * - Messages burst from center point in all directions with linear motion
 * - Customer-based color coding with legend integration
 * - Smooth D3 transitions and opacity fade-out
 * - Click interactions for message details
 * - Performance tracking and cleanup management
 */

import { BaseVisualization } from './BaseVisualization.js';

class RadialVisualization extends BaseVisualization {
    constructor(domManager, eventEmitter, themeManager, colorLegend, options = {}) {
        super(domManager, eventEmitter, themeManager, options);

        this.colorLegend = colorLegend;
        this.options = {
            ...this.options,
            circleRadius: 25,
            burstDuration: 8000, // 8 seconds to travel from center to edge
            fadeStartPoint: 0.2, // Start fading at 20% of journey
            maxElements: 200, // Performance limit
            spawnDelay: 100, // Minimum delay between spawns
            ...options
        };

        // D3 components
        this.svg = null;
        this.radialGroup = null;
        this.elementData = [];
        this.elementIdCounter = 0;

        // Animation and performance state
        this.isRunning = false;
        this.lastSpawnTime = 0;

        // Center point cache
        this.centerX = 0;
        this.centerY = 0;
    }

    /**
     * Initialize the radial visualization system
     */
    initialize() {
        console.log('🔴 RadialVisualization: Starting initialization...');
        super.initialize();
        console.log('🔴 RadialVisualization: Base class initialized, container:', this.container);

        if (!this.container) {
            console.error('❌ RadialVisualization: No container found after base initialization!');
            return this;
        }

        this.setupD3Container();
        this.setupResizeHandler();
        this.updateCenterPoint();
        console.log('RadialVisualization: Initialized successfully');
        return this;
    }

    /**
     * Setup D3 SVG container
     */
    setupD3Container() {
        if (!this.container) {
            console.error('RadialVisualization: Container not found');
            return;
        }

        // Remove any existing SVG
        const existingSvg = this.container.querySelector('svg.radial-visualization');
        if (existingSvg) {
            existingSvg.remove();
        }

        // Get container dimensions
        const rect = this.container.getBoundingClientRect();

        console.log('🔧 RadialVisualization SVG Container setup:', {
            container: this.container,
            containerRect: rect,
            width: rect.width,
            height: rect.height
        });

        // Create SVG with D3
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('class', 'radial-visualization')
            .attr('width', rect.width)
            .attr('height', rect.height)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('pointer-events', 'auto')
            .style('z-index', '10');

        // Create groups for organization
        this.radialGroup = this.svg.append('g')
            .attr('class', 'radial-group');

        console.log('RadialVisualization: D3 container setup complete');
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

            this.updateCenterPoint();
        };

        window.addEventListener('resize', resizeHandler);
        this.resizeHandler = resizeHandler;
    }

    /**
     * Update center point based on current container dimensions
     */
    updateCenterPoint() {
        if (!this.container) return;

        const rect = this.container.getBoundingClientRect();
        this.centerX = rect.width / 2;
        this.centerY = rect.height / 2;

        console.log('RadialVisualization: Center point updated:', {
            x: this.centerX,
            y: this.centerY
        });
    }

    /**
     * Activate the radial visualization
     */
    activate() {
        super.activate();
        this.isRunning = true;
        this.updateCenterPoint();
        console.log('RadialVisualization: Activated');
    }

    /**
     * Deactivate the radial visualization
     */
    deactivate() {
        super.deactivate();
        this.isRunning = false;
        this.cleanup();
        console.log('RadialVisualization: Deactivated');
    }

    /**
     * Add a new message element
     */
    addMessage(messageData) {
        if (!this.isRunning || !this.svg) return;

        // Throttle spawning for performance
        const now = Date.now();
        if (now - this.lastSpawnTime < this.options.spawnDelay) {
            return;
        }
        this.lastSpawnTime = now;

        // Process message with base class
        const processedMessage = this.processMessage(messageData);
        if (!processedMessage) return;

        // Limit concurrent elements for performance
        if (this.elementData.length >= this.options.maxElements) {
            this.removeOldestElement();
        }

        // Get customer color from legend
        const customer = this.extractCustomerFromTopic(processedMessage.topic);
        const color = this.colorLegend.getCustomerColor(customer);

        // Create element data
        const elementId = `radial-${this.elementIdCounter++}`;
        const element = {
            id: elementId,
            customer: customer,
            deviceId: processedMessage.deviceId,
            color: color,
            message: processedMessage,

            // Position (start at center)
            x: this.centerX,
            y: this.centerY,

            // Direction (random angle)
            angle: Math.random() * 2 * Math.PI,
            directionX: 0,
            directionY: 0,

            // Animation state
            startTime: Date.now(),
            maxDistance: this.calculateMaxDistance(),

            // Visual
            radius: this.options.circleRadius,
            opacity: 1.0
        };

        // Calculate direction vectors
        element.directionX = Math.cos(element.angle);
        element.directionY = Math.sin(element.angle);

        this.elementData.push(element);
        this.renderElement(element);
        this.animateElement(element);

        // Track performance
        this.performanceMetrics.elementsCreated++;
    }

    /**
     * Calculate maximum travel distance based on container size
     */
    calculateMaxDistance() {
        if (!this.container) return 600; // fallback

        const rect = this.container.getBoundingClientRect();

        // Distance from center to corner (furthest travel needed)
        const maxScreenDistance = Math.sqrt(
            (rect.width / 2) * (rect.width / 2) +
            (rect.height / 2) * (rect.height / 2)
        );

        // Add buffer to ensure off-screen removal
        const buffer = this.options.circleRadius * 2 + 100;
        return maxScreenDistance + buffer;
    }

    /**
     * Render an element using D3
     */
    renderElement(element) {
        // Create element group
        const elementGroup = this.radialGroup
            .append('g')
            .attr('class', 'radial-element')
            .attr('id', element.id)
            .attr('transform', `translate(${element.x}, ${element.y})`)
            .style('cursor', 'pointer')
            .style('pointer-events', 'all');

        // Add circle (styled to match other visualizations)
        elementGroup.append('circle')
            .attr('r', element.radius)
            .attr('fill', element.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('opacity', element.opacity)
            .style('filter', 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))');

        // Add device label
        if (element.deviceId) {
            elementGroup.append('text')
                .attr('text-anchor', 'middle')
                .attr('dy', element.radius + 15)
                .attr('fill', 'white')
                .attr('font-size', '12px')
                .attr('font-weight', 'bold')
                .style('pointer-events', 'none')
                .style('user-select', 'none')
                .text(element.deviceId);
        }

        // Add click handler
        elementGroup.on('click', () => {
            this.eventEmitter.emit('radial_element_clicked', {
                element: element,
                message: element.message
            });
        });

        // Add hover effects
        elementGroup
            .on('mouseenter', function() {
                d3.select(this).select('circle')
                    .transition()
                    .duration(150)
                    .attr('r', element.radius * 1.1)
                    .style('filter', 'drop-shadow(4px 4px 8px rgba(0,0,0,0.4))');
            })
            .on('mouseleave', function() {
                d3.select(this).select('circle')
                    .transition()
                    .duration(150)
                    .attr('r', element.radius)
                    .style('filter', 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))');
            });
    }

    /**
     * Animate element with radial burst motion using D3
     */
    animateElement(element) {
        const elementGroup = this.radialGroup.select(`#${element.id}`);
        if (!elementGroup.node()) return;

        const animate = () => {
            const elapsed = Date.now() - element.startTime;
            const timeRatio = Math.min(elapsed / this.options.burstDuration, 1);

            // Calculate current position
            const currentDistance = timeRatio * element.maxDistance;
            const currentX = this.centerX + (element.directionX * currentDistance);
            const currentY = this.centerY + (element.directionY * currentDistance);

            // Calculate opacity with fade effect
            let opacity = 1.0;
            if (timeRatio > this.options.fadeStartPoint) {
                const fadeRatio = (timeRatio - this.options.fadeStartPoint) / (1 - this.options.fadeStartPoint);
                opacity = Math.max(0, 1 - fadeRatio);
            }

            // Update position and opacity
            elementGroup
                .attr('transform', `translate(${currentX}, ${currentY})`)
                .style('opacity', opacity);

            // Check if animation should continue
            const isComplete = timeRatio >= 1;
            const isOffScreen = this.isOffScreen(currentX, currentY);
            const hasParent = elementGroup.node() && elementGroup.node().parentNode;

            if (!isComplete && !isOffScreen && hasParent) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete - remove element
                this.removeElement(element.id);
            }
        };

        animate();

        console.log('🎬 RadialVisualization: Animation started for element:', {
            elementId: element.id,
            angle: element.angle,
            maxDistance: element.maxDistance,
            duration: this.options.burstDuration
        });
    }

    /**
     * Check if element is off screen
     */
    isOffScreen(x, y) {
        if (!this.container) return true;

        const rect = this.container.getBoundingClientRect();
        const buffer = this.options.circleRadius * 2 + 50;

        return (x < -buffer || x > rect.width + buffer ||
                y < -buffer || y > rect.height + buffer);
    }

    /**
     * Remove a specific element
     */
    removeElement(elementId) {
        // Remove from D3
        this.radialGroup.select(`#${elementId}`).remove();

        // Remove from data array
        const index = this.elementData.findIndex(e => e.id === elementId);
        if (index >= 0) {
            this.elementData.splice(index, 1);
            this.performanceMetrics.elementsDestroyed++;
        }
    }

    /**
     * Remove the oldest element to limit memory usage
     */
    removeOldestElement() {
        if (this.elementData.length > 0) {
            const oldest = this.elementData[0];
            this.removeElement(oldest.id);
        }
    }

    /**
     * Clean up all elements and animations
     */
    cleanup() {
        if (this.radialGroup) {
            this.radialGroup.selectAll('.radial-element').remove();
        }

        this.elementData = [];
        this.elementIdCounter = 0;

        console.log('RadialVisualization: Cleanup completed');
        super.cleanup();
    }

    /**
     * Handle theme changes
     */
    handleThemeChange(themeData) {
        super.handleThemeChange(themeData);

        // Update existing elements with new theme colors
        this.elementData.forEach(element => {
            const newColor = this.colorLegend.getCustomerColor(element.customer);
            element.color = newColor;

            const elementGroup = this.radialGroup.select(`#${element.id}`);
            if (elementGroup.node()) {
                elementGroup.select('circle')
                    .transition()
                    .duration(300)
                    .attr('fill', newColor)
                    .attr('stroke', '#fff');
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
            activeElements: this.elementData.length,
            centerPoint: { x: this.centerX, y: this.centerY },
            radialOptions: this.options
        };
    }

    /**
     * Destroy the radial visualization
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
        console.log('RadialVisualization: Destroyed');
    }
}

export default RadialVisualization;