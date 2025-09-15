/**
 * MQTT Message Visualizer Frontend
 * 
 * A high-performance real-time MQTT message visualizer with multiple themes and visualization modes.
 * Features WebSocket-based real-time updates and animated message visualizations.
 * 
 * Performance optimizations:
 * - DOM element caching for reduced queries
 * - Efficient animation using requestAnimationFrame and transforms
 * - Throttled message rate calculation
 * - DocumentFragment usage for batch DOM updates
 * 
 * @class MQTTVisualizer
 */

/**
 * Reusable Circle Renderer for consistent styling across all visualization modes
 */
/**
 * Unified Container System - Single SVG container for all visualization modes
 */
class UnifiedContainer {
    constructor(parentElement) {
        this.parentElement = parentElement;
        this.svg = null;
        this.containerGroup = null;
        this.width = 0;
        this.height = 0;
    }
    
    initialize(layoutCalculator = null) {
        // Remove any existing visualization containers
        this.cleanup();
        
        // Calculate container dimensions (excludes sidebar)
        this.updateDimensions(layoutCalculator);
        
        // Create single SVG container positioned relative to parent
        this.svg = d3.select(this.parentElement)
            .append('svg')
            .attr('id', 'unified-visualization')
            .attr('width', this.width)
            .attr('height', this.height)
            .style('position', 'absolute')
            .style('top', '0px')
            .style('left', '0px')
            .style('overflow', 'visible')
            .style('pointer-events', 'none') // Allow interactions to pass through
            .style('z-index', '1'); // Ensure it doesn't interfere with sidebar
        
        // Create main container group for all elements
        this.containerGroup = this.svg.append('g')
            .attr('class', 'visualization-container');
        
        // Add defs for filters (reuse existing glow effects)
        this.addFilters();
        
        return this;
    }
    
    updateDimensions(layoutCalculator = null) {
        if (layoutCalculator) {
            // Use layout calculator for width/height but actual window center for positioning
            const dimensions = layoutCalculator.getEffectiveDimensions();
            this.width = dimensions.width;
            this.height = dimensions.height;
            // Use actual window center instead of layout calculator center
            this.centerX = window.innerWidth / 2;
            this.centerY = window.innerHeight / 2;
        } else {
            // Fallback to parent element dimensions
            this.width = this.parentElement.clientWidth;
            this.height = this.parentElement.clientHeight;
            this.centerX = this.width / 2;
            this.centerY = this.height / 2;
        }

        if (this.svg) {
            // Update SVG dimensions
            this.svg
                .attr('width', this.width)
                .attr('height', this.height);
        }
    }
    
    addFilters() {
        const defs = this.svg.append('defs');
        
        // Add glow filter (reuse from existing network graph)
        const glowFilter = defs.append('filter')
            .attr('id', 'unified-glow')
            .attr('width', '200%')
            .attr('height', '200%')
            .attr('x', '-50%')
            .attr('y', '-50%');
        
        glowFilter.append('feGaussianBlur')
            .attr('stdDeviation', '3')
            .attr('result', 'coloredBlur');
        
        const feMerge = glowFilter.append('feMerge');
        feMerge.append('feMergeNode').attr('in', 'coloredBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
        
        // Add text shadow filter
        const textShadowFilter = defs.append('filter')
            .attr('id', 'unified-text-shadow')
            .attr('width', '200%')
            .attr('height', '200%');
        
        textShadowFilter.append('feDropShadow')
            .attr('dx', '0')
            .attr('dy', '1')
            .attr('stdDeviation', '2')
            .attr('flood-color', 'rgba(0,0,0,0.8)');
    }
    
    getContainer() {
        return this.containerGroup;
    }
    
    getDimensions() {
        return {
            width: this.width,
            height: this.height,
            centerX: this.centerX,
            centerY: this.centerY
        };
    }
    
    cleanup() {
        // Remove all existing visualization containers
        const existingContainers = [
            '#d3-bubbles',
            '#d3-network', 
            '#d3-radial-svg',
            '#unified-visualization'
        ];
        
        existingContainers.forEach(id => {
            const element = this.parentElement.querySelector(id);
            if (element) {
                element.remove();
            }
        });
        
        // Clear DOM message bubbles
        const bubbles = this.parentElement.querySelectorAll('.message-bubble, .radial-message-bubble');
        bubbles.forEach(bubble => bubble.remove());
    }
}

class MessageProcessor {
    constructor(visualizer) {
        this.visualizer = visualizer;
    }
    
    // Process raw MQTT message into standardized format
    processMessage(messageData) {
        // Extract topic components
        const topicParts = messageData.topic.split('/');
        const customer = topicParts[0] || messageData.topic;
        const deviceId = topicParts.length > 1 ? topicParts[1] : 'N/A';
        
        // Get color
        const color = this.visualizer.getTopicColor(messageData.topic);
        
        // Create standardized message object
        return {
            // Core identification
            customer: customer,
            deviceId: deviceId,
            topic: messageData.topic,
            
            // Visual properties
            color: color,
            
            // Message content
            timestamp: messageData.timestamp,
            payload: messageData.payload,
            qos: messageData.qos || 0,
            retain: messageData.retain || false,
            
            // Processing metadata
            id: `${customer}-${deviceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            processedAt: Date.now()
        };
    }
    
    // Extract just the device ID for labeling
    getDeviceLabel(processedMessage) {
        return processedMessage.deviceId;
    }
    
    // Get customer name for grouping
    getCustomerName(processedMessage) {
        return processedMessage.customer;
    }
    
    // Create formatted time string
    formatTimestamp(processedMessage) {
        return new Date(processedMessage.timestamp * 1000).toLocaleString();
    }
}

// Unified Element System with pluggable styles
class StyleProvider {
    // Base interface for future style variations
    static getStyle(type = 'circle') {
        switch (type) {
            case 'circle':
                return CircleStyle;
            // Future styles can be added here: 'card', 'hexagon', etc.
            default:
                return CircleStyle;
        }
    }
}

class CircleStyle {
    static createElement(processedMessage, options = {}) {
        return CircleRenderer.createCircleElement(
            processedMessage.color, 
            processedMessage.deviceId, 
            options
        );
    }
    
    static createSVGElement(container, processedMessage, x, y, options = {}) {
        return CircleRenderer.createSVGCircle(
            container, 
            processedMessage.color, 
            processedMessage.deviceId, 
            x, y, 
            options
        );
    }
    
    static getDefaultOptions() {
        return {
            size: 50,
            showLabel: true,
            className: 'circle-element'
        };
    }
}

class UnifiedElementSystem {
    constructor(styleType = 'circle') {
        this.styleProvider = StyleProvider.getStyle(styleType);
    }
    
    // Create DOM element using current style
    createElement(processedMessage, options = {}) {
        const defaultOptions = this.styleProvider.getDefaultOptions();
        const finalOptions = { ...defaultOptions, ...options };
        return this.styleProvider.createElement(processedMessage, finalOptions);
    }
    
    // Create SVG element using current style  
    createSVGElement(container, processedMessage, x, y, options = {}) {
        const defaultOptions = this.styleProvider.getDefaultOptions();
        const finalOptions = { ...defaultOptions, ...options };
        return this.styleProvider.createSVGElement(container, processedMessage, x, y, finalOptions);
    }
    
    // Switch to different style (future expansion)
    setStyle(styleType) {
        this.styleProvider = StyleProvider.getStyle(styleType);
    }
}

class CircleRenderer {
    static createCircleElement(color, deviceId, options = {}) {
        const {
            size = 50,
            showLabel = true,
            className = 'circle-element'
        } = options;
        
        // Create main container
        const element = document.createElement('div');
        element.className = className;
        
        // Create structure: circle + optional label below
        element.innerHTML = `
            <div class="circle"></div>
            ${showLabel ? `<div class="circle-label"><div class="device-id">${deviceId}</div></div>` : ''}
        `;
        
        // Style the main container
        Object.assign(element.style, {
            position: 'absolute',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)',
            transition: 'none',
            // Override any inherited styles
            padding: '0',
            borderRadius: '0',
            boxShadow: 'none',
            border: 'none',
            background: 'transparent',
            maxWidth: 'none',
            minWidth: 'none'
        });
        
        // Style the circle with consistent appearance
        const circle = element.querySelector('.circle');
        Object.assign(circle.style, {
            background: color,
            border: '2px solid #fff',
            borderRadius: '50%',
            width: `${size}px`,
            height: `${size}px`,
            boxShadow: 'none',
            outline: 'none',
            filter: 'none'
        });
        
        // Style the label if present
        if (showLabel) {
            const label = element.querySelector('.circle-label');
            Object.assign(label.style, {
                marginTop: '15px', // Use network mode spacing (radius + 15px)
                textAlign: 'center',
                fontSize: '12px', // Use network mode font size
                fontWeight: 'bold', // Use network mode font weight
                fontFamily: 'Arial, sans-serif',
                color: 'white',
                textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                lineHeight: '1.2'
            });
        }
        
        return element;
    }
    
    static createSVGCircle(container, color, deviceId, x, y, options = {}) {
        const {
            size = 50,
            showLabel = true,
            networkMode = false
        } = options;
        
        // Create SVG group
        const group = container.append('g')
            .attr('class', 'svg-circle-group')
            .attr('transform', `translate(${x}, ${y})`);
        
        // Create circle
        group.append('circle')
            .attr('r', size / 2)
            .attr('cx', 0)
            .attr('cy', 0)
            .attr('fill', color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('filter', 'none');
        
        // Add label if requested
        if (showLabel) {
            // Use network mode styling as the default (consistent across all modes)
            const fontSize = '12px';
            const fontWeight = 'bold';
            const labelOffset = 15; // radius + offset

            group.append('text')
                .attr('text-anchor', 'middle')
                .attr('x', 0)
                .attr('y', (size / 2) + labelOffset)
                .attr('fill', 'white')
                .attr('font-size', fontSize)
                .attr('font-weight', fontWeight)
                .attr('font-family', 'Arial, sans-serif')
                .attr('filter', 'url(#textShadow)')
                .text(deviceId);
        }
        
        return group;
    }
}

// Phase 2: Animation Engine - Reusable Movement Patterns
class LinearAnimation {
    constructor(container, direction, layoutCalculator = null, options = {}) {
        this.container = container;
        this.direction = direction; // { x: 0, y: 1 } for down, { x: -1, y: 0 } for left, etc.
        this.layoutCalculator = layoutCalculator;
        
        // Default options
        this.options = {
            duration: 15000,
            margin: 100,
            elementSize: { width: 50, height: 50 }, // For positioning calculations
            ...options
        };
    }
    
    // Calculate start position based on direction
    getStartPosition(containerWidth, containerHeight) {
        const { margin, elementSize } = this.options;
        const { x: dirX, y: dirY } = this.direction;
        
        let startX, startY;
        
        if (dirY === -1) {
            // Moving up: start from bottom
            startX = margin + Math.random() * (containerWidth - elementSize.width - 2 * margin);
            startY = containerHeight + 100;
        } else if (dirY === 1) {
            // Moving down: start from top
            startX = margin + Math.random() * (containerWidth - elementSize.width - 2 * margin);
            startY = -100;
        } else if (dirX === -1) {
            // Moving left: start from right
            startX = containerWidth + 100;
            startY = margin + Math.random() * (containerHeight - 2 * margin);
        } else if (dirX === 1) {
            // Moving right: start from left
            startX = -elementSize.width - 100;
            startY = margin + Math.random() * (containerHeight - 2 * margin);
        }
        
        return { x: startX, y: startY };
    }
    
    // Calculate end position based on direction and travel distance
    getEndPosition(startX, startY, containerWidth, containerHeight) {
        const { elementSize } = this.options;
        const { x: dirX, y: dirY } = this.direction;
        const buffer = 200;
        
        let targetX, targetY;
        
        if (dirX !== 0) {
            // Horizontal movement: travel across full width plus buffer
            const travelDistance = containerWidth + buffer * 2;
            targetX = startX + (dirX * travelDistance);
            targetY = startY; // No vertical movement
        } else {
            // Vertical movement: travel across full height plus buffer
            const travelDistance = containerHeight + buffer * 2;
            targetX = startX; // No horizontal movement
            targetY = startY + (dirY * travelDistance);
        }
        
        return { x: targetX, y: targetY };
    }
    
    // Animate SVG element using D3 transition
    animateSVGElement(svgGroup, containerWidth, containerHeight, onComplete = null) {
        // Use layout calculator dimensions if available
        let effectiveWidth = containerWidth;
        let effectiveHeight = containerHeight;
        
        if (this.layoutCalculator) {
            const layoutDimensions = this.layoutCalculator.getEffectiveDimensions();
            effectiveWidth = layoutDimensions.width;
            effectiveHeight = layoutDimensions.height;
        }
        
        const startPos = this.getStartPosition(effectiveWidth, effectiveHeight);
        const endPos = this.getEndPosition(startPos.x, startPos.y, effectiveWidth, effectiveHeight);
        
        // Set initial position
        svgGroup.attr('transform', `translate(${startPos.x}, ${startPos.y})`);
        
        // Animate to end position with strong acceleration (dramatic gravity effect)
        svgGroup
            .transition()
            .duration(this.options.duration)
            .ease(d3.easeCubicIn) // Cubic acceleration (starts slow, accelerates dramatically)
            .attr('transform', `translate(${endPos.x}, ${endPos.y})`)
            .on('end', () => {
                if (onComplete) onComplete();
            });
        
        return { startPos, endPos };
    }
    
    // Animate DOM element using CSS transforms
    animateDOMElement(element, containerWidth, containerHeight, onComplete = null) {
        const startPos = this.getStartPosition(containerWidth, containerHeight);
        const endPos = this.getEndPosition(startPos.x, startPos.y, containerWidth, containerHeight);
        
        // Set initial position
        element.style.left = `${startPos.x}px`;
        element.style.top = `${startPos.y}px`;
        element.style.transition = `left ${this.options.duration}ms cubic-bezier(0.55, 0.055, 0.675, 0.19), top ${this.options.duration}ms cubic-bezier(0.55, 0.055, 0.675, 0.19)`;

        // Trigger animation
        requestAnimationFrame(() => {
            element.style.left = `${endPos.x}px`;
            element.style.top = `${endPos.y}px`;
        });
        
        // Handle completion
        if (onComplete) {
            setTimeout(onComplete, this.options.duration);
        }
        
        return { startPos, endPos };
    }
}

class RadialAnimation {
    constructor(centerX, centerY, options = {}) {
        this.centerX = centerX;
        this.centerY = centerY;
        
        // Default options
        this.options = {
            duration: 8000,
            fadeStartPoint: 0.2, // Start fading at 20% of journey
            elementSize: { width: 50, height: 50 },
            buffer: 300, // Increased buffer to ensure cleanup at screen edges
            ...options
        };
        
        // Generate random direction for this animation
        this.angle = Math.random() * 2 * Math.PI;
        this.directionX = Math.cos(this.angle);
        this.directionY = Math.sin(this.angle);
    }
    
    // Calculate max distance based on container dimensions
    calculateMaxDistance(containerWidth, containerHeight) {
        // Distance from center to corner of screen (furthest any element needs to travel)
        const maxScreenDistance = Math.sqrt(
            (containerWidth / 2) * (containerWidth / 2) + 
            (containerHeight / 2) * (containerHeight / 2)
        );
        
        // Add buffer to ensure elements move completely off screen
        const elementMaxSize = this.options.elementSize.width + this.options.buffer;
        const buffer = elementMaxSize / 2;
        
        return maxScreenDistance + buffer;
    }
    
    // Calculate current position and opacity based on elapsed time
    calculateState(elapsed, containerWidth, containerHeight) {
        const maxDistance = this.calculateMaxDistance(containerWidth, containerHeight);
        const timeRatio = Math.min(elapsed / this.options.duration, 1);
        const currentDistance = timeRatio * maxDistance;
        
        // Position based on distance and direction
        const currentX = this.centerX + (this.directionX * currentDistance);
        const currentY = this.centerY + (this.directionY * currentDistance);
        
        // Calculate opacity with fade after fadeStartPoint
        let opacity = 1.0;
        if (timeRatio > this.options.fadeStartPoint) {
            const fadeRatio = (timeRatio - this.options.fadeStartPoint) / (1 - this.options.fadeStartPoint);
            opacity = Math.max(0, 1 - fadeRatio);
        }
        
        return {
            x: currentX,
            y: currentY,
            opacity: opacity,
            progress: timeRatio,
            distance: currentDistance,
            isComplete: timeRatio >= 1
        };
    }
    
    // Check if element is off screen
    isOffScreen(x, y, containerWidth, containerHeight) {
        const buffer = this.options.buffer;
        return (x < -buffer || x > containerWidth + buffer || 
                y < -buffer || y > containerHeight + buffer);
    }
    
    // Animate SVG element using requestAnimationFrame
    animateSVGElement(svgGroup, containerWidth, containerHeight, onComplete = null) {
        const startTime = Date.now();
        
        // Set initial position at center
        svgGroup.attr('transform', `translate(${this.centerX}, ${this.centerY})`);
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const state = this.calculateState(elapsed, containerWidth, containerHeight);
            
            // Update position and opacity
            svgGroup
                .attr('transform', `translate(${state.x}, ${state.y})`)
                .style('opacity', state.opacity);
            
            // Check if animation should continue
            const shouldStop = state.isComplete || 
                              this.isOffScreen(state.x, state.y, containerWidth, containerHeight) ||
                              !svgGroup.node() || !svgGroup.node().parentNode;
            
            if (!shouldStop) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete
                if (onComplete) onComplete();
            }
        };
        
        animate();
        
        return {
            angle: this.angle,
            direction: { x: this.directionX, y: this.directionY }
        };
    }
    
    // Animate DOM element using requestAnimationFrame
    animateDOMElement(element, containerWidth, containerHeight, onComplete = null) {
        const startTime = Date.now();
        const { width, height } = this.options.elementSize;
        
        // Set initial position at center (adjusted for element size)
        element.style.left = `${this.centerX - width / 2}px`;
        element.style.top = `${this.centerY - height / 2}px`;
        element.style.opacity = '1';
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const state = this.calculateState(elapsed, containerWidth, containerHeight);
            
            // Update position and opacity (adjust for element center)
            element.style.left = `${state.x - width / 2}px`;
            element.style.top = `${state.y - height / 2}px`;
            element.style.opacity = state.opacity;
            
            // Check if animation should continue
            const shouldStop = state.isComplete || 
                              this.isOffScreen(state.x, state.y, containerWidth, containerHeight) ||
                              !element.parentNode;
            
            if (!shouldStop) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete
                if (onComplete) onComplete();
            }
        };
        
        animate();
        
        return {
            angle: this.angle,
            direction: { x: this.directionX, y: this.directionY }
        };
    }
}

class StarfieldAnimation {
    constructor(centerX, centerY, options = {}) {
        this.centerX = centerX;
        this.centerY = centerY;
        
        // Default options
        this.options = {
            duration: 15000,
            intensity: 8, // Higher = more dramatic acceleration
            minScale: 0.3,
            maxScale: 10.0,
            fadeInThreshold: 0.02, // 2% of journey for quick fade in
            elementSize: { width: 50, height: 50 },
            buffer: 100,
            ...options
        };
        
        // Generate random direction for this animation
        this.angle = Math.random() * 2 * Math.PI;
        this.directionX = Math.cos(this.angle);
        this.directionY = Math.sin(this.angle);
    }
    
    // Calculate max distance based on container dimensions
    calculateMaxDistance(containerWidth, containerHeight) {
        // Distance from center to corner of screen (furthest any element needs to travel)
        const maxScreenDistance = Math.sqrt(
            (containerWidth / 2) * (containerWidth / 2) + 
            (containerHeight / 2) * (containerHeight / 2)
        );
        
        // Add buffer for element size and scaling
        const elementMaxSize = this.options.elementSize.width * this.options.maxScale + this.options.buffer;
        const buffer = elementMaxSize / 2;
        
        return maxScreenDistance + buffer;
    }
    
    // Calculate current state with quadratic acceleration and scaling
    calculateState(elapsed, containerWidth, containerHeight) {
        const maxDistance = this.calculateMaxDistance(containerWidth, containerHeight);
        const timeRatio = Math.min(elapsed / this.options.duration, 1);
        
        // Quadratic acceleration for starfield effect
        const currentDistance = (Math.pow(timeRatio, this.options.intensity)) * maxDistance;
        
        // Position based on distance and direction
        const currentX = this.centerX + (this.directionX * currentDistance);
        const currentY = this.centerY + (this.directionY * currentDistance);
        
        // Calculate scale based on distance (further = bigger)
        const distanceRatio = Math.min(currentDistance / maxDistance, 1);
        const scale = this.options.minScale + (distanceRatio * distanceRatio * (this.options.maxScale - this.options.minScale));
        
        // Calculate opacity: fade in quickly during first part of animation
        let opacity;
        if (distanceRatio < this.options.fadeInThreshold) {
            opacity = distanceRatio * (1 / this.options.fadeInThreshold); // Quick fade in
        } else {
            opacity = 1.0; // Full opacity after fade in
        }
        
        return {
            x: currentX,
            y: currentY,
            scale: scale,
            opacity: opacity,
            progress: timeRatio,
            distance: currentDistance,
            distanceRatio: distanceRatio,
            isComplete: timeRatio >= 1
        };
    }
    
    // Check if element is off screen
    isOffScreen(x, y, containerWidth, containerHeight, scale = 1) {
        const buffer = this.options.buffer * scale; // Scale buffer with element
        return (x < -buffer || x > containerWidth + buffer || 
                y < -buffer || y > containerHeight + buffer);
    }
    
    // Animate SVG element with quadratic acceleration and scaling
    animateSVGElement(svgGroup, containerWidth, containerHeight, onComplete = null) {
        const startTime = Date.now();
        
        // Set initial position at center with minimum scale and low opacity
        svgGroup
            .attr('transform', `translate(${this.centerX}, ${this.centerY}) scale(${this.options.minScale})`)
            .style('opacity', 0.1);
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const state = this.calculateState(elapsed, containerWidth, containerHeight);
            
            // Update position, scale, and opacity
            svgGroup
                .attr('transform', `translate(${state.x}, ${state.y}) scale(${state.scale})`)
                .style('opacity', state.opacity);
            
            // Check if animation should continue
            const shouldStop = state.isComplete || 
                              this.isOffScreen(state.x, state.y, containerWidth, containerHeight, state.scale) ||
                              !svgGroup.node() || !svgGroup.node().parentNode;
            
            if (!shouldStop) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete
                if (onComplete) onComplete();
            }
        };
        
        animate();
        
        return {
            angle: this.angle,
            direction: { x: this.directionX, y: this.directionY }
        };
    }
    
    // Animate DOM element with quadratic acceleration and scaling
    animateDOMElement(element, containerWidth, containerHeight, onComplete = null) {
        const startTime = Date.now();
        
        // Set initial position at center with minimum scale and low opacity
        element.style.left = `${this.centerX - this.options.elementSize.width / 2}px`;
        element.style.top = `${this.centerY - this.options.elementSize.height / 2}px`;
        element.style.transform = `scale(${this.options.minScale})`;
        element.style.opacity = '0.1';
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const state = this.calculateState(elapsed, containerWidth, containerHeight);
            
            // Update position, scale, and opacity
            element.style.left = `${state.x - this.options.elementSize.width / 2}px`;
            element.style.top = `${state.y - this.options.elementSize.height / 2}px`;
            element.style.transform = `scale(${state.scale})`;
            element.style.opacity = state.opacity;
            
            // Check if animation should continue
            const shouldStop = state.isComplete || 
                              this.isOffScreen(state.x, state.y, containerWidth, containerHeight, state.scale) ||
                              !element.parentNode;
            
            if (!shouldStop) {
                requestAnimationFrame(animate);
            } else {
                // Animation complete
                if (onComplete) onComplete();
            }
        };
        
        animate();
        
        return {
            angle: this.angle,
            direction: { x: this.directionX, y: this.directionY }
        };
    }
}

class ForceAnimation {
    constructor(container, nodes, links, options = {}) {
        this.container = container;
        this.nodes = nodes;
        this.links = links;
        
        // Default options based on existing implementation
        this.options = {
            width: 800,
            height: 600,
            velocityDecay: 0.75,
            alphaDecay: 0.01,
            alphaMin: 0.001,
            // Force configurations
            linkDistance: 250,
            linkStrength: 0.2,
            chargeStrength: -800,
            chargeDistanceMax: 400,
            centerStrength: 0.05,
            collisionRadius: 25,
            collisionStrength: 0.3,
            boundaryPadding: 30,
            ...options
        };
        
        this.simulation = null;
        this.onTick = null;
    }
    
    // Create boundary force that keeps nodes within viewport
    createBoundaryForce(width, height) {
        return (alpha) => {
            this.nodes.forEach(node => {
                // Skip fixed nodes (like broker)
                if (node.type === 'broker' || node.fx !== undefined) return;
                
                const nodeRadius = node.radius || 20;
                const padding = nodeRadius + this.options.boundaryPadding;
                
                // Apply exponential force that gets stronger near boundaries
                if (node.x < padding) {
                    const penetration = padding - node.x;
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vx += forceStrength * alpha * 2;
                }
                if (node.x > width - padding) {
                    const penetration = node.x - (width - padding);
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vx -= forceStrength * alpha * 2;
                }
                if (node.y < padding) {
                    const penetration = padding - node.y;
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vy += forceStrength * alpha * 2;
                }
                if (node.y > height - padding) {
                    const penetration = node.y - (height - padding);
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vy -= forceStrength * alpha * 2;
                }
            });
        };
    }
    
    // Handle simulation tick with boundary enforcement
    handleTick() {
        // Enforce hard boundary constraints before updating visuals
        this.nodes.forEach(node => {
            if (node.type === 'broker' || node.fx !== undefined) return; // Skip fixed nodes
            
            const nodeRadius = node.radius || 20;
            const padding = nodeRadius + this.options.boundaryPadding;
            
            // Hard boundary enforcement - never allow nodes to go off screen
            node.x = Math.max(padding, Math.min(this.options.width - padding, node.x));
            node.y = Math.max(padding, Math.min(this.options.height - padding, node.y));
        });
        
        // Call custom tick handler if provided
        if (this.onTick) {
            this.onTick(this.nodes, this.links);
        }
    }
    
    // Initialize the force simulation
    initialize(onTick = null) {
        this.onTick = onTick;
        
        // Create D3 force simulation with smoother movement
        this.simulation = d3.forceSimulation(this.nodes)
            .velocityDecay(this.options.velocityDecay)
            .alphaDecay(this.options.alphaDecay)
            .alphaMin(this.options.alphaMin)
            .force('link', d3.forceLink(this.links)
                .id(d => d.id)
                .distance(d => d.distance || this.options.linkDistance)
                .strength(this.options.linkStrength))
            .force('charge', d3.forceManyBody()
                .strength(this.options.chargeStrength)
                .distanceMax(this.options.chargeDistanceMax))
            .force('center', d3.forceCenter(this.options.width / 2, this.options.height / 2)
                .strength(this.options.centerStrength))
            .force('collision', d3.forceCollide()
                .radius(d => (d.radius || 20) + this.options.collisionRadius)
                .strength(this.options.collisionStrength))
            .force('boundary', this.createBoundaryForce(this.options.width, this.options.height))
            .on('tick', () => this.handleTick());
        
        return this.simulation;
    }
    
    // Update simulation dimensions
    updateDimensions(width, height) {
        this.options.width = width;
        this.options.height = height;
        
        if (this.simulation) {
            // Update center force
            this.simulation.force('center', d3.forceCenter(width / 2, height / 2)
                .strength(this.options.centerStrength));
            
            // Update boundary force
            this.simulation.force('boundary', this.createBoundaryForce(width, height));
            
            // Update broker node position if it exists
            const brokerNode = this.nodes.find(n => n.id === 'broker');
            if (brokerNode) {
                brokerNode.fx = width / 2;
                brokerNode.fy = height / 2;
            }
            
            // Restart simulation with moderate alpha
            this.simulation.alpha(0.3).restart();
        }
    }
    
    // Add nodes and links to simulation
    update(nodes, links) {
        this.nodes = nodes;
        this.links = links;
        
        if (this.simulation) {
            this.simulation.nodes(nodes);
            this.simulation.force('link').links(links);
            this.simulation.alpha(0.3).restart();
        }
    }
    
    // Stop the simulation
    stop() {
        if (this.simulation) {
            this.simulation.stop();
        }
    }
    
    // Restart the simulation
    restart(alpha = 0.3) {
        if (this.simulation) {
            this.simulation.alpha(alpha).restart();
        }
    }
}

// Phase 3: Layout Management - Sidebar-Aware Positioning
class LayoutCalculator {
    constructor(containerElement) {
        this.containerElement = containerElement;
        this.sidebarCollapsedWidth = 60;
        this.sidebarExpandedWidth = 300;
    }
    
    // Detect current sidebar state
    getSidebarState() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) {
            return { isCollapsed: true, width: 0 }; // No sidebar
        }
        
        const isCollapsed = sidebar.classList.contains('collapsed');
        const width = isCollapsed ? this.sidebarCollapsedWidth : this.sidebarExpandedWidth;
        
        return { isCollapsed, width };
    }
    
    // Calculate effective container dimensions excluding sidebar
    getEffectiveDimensions() {
        const containerRect = this.containerElement.getBoundingClientRect();
        const sidebarState = this.getSidebarState();
        
        // Available width is container width minus sidebar width
        const effectiveWidth = containerRect.width - sidebarState.width;
        const effectiveHeight = containerRect.height;
        
        return {
            width: effectiveWidth,
            height: effectiveHeight,
            centerX: effectiveWidth / 2,
            centerY: effectiveHeight / 2,
            fullWidth: containerRect.width,
            fullHeight: containerRect.height,
            sidebarWidth: sidebarState.width,
            sidebarCollapsed: sidebarState.isCollapsed
        };
    }
    
    // Get positioning offset for elements (sidebar compensation)
    getPositionOffset() {
        const sidebarState = this.getSidebarState();
        
        return {
            x: sidebarState.width, // Offset elements by sidebar width
            y: 0 // No vertical offset needed
        };
    }
    
    // Convert container-relative coordinates to viewport coordinates
    containerToViewport(x, y) {
        const offset = this.getPositionOffset();
        return {
            x: x + offset.x,
            y: y + offset.y
        };
    }
    
    // Convert viewport coordinates to container-relative coordinates  
    viewportToContainer(x, y) {
        const offset = this.getPositionOffset();
        return {
            x: x - offset.x,
            y: y - offset.y
        };
    }
    
    // Get safe bounds for element positioning (with margins)
    getSafeBounds(margin = 50) {
        const dimensions = this.getEffectiveDimensions();
        
        return {
            minX: margin,
            maxX: dimensions.width - margin,
            minY: margin,
            maxY: dimensions.height - margin,
            centerX: dimensions.centerX,
            centerY: dimensions.centerY
        };
    }
    
    // Check if coordinates are within effective container bounds
    isWithinBounds(x, y, buffer = 0) {
        const dimensions = this.getEffectiveDimensions();
        
        return (
            x >= -buffer && 
            x <= dimensions.width + buffer &&
            y >= -buffer && 
            y <= dimensions.height + buffer
        );
    }
}

/**
 * NetworkAnimation - Unified force-directed graph animation for network mode
 */
class NetworkAnimation {
    constructor(containerGroup, layoutCalculator, elementSystem, options = {}) {
        this.containerGroup = containerGroup;
        this.layoutCalculator = layoutCalculator;
        this.elementSystem = elementSystem;

        // Default options - tuned for minimal jitter with stable positioning
        this.options = {
            velocityDecay: 0.8,       // Increased damping to reduce oscillations
            alphaDecay: 0.01,         // Slower cooling for more stable settling
            alphaMin: 0.001,          // Lower minimum for smoother final state
            linkDistance: 250,
            linkStrength: 0.3,        // Stronger links for more definitive positioning
            chargeStrength: -800,     // Increased repulsion to prevent overlapping
            chargeDistanceMax: 400,   // Increased range for better separation
            centerStrength: 0.01,     // Minimal centering to avoid force conflicts
            collisionRadius: 50,      // Larger collision radius for more separation
            collisionStrength: 0.7,   // Stronger collisions to maintain boundaries
            boundaryPadding: 30,
            ...options
        };

        // Network state
        this.nodes = [];
        this.links = [];
        this.simulation = null;
        this.nodeGroups = null;
        this.linkGroups = null;

        // Node tracking
        this.brokerNode = null;
        this.customerNodes = new Map();
        this.topicNodes = new Map();
    }

    // Calculate fixed distances
    calculateDistance(linkType = 'broker-customer') {
        if (linkType === 'customer-topic') {
            // Keep customer-topic distances short and fixed
            return 80;
        }
        // Fixed distance for broker-customer links
        return this.options.linkDistance;
    }

    // Update all link distances with fixed values
    updateLinkDistances() {
        if (!this.simulation) return;

        this.links.forEach(link => {
            if (link.source === 'broker' || (link.source && link.source.id === 'broker')) {
                // Broker to customer link - fixed distance
                link.distance = this.calculateDistance('broker-customer');
            } else {
                // Customer to topic link - fixed distance
                link.distance = this.calculateDistance('customer-topic');
            }
        });

        // Update the simulation with new distances
        this.simulation.force('link')
            .distance(d => {
                if (d.type === 'customer-topic') {
                    return this.calculateDistance('customer-topic');
                }
                // Fixed distance for broker-customer links
                return this.calculateDistance('broker-customer');
            });

        // Restart simulation to apply changes
        this.simulation.alpha(0.3).restart();
    }

    // Initialize the network simulation
    initialize() {
        console.log('NetworkAnimation: Initializing force simulation');

        // Create broker node at center
        this.createBrokerNode();

        // Create D3 force simulation
        this.simulation = d3.forceSimulation(this.nodes)
            .velocityDecay(this.options.velocityDecay)
            .alphaDecay(this.options.alphaDecay)
            .alphaMin(this.options.alphaMin)
            .force('link', d3.forceLink(this.links)
                .id(d => d.id)
                .distance(d => {
                    // Use fixed distances for all links
                    if (d.type === 'customer-topic') {
                        return this.calculateDistance('customer-topic');
                    }
                    // Fixed distance for broker-customer links
                    return this.calculateDistance('broker-customer');
                })
                .strength(d => {
                    // Stronger force for customer-topic links to keep them together
                    if (d.type === 'customer-topic') return 0.8;
                    // Normal strength for broker-customer links
                    return this.options.linkStrength;
                })
            )
            .force('charge', d3.forceManyBody()
                .strength(this.options.chargeStrength)
                .distanceMax(this.options.chargeDistanceMax)
            )
            .force('center', d3.forceCenter()
                .strength(this.options.centerStrength)
            )
            .force('collision', d3.forceCollide()
                .radius(d => {
                    // Use actual node radius + padding for collision detection
                    const baseRadius = d.radius || this.options.collisionRadius;
                    // Add much larger padding around broker node to prevent overlap
                    const padding = d.type === 'broker' ? 40 : 8;
                    return baseRadius + padding;
                })
                .strength(this.options.collisionStrength)
            )
            .force('brokerRepel', (alpha) => {
                // Custom force to strongly repel nodes from broker
                if (!this.brokerNode) return;

                this.nodes.forEach(node => {
                    if (node.type === 'broker') return;

                    // Skip if node positions are not yet defined
                    if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
                    if (typeof this.brokerNode.x !== 'number' || typeof this.brokerNode.y !== 'number') return;

                    const dx = node.x - this.brokerNode.x;
                    const dy = node.y - this.brokerNode.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    // Different minimum distances for different node types
                    const minDistance = node.type === 'customer' ? 300 : 120;

                    // Skip if distance calculation failed
                    if (!isFinite(distance) || distance === 0) return;

                    if (distance < minDistance) {
                        const force = (minDistance - distance) / distance * alpha * 0.5;
                        node.vx += dx * force;
                        node.vy += dy * force;
                    }
                });
            })
            .on('tick', () => this.onTick());

        // Apply boundary force and set center position
        this.updateDimensions();

        // Create SVG groups for links and nodes
        this.linkGroups = this.containerGroup.append('g').attr('class', 'links');
        this.nodeGroups = this.containerGroup.append('g').attr('class', 'nodes');

        console.log('NetworkAnimation: Force simulation initialized');
    }

    // Update dimensions and boundary forces
    updateDimensions() {
        if (!this.simulation) return;

        // Use actual current window center (responsive to sidebar changes)
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const dimensions = {
            centerX: windowWidth / 2,
            centerY: windowHeight / 2,
            width: windowWidth,
            height: windowHeight
        };

        console.log('NetworkAnimation: Updated center dimensions:', dimensions);

        // Update center force
        this.simulation.force('center', d3.forceCenter(
            dimensions.centerX,
            dimensions.centerY
        ).strength(this.options.centerStrength));

        // Update boundary force
        this.simulation.force('boundary', this.createBoundaryForce(
            dimensions.width,
            dimensions.height
        ));

        // Update broker node position to new center
        if (this.brokerNode) {
            this.brokerNode.fx = dimensions.centerX;
            this.brokerNode.fy = dimensions.centerY;
            this.brokerNode.x = dimensions.centerX;
            this.brokerNode.y = dimensions.centerY;
        }

        // Restart simulation
        this.simulation.alpha(0.3).restart();
    }

    // Create boundary force to keep nodes within container
    createBoundaryForce(width, height) {
        return (alpha) => {
            this.nodes.forEach(node => {
                if (node.type === 'broker') return; // Skip fixed broker

                const nodeRadius = node.radius || this.options.collisionRadius;
                const padding = this.options.boundaryPadding;

                // Apply boundary constraints with stronger force
                if (node.x < nodeRadius + padding) {
                    node.vx += (nodeRadius + padding - node.x) * alpha * 0.3;
                    node.x = Math.max(node.x, nodeRadius + padding); // Hard clamp
                }
                if (node.x > width - nodeRadius - padding) {
                    node.vx += (width - nodeRadius - padding - node.x) * alpha * 0.3;
                    node.x = Math.min(node.x, width - nodeRadius - padding); // Hard clamp
                }
                if (node.y < nodeRadius + padding) {
                    node.vy += (nodeRadius + padding - node.y) * alpha * 0.3;
                    node.y = Math.max(node.y, nodeRadius + padding); // Hard clamp
                }
                if (node.y > height - nodeRadius - padding) {
                    node.vy += (height - nodeRadius - padding - node.y) * alpha * 0.3;
                    node.y = Math.min(node.y, height - nodeRadius - padding); // Hard clamp
                }
            });
        };
    }

    // Create central broker node
    createBrokerNode() {
        // Use actual window center for broker positioning
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const dimensions = {
            centerX: windowWidth / 2,
            centerY: windowHeight / 2
        };

        console.log('NetworkAnimation: Creating broker at:', dimensions.centerX, dimensions.centerY);

        this.brokerNode = {
            id: 'broker',
            type: 'broker',
            label: 'MQTT Broker',
            radius: 60,
            baseRadius: 60,
            color: '#ff6b6b',
            brightness: 1.0,
            sizeScale: 1.0,
            messageCount: 0,
            x: dimensions.centerX, // Current position
            y: dimensions.centerY, // Current position
            fx: dimensions.centerX, // Fixed position
            fy: dimensions.centerY
        };

        this.nodes.push(this.brokerNode);
        return this.brokerNode;
    }

    // Add customer node
    addCustomerNode(customer, color) {
        if (this.customerNodes.has(customer)) {
            return this.customerNodes.get(customer);
        }

        const brokerX = this.brokerNode ? (this.brokerNode.x || this.brokerNode.fx || 400) : 400;
        const brokerY = this.brokerNode ? (this.brokerNode.y || this.brokerNode.fy || 300) : 300;

        console.log('Creating customer node:', customer, 'at broker position:', brokerX, brokerY);

        const customerNode = {
            id: customer,
            type: 'customer',
            label: customer,
            radius: 45,
            baseRadius: 45,
            color: color,
            brightness: 1.0,
            sizeScale: 1.0,
            messageCount: 0,
            lastActivity: Date.now(),
            // Start at broker center position with fallback
            x: brokerX,
            y: brokerY
        };

        this.nodes.push(customerNode);
        this.customerNodes.set(customer, customerNode);

        // Track element with unified tracker
        if (this.elementTracker) {
            this.elementTracker.trackElement(customerNode, {
                type: 'network-customer',
                status: 'active',
                createdAt: Date.now()
            });
        }

        // Create link from broker to customer
        this.links.push({
            source: 'broker',
            target: customer,
            type: 'broker-customer'
        });

        return customerNode;
    }

    // Add topic node
    addTopicNode(customer, topic, color) {
        const deviceId = this.extractDeviceFromTopic(topic);
        const topicId = `${customer}-${deviceId}`;

        if (this.topicNodes.has(topicId)) {
            const existingNode = this.topicNodes.get(topicId);
            existingNode.lastActivity = Date.now();
            existingNode.messageCount++;
            // Reset brightness and size for new message activity
            existingNode.brightness = 1.0;
            existingNode.sizeScale = 1.0;
            return existingNode;
        }

        // Get customer node to spawn topic near it
        const customerNode = this.customerNodes.get(customer);

        const brokerX = this.brokerNode ? (this.brokerNode.x || this.brokerNode.fx || 400) : 400;
        const brokerY = this.brokerNode ? (this.brokerNode.y || this.brokerNode.fy || 300) : 300;

        console.log('Creating topic node:', topicId, 'at broker position:', brokerX, brokerY);

        const topicNode = {
            id: topicId,
            type: 'topic',
            label: deviceId,
            radius: 30,
            baseRadius: 30,
            color: color,
            brightness: 1.0,
            sizeScale: 1.0,
            messageCount: 1,
            lastActivity: Date.now(),
            customer: customer,
            device: deviceId,
            // Start at broker center position with fallback
            x: brokerX,
            y: brokerY
        };

        this.nodes.push(topicNode);
        this.topicNodes.set(topicId, topicNode);

        // Track element with unified tracker
        if (this.elementTracker) {
            this.elementTracker.trackElement(topicNode, {
                type: 'network-topic',
                status: 'active',
                createdAt: Date.now()
            });
        }

        // Create link from customer to topic
        this.links.push({
            source: customer,
            target: topicId,
            type: 'customer-topic'
        });

        return topicNode;
    }

    // Extract device ID from topic
    extractDeviceFromTopic(topic) {
        const parts = topic.split('/');
        return parts.length > 1 ? parts[1] : 'device';
    }

    // Process new message
    processMessage(messageData, customerColor, topicColor) {
        const customer = messageData.topic.split('/')[0] || 'unknown';

        // Add/update customer node
        const customerNode = this.addCustomerNode(customer, customerColor);
        customerNode.lastActivity = Date.now();
        customerNode.messageCount++;
        // Reset brightness and size for new message activity
        customerNode.brightness = 1.0;
        customerNode.sizeScale = 1.0;

        // Add/update topic node using topic-specific color
        const topicNode = this.addTopicNode(customer, messageData.topic, topicColor || customerColor);

        // Update simulation
        this.updateSimulation();

        // Update visual properties immediately for brightness/size changes
        if (this.nodeGroups) {
            this.nodeGroups.selectAll('circle')
                .style('opacity', d => d.brightness)
                .attr('r', d => d.radius * d.sizeScale);
        }

        return { customerNode, topicNode };
    }

    // Update D3 simulation
    updateSimulation() {
        if (!this.simulation) return;

        // Update simulation with new data
        this.simulation.nodes(this.nodes);
        this.simulation.force('link').links(this.links);

        // Restart simulation
        this.simulation.alpha(0.3).restart();

        // Update visuals
        this.updateVisuals();
    }

    // Update SVG visuals
    updateVisuals() {
        if (!this.nodeGroups || !this.linkGroups) return;


        // Update links
        const linkSelection = this.linkGroups.selectAll('line')
            .data(this.links);

        linkSelection.enter()
            .append('line')
            .style('stroke', '#666')
            .style('stroke-width', 2)
            .style('stroke-opacity', 0.6);

        linkSelection.exit().remove();

        // Update nodes using UnifiedElementSystem with proper D3 data binding
        const nodeSelection = this.nodeGroups.selectAll('g.svg-circle-group')
            .data(this.nodes, d => d.id);

        // Create nodes using proper D3 enter pattern with unified styling
        const nodeEnter = nodeSelection.enter()
            .append('g')
            .attr('class', 'svg-circle-group')
            .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`) // Set initial position
            .style('cursor', 'pointer');

        // Add circles with unified styling
        nodeEnter.append('circle')
            .attr('r', d => d.radius)
            .attr('fill', d => d.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

        // Add labels with unified styling (network mode values)
        nodeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('y', d => d.radius + 15) // Network mode offset
            .attr('fill', 'white')
            .attr('font-size', '12px') // Network mode font size
            .attr('font-weight', 'bold') // Network mode font weight
            .attr('font-family', 'Arial, sans-serif')
            .text(d => d.label);

        // Remove exiting nodes
        nodeSelection.exit().remove();
    }

    // Animation tick handler with position smoothing
    onTick() {
        if (!this.linkGroups || !this.nodeGroups) return;

        // Apply adaptive position smoothing - less smoothing for large movements
        this.nodes.forEach(node => {
            if (node.prevX !== undefined && node.prevY !== undefined) {
                // Calculate movement distance
                const dx = node.x - node.prevX;
                const dy = node.y - node.prevY;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Adaptive smoothing: fast for large moves, heavy damping for micro-jitter
                let baseSmoothingFactor;
                if (distance > 10) {
                    baseSmoothingFactor = 0.6;  // Fast for large repositioning
                } else if (distance > 2) {
                    baseSmoothingFactor = 0.3;  // Moderate for medium movements
                } else {
                    baseSmoothingFactor = 0.1;  // Heavy damping for micro-jitter
                }

                // Smooth interpolation between previous and current position
                const newX = node.prevX + dx * baseSmoothingFactor;
                const newY = node.prevY + dy * baseSmoothingFactor;

                // Only update if movement is above a minimum threshold to prevent micro-updates
                const minMovement = 0.1;
                if (Math.abs(node.x - newX) > minMovement || Math.abs(node.y - newY) > minMovement) {
                    node.x = newX;
                    node.y = newY;
                }
            }
            // Store previous position for next frame
            node.prevX = node.x;
            node.prevY = node.y;
        });

        // Update link positions
        this.linkGroups.selectAll('line')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        // Update node positions using D3 data binding
        this.nodeGroups.selectAll('g.svg-circle-group')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
    }

    // Create pulse animation between nodes
    createPulse(fromNodeId, toNodeId) {
        const fromNode = this.nodes.find(n => n.id === fromNodeId);
        const toNode = this.nodes.find(n => n.id === toNodeId);

        if (!fromNode || !toNode || !this.containerGroup) return;

        // Create pulse circle
        const pulse = this.containerGroup.append('circle')
            .attr('r', 5)
            .attr('cx', fromNode.x)
            .attr('cy', fromNode.y)
            .style('fill', '#00ff00')
            .style('opacity', 0.8);

        // Animate pulse to target
        pulse.transition()
            .duration(800)
            .attr('cx', toNode.x)
            .attr('cy', toNode.y)
            .style('opacity', 0)
            .on('end', () => pulse.remove());
    }

    // Clean up old nodes - disabled for network mode (nodes only fade/shrink)
    cleanupOldNodes(maxAge = 30000) {
        // In network mode, nodes should persist and only become smaller/dimmer
        // No cleanup - let decay system handle visibility through brightness/size

        // However, if we ever do clean up nodes in the future, we should update distances
        // this.updateLinkDistances();
        return;
    }

    // Apply brightness decay
    applyDecay(decayRate = 0.99) {
        let updated = false;

        this.nodes.forEach(node => {
            if (node.type === 'broker') return; // Skip broker

            // Apply brightness decay (fade to very dim but still visible)
            if (node.brightness > 0.05) {
                node.brightness *= decayRate;
                updated = true;
            }

            // Apply size decay (shrink to very small but still visible)
            if (node.sizeScale > 0.15) {
                node.sizeScale *= decayRate;
                updated = true;
            }
        });

        if (updated && this.nodeGroups) {
            // Update visual properties
            this.nodeGroups.selectAll('circle')
                .style('opacity', d => d.brightness)
                .attr('r', d => d.radius * d.sizeScale);
        }
    }

    // Apply brightness decay with grace period and smooth transitions
    applyDecayImproved(decayRate = 0.99) {
        const now = Date.now();
        const gracePeriod = 3000; // 3 seconds grace period before decay starts
        const smoothingFactor = 0.1; // For smooth interpolation
        let updated = false;

        this.nodes.forEach(node => {
            if (node.type === 'broker') return; // Skip broker

            // Check if grace period has passed since last activity
            const timeSinceActivity = now - (node.lastActivity || now);
            if (timeSinceActivity < gracePeriod) {
                // Within grace period - maintain full brightness and size
                if (node.brightness < 1.0) {
                    node.brightness = Math.min(1.0, node.brightness + smoothingFactor);
                    updated = true;
                }
                if (node.sizeScale < 1.0) {
                    node.sizeScale = Math.min(1.0, node.sizeScale + smoothingFactor);
                    updated = true;
                }
                return;
            }

            // Apply brightness decay (fade to 30% but still visible)
            if (node.brightness > 0.3) {
                const targetBrightness = Math.max(0.3, node.brightness * decayRate);
                node.brightness = node.brightness - (node.brightness - targetBrightness) * smoothingFactor;
                updated = true;
            }

            // Apply size decay (shrink to 33% but still visible)
            if (node.sizeScale > 0.33) {
                const targetSize = Math.max(0.33, node.sizeScale * decayRate);
                node.sizeScale = node.sizeScale - (node.sizeScale - targetSize) * smoothingFactor;
                updated = true;
            }
        });

        if (updated && this.nodeGroups) {
            // Update visual properties with smooth transitions
            this.nodeGroups.selectAll('circle')
                .style('opacity', d => d.brightness)
                .attr('r', d => d.radius * d.sizeScale);
        }
    }

    // Stop and cleanup
    stop() {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }

        this.nodes = [];
        this.links = [];
        this.customerNodes.clear();
        this.topicNodes.clear();
        this.brokerNode = null;

        console.log('NetworkAnimation: Stopped and cleaned up');
    }
}

/**
 * ClustersAnimation - D3 Force-based clustered bubbles visualization
 * Groups messages by customer and visualizes as clustered bubbles
 */
class ClustersAnimation {
    constructor(containerGroup, layoutCalculator, elementSystem, options = {}) {
        this.containerGroup = containerGroup;
        this.layoutCalculator = layoutCalculator;
        this.elementSystem = elementSystem;

        // Default options for clusters visualization
        this.options = {
            maxNodes: 200,            // Maximum number of nodes to display
            clusterStrength: 0.8,     // Increased strength for better clustering
            collisionPadding: 2,      // Padding within same cluster
            interClusterPadding: 6,   // Padding between different clusters
            velocityDecay: 0.8,       // Moderate damping for responsive movement
            alphaDecay: 0.02,         // Faster settling
            alphaMin: 0.005,          // Higher minimum for more active simulation
            nodeRadius: {
                min: 8,
                max: 25,
                scale: 1.2             // Scaling factor based on message count
            },
            ...options
        };

        // Cluster state
        this.nodes = [];
        this.clusters = new Map();        // customer -> cluster info
        this.customerNodes = new Map();   // customer -> nodes array
        this.simulation = null;
        this.nodeGroups = null;

        // Color mapping
        this.colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    }

    // Initialize the clusters simulation
    initialize() {
        console.log('ClustersAnimation: Initializing clustered bubbles simulation');

        // Create custom forces
        const forceCluster = this.createClusterForce();
        const forceCollide = this.createCollisionForce();

        // Create D3 force simulation optimized for clusters
        this.simulation = d3.forceSimulation(this.nodes)
            .velocityDecay(this.options.velocityDecay)
            .alphaDecay(this.options.alphaDecay)
            .alphaMin(this.options.alphaMin)
            .force('cluster', forceCluster)
            .force('collide', forceCollide)
            .force('center', d3.forceCenter(0, 0).strength(0.05)) // Weaker center force
            .on('tick', () => this.onTick());

        // Get screen dimensions and set up coordinate system
        const dimensions = this.layoutCalculator.getEffectiveDimensions();
        this.screenCenterX = dimensions.width / 2;
        this.screenCenterY = dimensions.height / 2;

        console.log('ClustersAnimation: Screen center set to', { centerX: this.screenCenterX, centerY: this.screenCenterY });

        // Update center force to use actual screen center
        this.simulation.force('center', d3.forceCenter(this.screenCenterX, this.screenCenterY).strength(0.05));

        // Create SVG group for nodes
        this.nodeGroups = this.containerGroup.append('g').attr('class', 'cluster-nodes');

        console.log('ClustersAnimation: Simulation initialized');
    }

    // Create custom cluster force - attracts nodes to their cluster center
    createClusterForce() {
        return () => {
            const alpha = this.simulation ? this.simulation.alpha() : 0;
            const strength = this.options.clusterStrength * alpha;

            this.nodes.forEach(node => {
                if (!node.cluster) return;

                const cluster = this.clusters.get(node.cluster);
                if (!cluster) {
                    console.log('No cluster found for node:', node.cluster);
                    return;
                }

                // Use cluster target position instead of calculated centroid for stronger clustering
                const targetX = cluster.targetX || 0;
                const targetY = cluster.targetY || 0;

                // Apply force towards cluster center
                const dx = targetX - node.x;
                const dy = targetY - node.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    const force = strength * (node.radius || 10);
                    node.vx += (dx / distance) * force;
                    node.vy += (dy / distance) * force;
                }
            });
        };
    }

    // Create custom collision force with different padding for same vs different clusters
    createCollisionForce() {
        return d3.forceCollide()
            .radius(node => {
                const baseRadius = node.radius || 10;
                // Add padding based on cluster relationship
                return baseRadius + this.options.collisionPadding;
            })
            .strength(0.7)
            .iterations(2);
    }

    // Calculate weighted centroid for a cluster
    calculateClusterCentroid(clusterId) {
        const clusterNodes = this.nodes.filter(n => n.cluster === clusterId);
        if (clusterNodes.length === 0) return null;

        let totalWeight = 0;
        let weightedX = 0;
        let weightedY = 0;

        clusterNodes.forEach(node => {
            const weight = Math.pow(node.radius || 10, 2); // Weight by area
            totalWeight += weight;
            weightedX += node.x * weight;
            weightedY += node.y * weight;
        });

        return {
            x: weightedX / totalWeight,
            y: weightedY / totalWeight
        };
    }

    // Process incoming message and create individual message circles (like radial burst)
    processMessage(messageData, customerColor, topicColor) {
        console.log('ClustersAnimation processMessage called with:', { messageData, customerColor, topicColor });

        const customer = this.extractCustomerFromTopic(messageData.topic);
        const deviceId = this.extractDeviceFromTopic(messageData.topic);

        console.log('Creating message circle for customer:', customer, 'deviceId:', deviceId);

        // Ensure cluster exists for this customer
        this.ensureClusterExists(customer, customerColor);

        // Get cluster target position
        const cluster = this.clusters.get(customer);
        if (!cluster) {
            console.warn('Cluster not found for customer:', customer);
            return null;
        }

        // Create individual message circle (like radial mode)
        const messageId = `${customer}-${deviceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Calculate position within cluster area (small random offset from cluster center)
        const offsetRadius = 40; // Small radius around cluster center
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * offsetRadius;

        const messageNode = {
            id: messageId,
            customer: customer,
            device: deviceId,
            cluster: customer,
            radius: 32, // Fixed radius for individual message circles
            color: customerColor,
            messageData: messageData,
            createdAt: Date.now(),
            // Position near cluster center with small random offset
            x: cluster.targetX + Math.cos(angle) * distance,
            y: cluster.targetY + Math.sin(angle) * distance,
            vx: 0,
            vy: 0
        };

        console.log('Creating message circle node:', messageNode);

        // Add to nodes array for simulation
        this.nodes.push(messageNode);

        // Schedule removal after timeout (like radial burst mode)
        this.scheduleMessageRemoval(messageNode);

        // Update simulation
        this.updateSimulation();

        return messageNode;
    }

    // Schedule removal of message circle after timeout with fade out
    scheduleMessageRemoval(messageNode) {
        const displayTime = 10000; // 10 seconds display time
        const fadeTime = 3000; // 3 seconds fade time

        // Start fade after display time
        setTimeout(() => {
            // Find the DOM element and start fading
            const nodeElement = this.nodeGroups.select(`[data-node-id="${messageNode.id}"]`);
            if (nodeElement.node()) {
                nodeElement.transition()
                    .duration(fadeTime)
                    .style('opacity', 0)
                    .on('end', () => {
                        // Remove from nodes array after fade completes
                        const nodeIndex = this.nodes.findIndex(n => n.id === messageNode.id);
                        if (nodeIndex !== -1) {
                            console.log('Removing faded message circle:', messageNode.id);
                            this.nodes.splice(nodeIndex, 1);
                            // Update simulation
                            this.updateSimulation();
                        }
                    });
            }
        }, displayTime);
    }

    // Calculate node radius based on message count
    calculateNodeRadius(messageCount) {
        const { min, max, scale } = this.options.nodeRadius;
        const scaledSize = min + (messageCount - 1) * scale;
        return Math.min(max, scaledSize);
    }

    // Ensure cluster exists in the clusters map
    ensureClusterExists(customer, color) {
        if (!this.clusters.has(customer)) {
            // Position clusters in a rough circle around screen center
            const clusterCount = this.clusters.size;
            const angle = (clusterCount * 137.5) * (Math.PI / 180); // Golden angle
            const distance = 150 + clusterCount * 50; // Larger separation between clusters

            // Position relative to screen center
            const cluster = {
                id: customer,
                color: color,
                targetX: (this.screenCenterX || 0) + Math.cos(angle) * distance,
                targetY: (this.screenCenterY || 0) + Math.sin(angle) * distance,
                nodeCount: 0
            };

            console.log(`Creating cluster for ${customer} at position (${cluster.targetX.toFixed(1)}, ${cluster.targetY.toFixed(1)}) relative to center (${this.screenCenterX}, ${this.screenCenterY})`);

            this.clusters.set(customer, cluster);
        }
    }

    // Update cluster information
    updateCluster(customer, color) {
        const cluster = this.clusters.get(customer);
        if (cluster) {
            cluster.color = color;
            cluster.nodeCount = this.nodes.filter(n => n.cluster === customer).length;
        }
    }

    // Remove oldest node when exceeding maximum
    removeOldestNode() {
        let oldestNode = null;
        let oldestTime = Date.now();

        this.nodes.forEach(node => {
            if (node.lastActivity < oldestTime) {
                oldestTime = node.lastActivity;
                oldestNode = node;
            }
        });

        if (oldestNode) {
            const index = this.nodes.indexOf(oldestNode);
            this.nodes.splice(index, 1);
        }
    }

    // Update simulation with new data
    updateSimulation() {
        if (!this.simulation) return;

        this.simulation.nodes(this.nodes);
        this.simulation.alpha(0.3).restart();

        // Update visual representation
        this.updateVisuals();
    }

    // Update visual representation
    updateVisuals() {
        if (!this.nodeGroups) return;

        console.log(`ClustersAnimation: Updating visuals for ${this.nodes.length} nodes`);

        // Bind data to nodes
        const nodeSelection = this.nodeGroups.selectAll('g.cluster-node')
            .data(this.nodes, d => d.id);

        console.log('Node selection size:', nodeSelection.size());

        // Remove exiting nodes
        nodeSelection.exit()
            .transition()
            .duration(300)
            .style('opacity', 0)
            .attr('transform', d => `translate(${d.x}, ${d.y}) scale(0)`)
            .remove();

        // Add entering nodes
        const nodeEnter = nodeSelection.enter()
            .append('g')
            .attr('class', 'cluster-node')
            .attr('data-node-id', d => d.id)
            .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`)
            .style('opacity', 0);

        // Add circle to each node - use customer color for consistency within cluster
        nodeEnter.append('circle')
            .attr('r', d => d.radius)
            .attr('fill', d => d.color) // This should be the customer color
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer');

        // Add label to each node - always show device ID
        nodeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.3em')
            .attr('fill', '#fff')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .text(d => d.device.length > 8 ? d.device.substring(0, 8) : d.device);

        // Animate entering nodes
        nodeEnter.transition()
            .duration(500)
            .delay((d, i) => i * 20)
            .style('opacity', 1)
            .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0}) scale(1)`);

        // Update existing nodes
        const mergedNodes = nodeSelection.merge(nodeEnter);

        mergedNodes
            .select('circle')
            .transition()
            .duration(200)
            .attr('r', d => d.radius)
            .attr('fill', d => d.color);

        // Update labels - always show device ID
        mergedNodes
            .select('text')
            .text(d => d.device.length > 8 ? d.device.substring(0, 8) : d.device);
    }

    // Animation tick handler
    onTick() {
        if (!this.nodeGroups) return;

        // Update node positions
        this.nodeGroups.selectAll('g.cluster-node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
    }

    // Update dimensions when layout changes
    updateDimensions() {
        if (!this.simulation || !this.layoutCalculator) return;

        const dimensions = this.layoutCalculator.getEffectiveDimensions();
        this.screenCenterX = dimensions.width / 2;
        this.screenCenterY = dimensions.height / 2;

        console.log('ClustersAnimation: Updating dimensions to', { centerX: this.screenCenterX, centerY: this.screenCenterY, dimensions });

        // Update center force
        this.simulation.force('center', d3.forceCenter(this.screenCenterX, this.screenCenterY).strength(0.05));
    }

    // Utility function to extract customer from topic
    extractCustomerFromTopic(topic) {
        if (!topic) return 'unknown';
        const parts = topic.split('/');
        return parts[0] || 'unknown';
    }

    // Utility function to extract device from topic
    extractDeviceFromTopic(topic) {
        if (!topic) return 'device';
        const parts = topic.split('/');

        // For topics like "customer/device/sensor" or "customer-deviceID"
        if (parts.length > 1) {
            // Use the second part as device ID
            return parts[1];
        } else {
            // For single-part topics, look for device ID after dash
            const lastPart = parts[0] || 'device';
            const deviceMatch = lastPart.match(/-([^-]+)$/);
            const deviceId = deviceMatch ? deviceMatch[1] : lastPart.substring(0, 8);
            console.log(`Extracted device ID "${deviceId}" from topic "${topic}"`);
            return deviceId;
        }
    }

    // Stop and cleanup
    stop() {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }

        if (this.nodeGroups) {
            this.nodeGroups.remove();
            this.nodeGroups = null;
        }

        // Clear data
        this.nodes = [];
        this.clusters.clear();
        this.customerNodes.clear();

        console.log('ClustersAnimation: Stopped and cleaned up');
    }
}

// Phase 4: Element Lifecycle Management
class CleanupManager {
    constructor(containerElement, layoutCalculator) {
        this.containerElement = containerElement;
        this.layoutCalculator = layoutCalculator;
        this.activeElements = new Set(); // Track all active animated elements
        this.cleanupInterval = null;
        this.resizeTimeout = null;
        
        // Cleanup configuration
        this.config = {
            checkInterval: 1000, // Check every 1 second (more frequent)
            bufferZone: 100, // Smaller buffer zone for more aggressive cleanup
            maxAge: 30000, // Maximum element age in milliseconds (30 seconds)
            maxElements: 200 // Lower threshold for aggressive cleanup
        };
        
        this.startPeriodicCleanup();
        this.setupResizeHandler();
    }
    
    // Register an animated element for tracking
    trackElement(svgGroup, animationInfo = {}) {
        const elementData = {
            svgGroup: svgGroup,
            createdAt: Date.now(),
            lastSeenAt: Date.now(),
            animationType: animationInfo.type || 'unknown',
            bounds: animationInfo.bounds || null,
            onCleanup: animationInfo.onCleanup || null
        };
        
        this.activeElements.add(elementData);
        
        // Add cleanup data to the SVG element for easy access
        svgGroup.node().__cleanupData = elementData;
        
        return elementData;
    }
    
    // Remove element from tracking
    untrackElement(svgGroup) {
        const elementData = svgGroup.node().__cleanupData;
        if (elementData) {
            this.activeElements.delete(elementData);
            delete svgGroup.node().__cleanupData;
        }
    }
    
    // Check if element is off-screen
    isOffScreen(svgGroup, bufferZone = this.config.bufferZone) {
        if (!svgGroup.node()) return true;
        
        try {
            const transform = svgGroup.attr('transform');
            if (!transform) return false;
            
            const match = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);
            if (!match) return false;
            
            const x = parseFloat(match[1]);
            const y = parseFloat(match[2]);
            
            // Get current effective dimensions
            const dimensions = this.layoutCalculator ? 
                this.layoutCalculator.getEffectiveDimensions() : 
                {
                    width: this.containerElement.clientWidth,
                    height: this.containerElement.clientHeight
                };
            
            // Debug logging for first few checks
            if (Math.random() < 0.1) { // 10% of the time
                console.log(`CleanupManager debug: Element at (${x.toFixed(1)}, ${y.toFixed(1)}), container: ${dimensions.width}x${dimensions.height}, buffer: ${bufferZone}`);
            }
            
            return (
                x < -bufferZone || 
                x > dimensions.width + bufferZone ||
                y < -bufferZone || 
                y > dimensions.height + bufferZone
            );
        } catch (error) {
            console.warn('Error checking element bounds:', error);
            return true; // Remove problematic elements
        }
    }
    
    // Check if element is too old (fallback cleanup)
    isExpired(elementData) {
        return (Date.now() - elementData.createdAt) > this.config.maxAge;
    }
    
    // Remove an element safely
    removeElement(elementData) {
        try {
            if (elementData.svgGroup && elementData.svgGroup.node()) {
                // Call custom cleanup callback if provided
                if (elementData.onCleanup) {
                    elementData.onCleanup();
                }
                
                // Remove from DOM
                elementData.svgGroup.remove();
            }
            
            // Remove from tracking
            this.activeElements.delete(elementData);
        } catch (error) {
            console.warn('Error removing element:', error);
        }
    }
    
    // Perform cleanup sweep
    performCleanup(aggressive = false) {
        const startTime = Date.now();
        let removedCount = 0;
        const elementsToRemove = [];
        
        // Check all tracked elements
        for (const elementData of this.activeElements) {
            let shouldRemove = false;
            
            // Check if element still exists in DOM
            if (!elementData.svgGroup.node() || !elementData.svgGroup.node().parentNode) {
                shouldRemove = true;
            }
            // Check if off-screen
            else if (this.isOffScreen(elementData.svgGroup)) {
                shouldRemove = true;
            }
            // Check if expired
            else if (this.isExpired(elementData)) {
                shouldRemove = true;
            }
            // Aggressive cleanup if too many elements
            else if (aggressive && this.activeElements.size > this.config.maxElements) {
                const age = Date.now() - elementData.createdAt;
                if (age > 10000) { // Remove elements older than 10 seconds during aggressive cleanup
                    shouldRemove = true;
                }
            }
            
            if (shouldRemove) {
                elementsToRemove.push(elementData);
            }
        }
        
        // Remove flagged elements
        elementsToRemove.forEach(elementData => {
            this.removeElement(elementData);
            removedCount++;
        });
        
        const duration = Date.now() - startTime;
        
        if (removedCount > 0 || this.activeElements.size > 0) {
            console.log(`Cleanup: Removed ${removedCount} elements in ${duration}ms. Active: ${this.activeElements.size}${aggressive ? ' (AGGRESSIVE)' : ''}`);
        }
        
        // Also log if we have many active elements
        if (this.activeElements.size > 50) {
            console.warn(`CleanupManager: High element count: ${this.activeElements.size} active elements`);
        }
        
        return removedCount;
    }
    
    // Start periodic cleanup
    startPeriodicCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        this.cleanupInterval = setInterval(() => {
            const aggressive = this.activeElements.size > this.config.maxElements;
            this.performCleanup(aggressive);
        }, this.config.checkInterval);
    }
    
    // Handle window resize events
    setupResizeHandler() {
        window.addEventListener('resize', () => {
            // Debounce resize events
            if (this.resizeTimeout) {
                clearTimeout(this.resizeTimeout);
            }
            
            this.resizeTimeout = setTimeout(() => {
                console.log('Window resized - performing cleanup sweep');
                this.performCleanup(true); // Aggressive cleanup on resize
            }, 300);
        });
    }
    
    // Manual cleanup trigger
    forceCleanup() {
        return this.performCleanup(true);
    }
    
    // Get status information
    getStatus() {
        return {
            activeElements: this.activeElements.size,
            maxElements: this.config.maxElements,
            cleanupInterval: this.config.checkInterval
        };
    }
    
    // Stop cleanup system
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
        
        // Clean up all remaining elements
        this.activeElements.forEach(elementData => {
            this.removeElement(elementData);
        });
        
        this.activeElements.clear();
    }

    // Reset all tracking and clear all elements
    reset() {
        console.log('CleanupManager: Resetting all tracking');

        // Clear all tracked elements
        this.activeElements.forEach(elementData => {
            this.removeElement(elementData);
        });

        this.activeElements.clear();

        // Clear any timeouts
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }

        console.log('CleanupManager: Reset complete');
    }
}

class UnifiedElementTracker {
    constructor() {
        this.activeElements = new Map(); // elementId -> elementInfo
        this.counters = {
            total: 0,
            byType: {
                radial: 0,
                linear: 0,
                network: 0,
                starfield: 0
            },
            byStatus: {
                animating: 0,
                fading: 0,
                completed: 0
            }
        };
        
        this.nextElementId = 1;
    }
    
    // Register a new element
    trackElement(svgGroup, elementInfo = {}) {
        const elementId = `element_${this.nextElementId++}`;
        
        const trackedElement = {
            id: elementId,
            svgGroup: svgGroup,
            type: elementInfo.type || 'unknown',
            createdAt: Date.now(),
            status: 'animating',
            animationType: elementInfo.animationType || 'unknown',
            ...elementInfo
        };
        
        this.activeElements.set(elementId, trackedElement);
        
        // Update counters
        this.counters.total++;
        this.counters.byType[trackedElement.type] = (this.counters.byType[trackedElement.type] || 0) + 1;
        this.counters.byStatus.animating++;
        
        // Store elementId on the SVG node for easy lookup
        if (svgGroup && svgGroup.node()) {
            svgGroup.node().__elementId = elementId;
        }
        
        return elementId;
    }
    
    // Update element status
    updateElementStatus(elementId, newStatus) {
        const element = this.activeElements.get(elementId);
        if (element) {
            const oldStatus = element.status;
            element.status = newStatus;
            
            // Update status counters
            this.counters.byStatus[oldStatus]--;
            this.counters.byStatus[newStatus]++;
        }
    }
    
    // Remove element from tracking
    untrackElement(elementId) {
        const element = this.activeElements.get(elementId);
        if (element) {
            // Update counters
            this.counters.total--;
            this.counters.byType[element.type]--;
            this.counters.byStatus[element.status]--;
            
            // Remove from tracking
            this.activeElements.delete(elementId);
            
            // Clean up SVG node reference
            if (element.svgGroup && element.svgGroup.node()) {
                delete element.svgGroup.node().__elementId;
            }
        }
    }
    
    // Get element by SVG group
    getElementBySvg(svgGroup) {
        if (svgGroup && svgGroup.node() && svgGroup.node().__elementId) {
            return this.activeElements.get(svgGroup.node().__elementId);
        }
        return null;
    }
    
    // Get current counts
    getCounts() {
        return {
            total: this.counters.total,
            byType: {...this.counters.byType},
            byStatus: {...this.counters.byStatus}
        };
    }
    
    // Get all active elements of a specific type
    getElementsByType(type) {
        const elements = [];
        for (const element of this.activeElements.values()) {
            if (element.type === type) {
                elements.push(element);
            }
        }
        return elements;
    }
    
    // Get elements older than specified age
    getElementsOlderThan(ageMs) {
        const cutoffTime = Date.now() - ageMs;
        const oldElements = [];
        
        for (const element of this.activeElements.values()) {
            if (element.createdAt < cutoffTime) {
                oldElements.push(element);
            }
        }
        
        return oldElements;
    }
    
    // Get performance statistics
    getStats() {
        const now = Date.now();
        let totalAge = 0;
        let oldestAge = 0;
        
        for (const element of this.activeElements.values()) {
            const age = now - element.createdAt;
            totalAge += age;
            oldestAge = Math.max(oldestAge, age);
        }
        
        return {
            totalElements: this.counters.total,
            averageAge: this.counters.total > 0 ? totalAge / this.counters.total : 0,
            oldestAge: oldestAge,
            byType: {...this.counters.byType},
            byStatus: {...this.counters.byStatus}
        };
    }
    
    // Clear all tracking (for mode switches)
    clearAll() {
        this.activeElements.clear();
        this.counters.total = 0;
        this.counters.byType = {
            radial: 0,
            linear: 0, 
            network: 0,
            starfield: 0
        };
        this.counters.byStatus = {
            animating: 0,
            fading: 0,
            completed: 0
        };
    }
    
    // Remove element from tracking by SVG group
    removeElement(svgGroup) {
        if (!svgGroup || !svgGroup.node()) {
            return false;
        }
        
        const elementId = svgGroup.node().__elementId;
        if (!elementId) {
            return false;
        }
        
        const element = this.activeElements.get(elementId);
        if (!element) {
            return false;
        }
        
        // Update counters
        this.counters.total = Math.max(0, this.counters.total - 1);
        this.counters.byType[element.type] = Math.max(0, (this.counters.byType[element.type] || 1) - 1);
        this.counters.byStatus[element.status] = Math.max(0, (this.counters.byStatus[element.status] || 1) - 1);
        
        // Remove from tracking
        this.activeElements.delete(elementId);
        
        // Clear element ID from SVG node
        delete svgGroup.node().__elementId;
        
        return true;
    }
    
    // Debug info
    getDebugInfo() {
        const elements = Array.from(this.activeElements.values()).map(el => ({
            id: el.id,
            type: el.type,
            status: el.status,
            age: Date.now() - el.createdAt
        }));
        
        return {
            counts: this.getCounts(),
            stats: this.getStats(),
            elements: elements
        };
    }

    // Reset all tracking
    reset() {
        console.log('UnifiedElementTracker: Resetting all tracking');

        this.activeElements.clear();
        this.counters.total = 0;
        this.counters.byType = {
            radial: 0,
            linear: 0,
            network: 0,
            starfield: 0
        };
        this.counters.byStatus = {
            animating: 0,
            fading: 0,
            completed: 0
        };

        console.log('UnifiedElementTracker: Reset complete');
    }
}

/**
 * Mode Switching Manager - Ensures clean transitions between visualization modes
 */
class ModeSwitchingManager {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.currentMode = null;
        this.isTransitioning = false;
        this.transitionTimeout = null;
    }

    // Clean switch to new mode with proper cleanup
    switchMode(newMode) {
        if (this.isTransitioning) {
            console.log('ModeSwitchingManager: Mode switch already in progress, ignoring request');
            return false;
        }

        if (this.currentMode === newMode) {
            console.log(`ModeSwitchingManager: Already in ${newMode} mode`);
            return true;
        }

        console.log(`ModeSwitchingManager: Switching from ${this.currentMode || 'none'} to ${newMode}`);

        this.isTransitioning = true;

        // Step 1: Clean up current mode
        this.cleanupCurrentMode();

        // Step 2: Update UI states
        this.updateModeButtons(newMode);

        // Step 3: Initialize new mode
        this.initializeNewMode(newMode);

        // Step 4: Complete transition
        this.completeTransition(newMode);

        return true;
    }

    // Clean up all elements and state from current mode
    cleanupCurrentMode() {
        if (!this.currentMode) return;

        console.log(`ModeSwitchingManager: Cleaning up ${this.currentMode} mode`);

        // Clear all active animations and elements
        if (this.visualizer.unifiedContainer) {
            this.visualizer.unifiedContainer.cleanup();
        }

        // Reset cleanup manager
        if (this.visualizer.cleanupManager) {
            this.visualizer.cleanupManager.reset();
        }

        // Clear element tracker
        if (this.visualizer.elementTracker) {
            this.visualizer.elementTracker.reset();
        }

        // Reset animation counters
        this.visualizer.activeRadialAnimations = 0;

        // Clear color legend and visualization state
        this.visualizer.resetVisualizationState();

        // Stop NetworkAnimation if it exists
        if (this.visualizer.networkAnimation) {
            this.visualizer.networkAnimation.stop();
            this.visualizer.networkAnimation = null;
        }

        // Stop ClustersAnimation if it exists
        if (this.visualizer.clustersAnimation) {
            this.visualizer.clustersAnimation.stop();
            this.visualizer.clustersAnimation = null;
        }

        // Remove mode-specific CSS classes
        this.visualizer.domElements.messageFlow.classList.remove(
            'starfield-mode', 'radial-mode', 'network-mode', 'bubbles-mode', 'clusters-mode'
        );

        // Clear any mode-specific timers or intervals
        this.clearModeTimers();
    }

    // Update button states to reflect new mode
    updateModeButtons(newMode) {
        // Update collapsed sidebar icons
        this.visualizer.domElements.vizIconButtons.forEach(btn => {
            if (btn.dataset.mode === newMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Update expanded sidebar buttons
        this.visualizer.domElements.vizModeButtons.forEach(btn => {
            if (btn.dataset.mode === newMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Initialize the new visualization mode
    initializeNewMode(newMode) {
        console.log(`ModeSwitchingManager: Initializing ${newMode} mode`);

        // Set the new mode
        this.visualizer.visualizationMode = newMode;

        // Add mode-specific CSS class
        this.visualizer.domElements.messageFlow.classList.add(`${newMode}-mode`);

        // Initialize unified container for unified modes
        if (['bubbles', 'radial', 'starfield'].includes(newMode)) {
            this.initializeUnifiedMode(newMode);
        } else if (newMode === 'network') {
            this.initializeNetworkMode();
        } else if (newMode === 'clusters') {
            this.initializeClustersMode();
        }

        // Update layout for new mode
        if (this.visualizer.layoutCalculator && this.visualizer.unifiedContainer) {
            this.visualizer.unifiedContainer.updateDimensions(this.visualizer.layoutCalculator);
        }

        // Update NetworkAnimation dimensions for network mode
        if (this.visualizer.networkAnimation) {
            this.visualizer.networkAnimation.updateDimensions();
        }
    }

    // Initialize unified container modes (bubbles, radial, starfield)
    initializeUnifiedMode(mode) {
        // Initialize unified container if not exists
        if (!this.visualizer.unifiedContainer) {
            this.visualizer.unifiedContainer = new UnifiedContainer(this.visualizer.domElements.messageFlow);
        }

        // Initialize with layout calculator
        this.visualizer.unifiedContainer.initialize(this.visualizer.layoutCalculator);

        console.log(`ModeSwitchingManager: Unified mode ${mode} initialized`);
    }

    // Initialize network mode using NetworkAnimation with proper brightness decay
    initializeNetworkMode() {
        console.log('ModeSwitchingManager: Initializing network mode with NetworkAnimation');

        // Initialize unified container for network mode
        if (!this.visualizer.unifiedContainer) {
            this.visualizer.unifiedContainer = new UnifiedContainer(this.visualizer.domElements.messageFlow);
        }

        // Initialize container with layout calculator
        this.visualizer.unifiedContainer.initialize(this.visualizer.layoutCalculator);

        // Create NetworkAnimation instance
        const containerGroup = this.visualizer.unifiedContainer.getContainer();
        this.visualizer.networkAnimation = new NetworkAnimation(
            containerGroup,
            this.visualizer.layoutCalculator,
            this.visualizer.elementSystem
        );

        // Initialize the network simulation
        this.visualizer.networkAnimation.initialize();

        // Start brightness decay with improved minimum brightness
        this.startNetworkBrightnessDecay();

        console.log('ModeSwitchingManager: Network mode initialized');
    }

    // Initialize clusters mode using ClustersAnimation
    initializeClustersMode() {
        console.log('ModeSwitchingManager: Initializing clusters mode');

        // Initialize unified container for clusters mode
        if (!this.visualizer.unifiedContainer) {
            this.visualizer.unifiedContainer = new UnifiedContainer(this.visualizer.domElements.messageFlow);
            console.log('Created new unified container for clusters');
        }

        // Initialize container with layout calculator
        this.visualizer.unifiedContainer.initialize(this.visualizer.layoutCalculator);
        console.log('Initialized unified container with layout calculator');

        // Create ClustersAnimation instance
        const containerGroup = this.visualizer.unifiedContainer.getContainer();
        console.log('Got container group:', containerGroup);

        this.visualizer.clustersAnimation = new ClustersAnimation(
            containerGroup,
            this.visualizer.layoutCalculator,
            this.visualizer.elementSystem
        );
        console.log('Created ClustersAnimation instance:', this.visualizer.clustersAnimation);

        // Initialize the clusters simulation
        this.visualizer.clustersAnimation.initialize();

        console.log('ModeSwitchingManager: Clusters mode initialized successfully');
    }

    // Start brightness decay for network mode with improved minimum brightness
    startNetworkBrightnessDecay() {
        // Clear any existing interval
        if (this.visualizer.brightnessInterval) {
            clearInterval(this.visualizer.brightnessInterval);
        }

        // Start brightness decay with improved minimum (0.3 instead of 0.05)
        this.visualizer.brightnessInterval = setInterval(() => {
            if (this.visualizer.visualizationMode === 'network' && this.visualizer.networkAnimation) {
                this.visualizer.networkAnimation.applyDecayImproved(0.995); // 25% slower decay (was 0.99)
            }
        }, 100); // 10x per second for smoother decay
    }

    // Complete the mode transition
    completeTransition(newMode) {
        this.currentMode = newMode;
        this.isTransitioning = false;

        // Clear any pending transition timeout
        if (this.transitionTimeout) {
            clearTimeout(this.transitionTimeout);
            this.transitionTimeout = null;
        }

        console.log(`ModeSwitchingManager: Transition to ${newMode} complete`);

        // Trigger any mode-specific post-initialization
        this.postModeInitialization(newMode);
    }

    // Mode-specific post-initialization tasks
    postModeInitialization(mode) {
        switch (mode) {
            case 'network':
                // Network mode might need additional setup
                break;
            case 'starfield':
                // Starfield mode might need background setup
                break;
            default:
                // Other modes are ready immediately
                break;
        }
    }

    // Clear any mode-specific timers or intervals
    clearModeTimers() {
        // Clear any network mode intervals (new system)
        if (this.visualizer.brightnessInterval) {
            clearInterval(this.visualizer.brightnessInterval);
            this.visualizer.brightnessInterval = null;
        }

        // Stop any D3 simulations
        if (this.visualizer.d3Simulation) {
            this.visualizer.d3Simulation.stop();
            this.visualizer.d3Simulation = null;
        }
    }

    // Get current transition state
    getState() {
        return {
            currentMode: this.currentMode,
            isTransitioning: this.isTransitioning,
            hasActiveElements: this.visualizer.elementTracker ?
                             this.visualizer.elementTracker.getCounts().total > 0 : false
        };
    }

    // Force complete any pending transition (emergency cleanup)
    forceCompleteTransition() {
        if (this.isTransitioning) {
            console.warn('ModeSwitchingManager: Force completing transition');
            this.isTransitioning = false;
            if (this.transitionTimeout) {
                clearTimeout(this.transitionTimeout);
                this.transitionTimeout = null;
            }
        }
    }
}

class MQTTVisualizer {
    constructor() {
        // Initialize screen dimensions - will be calculated when needed
        this.SCREEN_WIDTH = null;
        this.SCREEN_HEIGHT = null;
        this.SCREEN_CENTER_X = null;
        this.SCREEN_CENTER_Y = null;
        
        // Unified container system
        this.unifiedContainer = null;
        
        // Message processing system
        this.messageProcessor = new MessageProcessor(this);
        
        // Unified element system (all modes use same circles)
        this.elementSystem = new UnifiedElementSystem('circle');
        
        // Unified element tracking system
        this.elementTracker = new UnifiedElementTracker();

        // Mode switching management system
        this.modeSwitchingManager = new ModeSwitchingManager(this);

        // Layout management system
        this.layoutCalculator = null; // Initialized after DOM elements
        
        // Connection state
        this.websocket = null;
        this.isConnected = false;
        
        // Message tracking
        //this.messageCount = 0;
        this.messageRate = 0;
        this.messageHistory = [];
        
        // Performance tracking for radial mode
        this.activeRadialAnimations = 0;
        this.maxRadialAnimations = 200; // Limit concurrent animations
        
        // Z-index tracking for depth layering
        this.messageZIndex = 1000; // Start with high z-index (newer cards will have lower values)
        this.maxZIndex = 1000; // Maximum z-index value
        this.minZIndex = 1; // Minimum z-index value (prevent going to 0 or negative)
        
        // Frame rate tracking
        this.frameCount = 0;
        this.lastFrameTime = Date.now();
        this.frameRate = 0;
        
        // Performance optimizations
        this.animationFramePool = new Set();
        this.bubblePool = [];
        this.maxPoolSize = 50;
        this.activeAnimations = new Map();
        
        // Browser compatibility
        this.hasIntersectionObserver = 'IntersectionObserver' in window;
        this.hasRequestIdleCallback = 'requestIdleCallback' in window;
        this.supportsPassiveListeners = this.detectPassiveSupport();
        
        // Topic and color management
        this.topicColors = new Map();
        this.customerColors = new Map();
        this.activeTopics = new Set();
        
        // Visualization state
        this.visualizationMode = null; // Will be set by ModeSwitchingManager
        this.currentAngle = 0;
        
        // Direction control for bubbles mode
        this.bubbleDirection = { x: 0, y: 1 }; // Default: downward
        
        // D3.js Network graph state
        this.d3Nodes = []; // Array of all nodes for D3
        this.d3Links = []; // Array of all links for D3
        this.d3Simulation = null;
        this.d3Svg = null;
        this.d3Container = null;
        this.networkResizeObserver = null;
        
        // Node tracking maps
        this.customerNodes = new Map(); // customer -> node reference
        this.messageNodes = new Map(); // message -> node reference
        this.brokerNode = null;
        
        // Performance optimization: cache DOM elements
        this.domElements = this.cacheDOMElements();
        
        // Initialize layout management system
        this.layoutCalculator = new LayoutCalculator(this.domElements.messageFlow);
        
        // Smart cleanup system for element lifecycle management
        this.cleanupManager = new CleanupManager(this.domElements.messageFlow, this.layoutCalculator);
        
        // Initialize all systems
        this.initialize();

        // Set initial visualization mode using ModeSwitchingManager
        // Default to clusters mode
        this.modeSwitchingManager.switchMode('clusters');

        // Start frame rate monitoring
        this.startFrameRateMonitoring();
    }

    calculateScreenDimensions() {
        // Use the message flow container dimensions instead of full window
        const container = this.domElements.messageFlow;
        this.SCREEN_WIDTH = container.clientWidth;
        this.SCREEN_HEIGHT = container.clientHeight;
        this.SCREEN_CENTER_X = this.SCREEN_WIDTH / 2;
        this.SCREEN_CENTER_Y = this.SCREEN_HEIGHT / 2;
    }

    cacheDOMElements() {
        return {
            // Connection elements
            host: document.getElementById('host'),
            port: document.getElementById('port'),
            username: document.getElementById('username'),
            password: document.getElementById('password'),
            connectBtn: document.getElementById('connectBtn'),
            subscribeBtn: document.getElementById('subscribeBtn'),
            topic: document.getElementById('topic'),
            
            // Status elements
            status: document.getElementById('status'),
            connectionStatus: document.getElementById('connectionStatus'),
            liveIndicator: document.getElementById('liveIndicator'),
            brokerUrlDisplay: document.getElementById('brokerUrlDisplay'),
            brokerUrl: document.getElementById('brokerUrl'),
            
            // Stats elements
            totalMessages: document.getElementById('totalMessages'),
            messageRate: document.getElementById('messageRate'),
            activeTopics: document.getElementById('activeTopics'),
            frameRate: document.getElementById('frameRate'),
            activeCards: document.getElementById('activeCards'),
            
            // Visualization elements
            messageFlow: document.getElementById('messageFlow'),
            
            // Visualization mode buttons
            vizIconButtons: document.querySelectorAll('.viz-icon-btn'),
            vizModeButtons: document.querySelectorAll('.viz-mode-btn'),
            
            // Modal elements
            modal: document.getElementById('messageModal'),
            modalClose: document.getElementById('modalClose'),
            modalCustomer: document.getElementById('modalCustomer'),
            modalTopic: document.getElementById('modalTopic'),
            modalTimestamp: document.getElementById('modalTimestamp'),
            modalPayload: document.getElementById('modalPayload'),
            modalQos: document.getElementById('modalQos'),
            modalRetain: document.getElementById('modalRetain'),
            
            // Legend elements
            colorLegend: document.getElementById('colorLegend'),
            legendItems: document.getElementById('legendItems'),
            
            // Stats panel
            statsPanel: document.getElementById('statsPanel'),
            
            // Theme elements
            themeMode: document.getElementById('themeMode'),
            sidebar: document.getElementById('sidebar')
        };
    }

    initialize() {
        this.initializeEventListeners();
        this.initializeSidebarToggle();
        this.initializeVisualizationButtons();
        this.initializeTheme();
        this.initializeModal();
        this.startStatsUpdate();
    }

    initializeEventListeners() {
        // Browser compatibility for passive event listeners
        const passiveOption = this.supportsPassiveListeners ? { passive: false } : false;
        
        // Enter key handlers with cached DOM elements
        this.domElements.host.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) this.toggleConnection();
        }, passiveOption);
        
        this.domElements.topic.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' || e.keyCode === 13) this.subscribeToTopic();
        }, passiveOption);
        
        // Cursor key handlers for controlling bubble direction with better browser compatibility
        document.addEventListener('keydown', (e) => {
            if (this.visualizationMode === 'bubbles') {
                const key = e.key || e.which || e.keyCode;
                let handled = false;
                
                switch(key) {
                    case 'ArrowUp':
                    case 'Up': // IE fallback
                    case 38: // keyCode fallback
                        this.bubbleDirection = { x: 0, y: -1 };
                        handled = true;
                        break;
                    case 'ArrowDown':
                    case 'Down': // IE fallback
                    case 40: // keyCode fallback
                        this.bubbleDirection = { x: 0, y: 1 };
                        handled = true;
                        break;
                    case 'ArrowLeft':
                    case 'Left': // IE fallback
                    case 37: // keyCode fallback
                        this.bubbleDirection = { x: -1, y: 0 };
                        handled = true;
                        break;
                    case 'ArrowRight':
                    case 'Right': // IE fallback
                    case 39: // keyCode fallback
                        this.bubbleDirection = { x: 1, y: 0 };
                        handled = true;
                        break;
                }
                
                if (handled) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            }
        }, passiveOption);
    }

    initializeSidebarToggle() {
        const toggleButton = document.getElementById('sidebarToggle');

        if (toggleButton && this.domElements.sidebar) {
            toggleButton.addEventListener('click', () => {
                this.domElements.sidebar.classList.toggle('collapsed');

                // Update unified container position when sidebar state changes
                if (this.unifiedContainer && this.layoutCalculator) {
                    // Small delay to allow CSS transition to complete
                    setTimeout(() => {
                        this.unifiedContainer.updateDimensions(this.layoutCalculator);

                        // Also update NetworkAnimation dimensions if in network mode
                        if (this.networkAnimation) {
                            this.networkAnimation.updateDimensions();
                        }
                    }, 50);
                }
            });
        }
    }
    
    initializeVisualizationButtons() {
        // Add click handlers for collapsed sidebar visualization icons
        this.domElements.vizIconButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.switchVisualization(mode);
            });
        });
        
        // Add click handlers for expanded sidebar visualization buttons
        this.domElements.vizModeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.switchVisualization(mode);
            });
        });
    }

    initializeTheme() {
        // Load saved theme from localStorage or default to 'default'
        const savedTheme = localStorage.getItem('flowero-theme') || 'default';
        this.applyTheme(savedTheme);
        
        // Set the select dropdown to match
        if (this.domElements.themeMode) {
            this.domElements.themeMode.value = savedTheme;
        }
    }

    switchTheme() {
        const selectedTheme = this.domElements.themeMode.value;
        
        this.applyTheme(selectedTheme);
        
        // Save theme preference
        localStorage.setItem('flowero-theme', selectedTheme);
    }

    applyTheme(theme) {
        const body = document.body;
        
        if (theme === 'default') {
            body.removeAttribute('data-theme');
        } else {
            body.setAttribute('data-theme', theme);
        }
        
        // Refresh topic colors for new theme
        this.refreshTopicColors();
    }

    refreshTopicColors() {
        // Clear existing colors to regenerate with new theme
        this.topicColors.clear();
        this.customerColors.clear();
        
        // If we have active topics, regenerate their colors
        if (this.activeTopics.size > 0) {
            Array.from(this.activeTopics).forEach(topic => {
                this.getTopicColor(topic); // This will generate new colors for the current theme
            });
        }
    }

    initializeModal() {
        const passiveOption = this.supportsPassiveListeners ? { passive: true } : false;
        
        // Close modal when clicking the X button
        this.domElements.modalClose.addEventListener('click', () => {
            this.closeModal();
        }, passiveOption);
        
        // Close modal when clicking outside the modal content
        this.domElements.modal.addEventListener('click', (e) => {
            if (e.target === this.domElements.modal) {
                this.closeModal();
            }
        }, passiveOption);
        
        // Close modal when pressing Escape key with browser compatibility
        document.addEventListener('keydown', (e) => {
            const key = e.key || e.which || e.keyCode;
            if ((key === 'Escape' || key === 'Esc' || key === 27) && 
                this.domElements.modal.style.display === 'block') {
                this.closeModal();
            }
        }, this.supportsPassiveListeners ? { passive: false } : false);
    }

    showMessageModal(messageData) {
        const modalContent = this.domElements.modal.querySelector('.modal-content');
        const customer = this.extractCustomerFromTopic(messageData.topic);
        const color = this.getTopicColor(messageData.topic);
        
        // Style modal to match the card (solid colors, no transparency)
        modalContent.style.background = `linear-gradient(135deg, ${color}, ${color}E6)`;
        modalContent.style.border = `2px solid ${color}`;
        
        // Populate modal fields with all message details using cached elements
        this.domElements.modalCustomer.textContent = customer.toUpperCase();
        this.domElements.modalTopic.textContent = messageData.topic;
        this.domElements.modalTimestamp.textContent = new Date(messageData.timestamp * 1000).toLocaleString();
        this.domElements.modalPayload.textContent = messageData.payload;
        this.domElements.modalQos.textContent = messageData.qos || '0';
        this.domElements.modalRetain.textContent = messageData.retain ? 'Yes' : 'No';
        
        // Show all fields (in case they were hidden before)
        document.querySelector('.modal-field:nth-child(5)').style.display = 'block'; // QoS
        document.querySelector('.modal-field:nth-child(6)').style.display = 'block'; // Retain
        
        // Show modal
        this.domElements.modal.style.display = 'block';
    }

    closeModal() {
        this.domElements.modal.style.display = 'none';
    }

    // WebSocket Management
    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log('Connecting to WebSocket:', wsUrl);
        
        this.websocket = new WebSocket(wsUrl);
        
        this.websocket.onopen = () => {
            console.log('WebSocket connected');
            this.updateConnectionStatus('connecting');
        };
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };
        
        this.websocket.onclose = () => {
            console.log('WebSocket disconnected');
            this.websocket = null;
            if (this.isConnected) {
                this.updateConnectionStatus('disconnected');
                this.isConnected = false;
            }
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('disconnected');
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'status':
                this.handleStatusUpdate(data.data);
                break;
            case 'mqtt_message':
                this.handleMQTTMessage(data.data);
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    handleStatusUpdate(statusData) {
        const status = statusData.status;
        this.updateConnectionStatus(status);
        
        if (status === 'Connected') {
            this.isConnected = true;
            this.domElements.subscribeBtn.disabled = false;
            this.domElements.liveIndicator.style.display = 'flex';
            
            // Show broker URL under Live indicator
            const brokerUrl = `${this.domElements.host.value}:${this.domElements.port.value}`;
            this.domElements.brokerUrl.textContent = brokerUrl;
            this.domElements.brokerUrlDisplay.style.display = 'block';
            
            // Show UI elements when connected
            this.domElements.statsPanel.style.display = 'block';
        } else {
            this.isConnected = false;
            this.domElements.subscribeBtn.disabled = true;
            this.domElements.liveIndicator.style.display = 'none';
            this.domElements.brokerUrlDisplay.style.display = 'none';
        }
    }

    handleMQTTMessage(messageData) {
        //this.messageCount++;
        this.activeTopics.add(messageData.topic);
        
        // Update message history for rate calculation (performance optimization)
        this.updateMessageRate();
        
        // Create visualization based on mode
        this.createVisualization(messageData);
        
        // Update stats (throttled to reduce DOM updates)
        this.updateStats();
    }

    updateMessageRate() {
        const now = Date.now();
        this.messageHistory.push(now);
        
        // Keep only last 60 seconds of messages for rate calculation
        // Use more efficient filtering approach
        const cutoffTime = now - 60000;
        let i = 0;
        while (i < this.messageHistory.length && this.messageHistory[i] < cutoffTime) {
            i++;
        }
        if (i > 0) {
            this.messageHistory.splice(0, i);
        }
        
        this.messageRate = this.messageHistory.length / 60;
    }

    createVisualization(messageData) {
        if (this.visualizationMode === 'network') {
            this.updateNetworkGraph(messageData);
        } else if (this.visualizationMode === 'clusters') {
            this.updateClusters(messageData);
        } else if (this.visualizationMode === 'bubbles') {
            this.updateD3Bubbles(messageData);
        } else if (this.visualizationMode === 'radial') {
            this.createD3RadialBubble(messageData);
        } else if (this.visualizationMode === 'starfield') {
            this.createMessageBubble(messageData);
        }
    }

    // Message Animation - Optimized with object pooling
    createMessageBubble(messageData) {
        const bubble = this.getBubbleFromPool();
        bubble.className = 'message-bubble';
        
        // Get or create color for topic
        const color = this.getTopicColor(messageData.topic);
        
        // Batch style updates to reduce reflows
        const styles = {
            background: `linear-gradient(135deg, ${color}, ${color}E6)`,
            border: `2px solid ${color}`,
            willChange: 'transform, opacity',
            backfaceVisibility: 'hidden',
            transform: 'translateZ(0)'
        };
        
        // Apply mode-specific styling
        if (this.visualizationMode === 'starfield') {
            // For starfield mode, add side-lighting gradient overlay (brightness handled dynamically during animation)
            styles.background = `
                linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 30%, rgba(0,0,0,0.2) 70%, rgba(0,0,0,0.4) 100%),
                linear-gradient(135deg, ${color}, ${color}E6)
            `;
        } else if (this.visualizationMode === 'bubbles' || this.visualizationMode === 'radial') {
            // Start with full brightness, will be smoothly adjusted during animation
            styles.filter = 'brightness(1.0)';
            bubble.dataset.brightness = '1.0'; // Store initial brightness
            
            // Set initial scale based on mode
            if (this.visualizationMode === 'radial') {
                bubble.dataset.scale = '0.3'; // Start small for radial mode
                styles.transform = 'scale(0.3)'; // Apply immediately
            } else {
                bubble.dataset.scale = '1.0'; // Normal scale for bubbles mode
            }
            
            bubble.dataset.createdAt = Date.now().toString(); // Store creation time
        }
        
        Object.assign(bubble.style, styles);
        
        // Create message content with template for better performance
        const customer = this.extractCustomerFromTopic(messageData.topic);
        const template = document.createElement('template');
        template.innerHTML = `
            <div class="message-customer">${customer}</div>
            <div class="message-topic">${messageData.topic}</div>
            <div class="message-time">${this.formatTime(messageData.timestamp)}</div>
        `;
        
        bubble.appendChild(template.content);
        
        // Add click event listener to show modal
        bubble.addEventListener('click', () => {
            this.showMessageModal(messageData);
        });
        
        // Calculate positioning based on visualization mode
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        let startX, startY;
        
        if (this.visualizationMode === 'radial') {
            // Radial mode: start at center of screen
            startX = flowWidth / 2;
            startY = flowHeight / 2;
        } else if (this.visualizationMode === 'starfield') {
            // Starfield mode: start all cards at exact center
            startX = flowWidth / 2;
            startY = flowHeight / 2;
        } else {
            // Default bubbles mode: start from opposite side of movement direction
            const safeCardWidth = 600; // Use CSS max-width value (increased by 50%)
            const margin = 20;
            
            if (this.bubbleDirection.y === -1) {
                // Moving up: start from bottom
                startX = margin + Math.random() * (flowWidth - safeCardWidth - 2 * margin);
                startY = flowHeight + 100;
            } else if (this.bubbleDirection.y === 1) {
                // Moving down: start from top
                startX = margin + Math.random() * (flowWidth - safeCardWidth - 2 * margin);
                startY = -100;
            } else if (this.bubbleDirection.x === -1) {
                // Moving left: start from right
                startX = flowWidth + 100;
                startY = margin + Math.random() * (flowHeight - 2 * margin);
            } else if (this.bubbleDirection.x === 1) {
                // Moving right: start from left
                startX = -safeCardWidth - 100;
                startY = margin + Math.random() * (flowHeight - 2 * margin);
            }
        }
        
        if (this.visualizationMode === 'radial') {
            // For radial mode, set initial position and let animateMessage handle transitions
            bubble.style.transition = 'none';
            bubble.style.left = `${startX}px`;
            bubble.style.top = `${startY}px`;
            bubble.style.opacity = '1';
            bubble.style.transform = 'scale(1)';
        } else if (this.visualizationMode === 'starfield') {
            // For starfield mode, start small and transparent
            bubble.style.transition = 'none';
            bubble.style.left = `${startX}px`;
            bubble.style.top = `${startY}px`;
            bubble.style.opacity = '0.1';
            bubble.style.transform = 'scale(0.3)';
        } else {
            // For bubbles mode, disable transitions for manual animation
            bubble.style.transition = 'none';
            bubble.style.left = `${startX}px`;
            bubble.style.top = `${startY}px`;
        }
        
        // Set z-index for depth layering (newer cards behind older ones)
        bubble.style.zIndex = this.messageZIndex;
        this.getNextZIndex(); // Update messageZIndex with bounds checking
        
        // Add to DOM with position already set
        this.domElements.messageFlow.appendChild(bubble);
        
        // Start animation from the already-set position
        this.animateMessage(bubble, startX, startY);
        
        // Store bubble reference for cleanup
        const bubbleId = Date.now() + Math.random();
        this.activeAnimations.set(bubbleId, bubble);
        
        // Cards will be removed by their individual animation logic when off-screen or fully transparent
    }

    animateMessage(bubble, startX, startY) {
        const duration = 20000; // 20 seconds to cross screen

        if (this.visualizationMode === 'radial') {
            // No concurrent animation limit - test unlimited performance
            this.activeRadialAnimations++;
            
            // Manual radial animation with random angles
            const startTime = Date.now();
            const angle = Math.random() * 2 * Math.PI;
            const maxDistance = 600;
            const targetX = startX + Math.cos(angle) * maxDistance;
            const targetY = startY + Math.sin(angle) * maxDistance;
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Animate straight outward in assigned direction
                const currentX = startX + (targetX - startX) * progress;
                const currentY = startY + (targetY - startY) * progress;
                
                // Calculate scaling based on progress (start small, grow larger)
                const minScale = 0.3;
                const maxScale = 1.5;
                const scale = minScale + (progress * (maxScale - minScale));
                
                // Calculate fade based on progress
                const fadeStartPoint = 0.2;
                const opacity = progress < fadeStartPoint ? 1 : 
                    Math.max(0, 1 - (progress - fadeStartPoint) / (1 - fadeStartPoint));
                
                bubble.style.left = `${currentX}px`;
                bubble.style.top = `${currentY}px`;
                bubble.style.opacity = opacity;
                bubble.style.transform = `scale(${scale})`;

                // Check if bubble is off screen with buffer
                const flowWidth = this.domElements.messageFlow.clientWidth;
                const flowHeight = this.domElements.messageFlow.clientHeight;
                const buffer = 300; // Large buffer to ensure complete removal
                const isOffScreen = (currentX < -buffer || currentX > flowWidth + buffer ||
                                   currentY < -buffer || currentY > flowHeight + buffer);

                if (progress < 1 && opacity > 0 && !isOffScreen && bubble.parentNode) {
                    requestAnimationFrame(animate);
                } else if (bubble.parentNode) {
                    // Remove card when animation completes, becomes fully transparent, or goes off screen
                    bubble.parentNode.removeChild(bubble);
                    this.returnBubbleToPool(bubble);
                    this.activeRadialAnimations--;
                }
            };
            
            animate();
        } else if (this.visualizationMode === 'starfield') {
            // Starfield animation: simple distance-based physics
            // Use the same center calculation as initial positioning
            const centerX = startX;
            const centerY = startY;
            
            // Generate random direction
            const angle = Math.random() * 2 * Math.PI;
            const directionX = Math.cos(angle);
            const directionY = Math.sin(angle);
            
            // Animation state
            let currentDistance = 0; // Start at center (distance = 0)
            // Calculate dynamic max distance based on window size
            const flowWidth = this.domElements.messageFlow.clientWidth;
            const flowHeight = this.domElements.messageFlow.clientHeight;
            // Distance from center to corner of screen (this is the furthest any card needs to travel)
            const maxScreenDistance = Math.sqrt((flowWidth/2) * (flowWidth/2) + (flowHeight/2) * (flowHeight/2));
            // Add buffer to account for card size and ensure cards move completely off screen
            // Cards can be up to 400px wide and grow up to 8x scale, so need significant buffer
            const cardMaxSize = 600 * 8; // max card width * max scale (increased by 50%)
            const buffer = cardMaxSize / 2; // Half the max card size should be enough
            const maxDistance = maxScreenDistance + buffer + 200;
            const startTime = Date.now();
            const maxDuration = 15000; // 10 second timeout (slower velocity)

            const animate = () => {
                const elapsed = Date.now() - startTime;
                
                // Calculate distance from center with acceleration (quadratic growth for starfield effect)
                const timeRatio = Math.min(elapsed / maxDuration, 1);

                const intensity = 8; // Higher = more dramatic
                currentDistance = (Math.pow(timeRatio, intensity)) * maxDistance;

                // Position based on distance and direction
                const currentX = centerX + (directionX * currentDistance);
                const currentY = centerY + (directionY * currentDistance);
                
                // Size based on distance (further = bigger)
                const minScale = 0.3;
                const maxScale = 10.0;
                const distanceRatio = Math.min(currentDistance / maxDistance, 1);
                const scale = minScale + (distanceRatio * distanceRatio * (maxScale - minScale));
                
                // Opacity: fade in quickly during first part of animation
                let opacity;
                if (distanceRatio < 0.02) {
                    opacity = distanceRatio * 50; // Very quick fade in (2% of journey)
                } else {
                    opacity = 1; // Stay fully visible for the rest of the journey
                }
                
                // Brightness: related to distance and size - darker at center, brighter at edge
                const minBrightness = 0.6; // Dark at center (60% brightness)
                const maxBrightness = 1.0; // Full brightness at edge
                const brightness = minBrightness + (distanceRatio * (maxBrightness - minBrightness));
                
                // Update DOM
                bubble.style.left = `${currentX}px`;
                bubble.style.top = `${currentY}px`;
                bubble.style.transform = `scale(${scale})`;
                bubble.style.opacity = opacity;
                bubble.style.filter = `brightness(${brightness})`;
                
                // Check if card should be removed (off screen or timeout)
                const flowWidth = this.domElements.messageFlow.clientWidth;
                const flowHeight = this.domElements.messageFlow.clientHeight;
                const buffer = 2000; // Use larger fixed buffer instead of calculated one
                const isOffScreen = (currentX < -buffer || currentX > flowWidth + buffer || 
                                   currentY < -buffer || currentY > flowHeight + buffer);
                
                if (elapsed < maxDuration && !isOffScreen && bubble.parentNode) {
                    requestAnimationFrame(animate);
                } else if (bubble.parentNode) {
                    // Remove card when off screen or timeout reached
                    bubble.parentNode.removeChild(bubble);
                }
            };
            
            animate();
        } else {
            // Default bubbles animation: directional movement controlled by cursor keys
            const startTime = Date.now();
            const flowWidth = this.domElements.messageFlow.clientWidth;
            const flowHeight = this.domElements.messageFlow.clientHeight;
            // Calculate dynamic travel distance based on screen size and direction
            const buffer = 500;
            let targetX, targetY;
            
            if (this.bubbleDirection.x !== 0) {
                // Horizontal movement: travel across full width plus buffer
                const travelDistance = flowWidth + buffer * 2;
                targetX = startX + (this.bubbleDirection.x * travelDistance);
                targetY = startY; // No vertical movement
            } else {
                // Vertical movement: travel across full height plus buffer
                const travelDistance = flowHeight + buffer * 2;
                targetX = startX; // No horizontal movement
                targetY = startY + (this.bubbleDirection.y * travelDistance);
            }
            
            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Animate in the controlled direction
                const currentX = startX + (targetX - startX) * progress;
                const currentY = startY + (targetY - startY) * progress;
                
                bubble.style.left = `${currentX}px`;
                bubble.style.top = `${currentY}px`;
                
                // Check if off screen with larger buffer to let boxes fully exit
                const buffer = 500;
                const isOffScreen = (currentX < -buffer || currentX > flowWidth + buffer || 
                                   currentY < -buffer || currentY > flowHeight + buffer);
                
                if (progress < 1 && !isOffScreen && bubble.parentNode) {
                    requestAnimationFrame(animate);
                } else if (bubble.parentNode) {
                    // Remove card when animation completes or goes off screen
                    bubble.parentNode.removeChild(bubble);
                    this.returnBubbleToPool(bubble);
                }
            };
            
            animate();
        }
    }

    // Network Graph Implementation - Updated for unified architecture
    updateNetworkGraph(messageData) {
        // Ensure network animation is initialized
        if (!this.networkAnimation) {
            console.warn('NetworkAnimation not initialized for network mode');
            return;
        }

        const customer = this.extractCustomerFromTopic(messageData.topic);
        const customerColor = this.getCustomerColor(customer);
        const topicColor = this.getTopicColor(messageData.topic);

        // Process message through NetworkAnimation
        const { customerNode, topicNode } = this.networkAnimation.processMessage(messageData, customerColor, topicColor);

        // Create pulse animation from broker to customer to topic
        if (customerNode && topicNode) {
            // Pulse from broker to customer
            this.networkAnimation.createPulse('broker', customer);

            // Delay pulse from customer to topic
            setTimeout(() => {
                this.networkAnimation.createPulse(customer, topicNode.id);
            }, 400);
        }

        console.log(`NetworkAnimation: Processed message for ${customer}`);
    }

    // Clusters Implementation - Process messages through ClustersAnimation
    updateClusters(messageData) {
        console.log('updateClusters called with:', messageData);

        // Ensure clusters animation is initialized
        if (!this.clustersAnimation) {
            console.warn('ClustersAnimation not initialized for clusters mode');
            return;
        }

        const customer = this.extractCustomerFromTopic(messageData.topic);
        const customerColor = this.getCustomerColor(customer);
        const topicColor = this.getTopicColor(messageData.topic);

        console.log(`Processing cluster message for customer: ${customer}, color: ${customerColor}`);

        // Process message through ClustersAnimation - use customer color for all devices in cluster
        const node = this.clustersAnimation.processMessage(messageData, customerColor, customerColor);

        console.log(`ClustersAnimation: Processed message for ${customer}, node:`, node);
    }

    // Initialize network mode (wrapper for D3 network initialization)
    initializeNetworkMode() {
        console.log('MQTTVisualizer: Initializing network mode');
        this.initializeD3Network();
        console.log('MQTTVisualizer: Network mode initialization complete');
    }

    initializeD3Network() {
        // Clear existing content but preserve UI elements
        const existingSvg = this.domElements.messageFlow.querySelector('#d3-network');
        if (existingSvg) {
            existingSvg.remove();
        }
        
        // Remove any message bubbles
        const bubbles = this.domElements.messageFlow.querySelectorAll('.message-bubble');
        bubbles.forEach(bubble => bubble.remove());
        
        // Get full viewport dimensions for responsive full-screen layout
        const container = this.domElements.messageFlow;
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Create D3 SVG with full viewport coverage
        this.d3Svg = d3.select(container)
            .append('svg')
            .attr('id', 'd3-network')
            .attr('width', width)
            .attr('height', height)
            .style('position', 'fixed') // Fixed positioning for full screen
            .style('top', '0')
            .style('left', '0')
            .style('width', '100vw')
            .style('height', '100vh')
            .style('z-index', '1');
        
        // Add filters
        const defs = this.d3Svg.append('defs');
        
        // Glow filter
        const glowFilter = defs.append('filter')
            .attr('id', 'glow');
        glowFilter.append('feGaussianBlur')
            .attr('stdDeviation', '3')
            .attr('result', 'coloredBlur');
        const merge = glowFilter.append('feMerge');
        merge.append('feMergeNode').attr('in', 'coloredBlur');
        merge.append('feMergeNode').attr('in', 'SourceGraphic');
        
        // Text shadow filter
        const shadowFilter = defs.append('filter')
            .attr('id', 'textShadow')
            .attr('x', '-50%')
            .attr('y', '-50%')
            .attr('width', '300%')
            .attr('height', '300%');
        shadowFilter.append('feDropShadow')
            .attr('dx', '2.5')      // 2 * 1.25 = 2.5
            .attr('dy', '2.5')      // 2 * 1.25 = 2.5  
            .attr('stdDeviation', '4') // 3 * 1.25 = 3.75 → 4
            .attr('flood-color', 'rgba(0,0,0,0.9)')
            .attr('flood-opacity', '1');
        
        // Create containers for different elements
        this.d3Container = {
            links: this.d3Svg.append('g').attr('class', 'links'),
            nodes: this.d3Svg.append('g').attr('class', 'nodes'),
            labels: this.d3Svg.append('g').attr('class', 'labels'),
            pulses: this.d3Svg.append('g').attr('class', 'pulses')
        };
        
        // Initialize with broker node
        this.createBrokerNode();
        
        // Create D3 force simulation with smoother movement (less jittery)
        this.d3Simulation = d3.forceSimulation(this.d3Nodes)
            .velocityDecay(0.75) // Increased friction/damping (0.6 + 25% = 0.75)
            .alphaDecay(0.01) // Slower cooling (default 0.0228, lower = slower settling)
            .alphaMin(0.001) // Lower minimum alpha for smoother movement
            .force('link', d3.forceLink(this.d3Links)
                .id(d => d.id)
                .distance(d => d.distance || 250)
                .strength(0.2)) // Further reduced for smoother movement
            .force('charge', d3.forceManyBody()
                .strength(-800) // Reduced repulsion for less aggressive movement
                .distanceMax(400))
            .force('center', d3.forceCenter(width / 2, height / 2)
                .strength(0.05)) // Much weaker centering force
            .force('collision', d3.forceCollide()
                .radius(d => d.radius + 25) // Slightly reduced collision radius
                .strength(0.3)) // Further reduced collision strength to allow boundary force priority
            .force('boundary', this.createBoundaryForce(width, height)) // Applied last to override other forces
            .on('tick', () => this.onSimulationTick());
        
        // Setup resize handling
        this.setupNetworkResizeHandling();
        
        // Start brightness decay system
        this.startBrightnessDecay();
    }
    
    createBrokerNode() {
        const flowWidth = window.innerWidth;
        const flowHeight = window.innerHeight;
        
        // Get broker URL from the display element and remove port
        const fullBrokerUrl = this.domElements.brokerUrl.textContent || 'BROKER';
        const brokerUrl = fullBrokerUrl.split(':')[0]; // Remove port, keep only host
        
        // Create broker node data for D3
        const brokerNode = {
            id: 'broker',
            type: 'broker',
            x: this.SCREEN_CENTER_X,
            y: this.SCREEN_CENTER_Y,
            fx: this.SCREEN_CENTER_X, // Fix position
            fy: this.SCREEN_CENTER_Y, // Fix position
            radius: 60,
            baseRadius: 60, // Store original radius
            color: '#4CAF50',
            label: brokerUrl,
            brightness: 1.0, // Broker stays at full brightness
            sizeScale: 1.0 // Broker stays at full size
        };
        
        // Add to D3 nodes array
        this.d3Nodes.push(brokerNode);
    }
    
    createBoundaryForce(width, height) {
        // Create strong boundary force to keep nodes within viewport - applied after other forces
        return (alpha) => {
            this.d3Nodes.forEach(node => {
                // Skip broker node (it's fixed in center)
                if (node.type === 'broker') return;
                
                // Calculate dynamic padding based on node radius plus extra margin
                const nodeRadius = node.radius || 20;
                const padding = nodeRadius + 30; // Node radius plus 30px margin
                
                // Apply strong boundary constraints that override collision forces
                // Use exponential force that gets stronger near boundaries
                if (node.x < padding) {
                    const penetration = padding - node.x;
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7); // 0.1 to 0.8
                    node.vx += penetration * alpha * forceStrength;
                    // Hard constraint: never allow position beyond boundary
                    node.x = Math.max(padding, node.x);
                }
                if (node.x > width - padding) {
                    const penetration = node.x - (width - padding);
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vx -= penetration * alpha * forceStrength;
                    // Hard constraint: never allow position beyond boundary
                    node.x = Math.min(width - padding, node.x);
                }
                if (node.y < padding) {
                    const penetration = padding - node.y;
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vy += penetration * alpha * forceStrength;
                    // Hard constraint: never allow position beyond boundary
                    node.y = Math.max(padding, node.y);
                }
                if (node.y > height - padding) {
                    const penetration = node.y - (height - padding);
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vy -= penetration * alpha * forceStrength;
                    // Hard constraint: never allow position beyond boundary
                    node.y = Math.min(height - padding, node.y);
                }
            });
        };
    }
    
    addNetworkMessage(customer, topic, messageData) {
        const color = this.getCustomerColor(customer);
        
        // Find or create customer node
        let customerNode = this.d3Nodes.find(n => n.id === customer);
        if (!customerNode) {
            customerNode = {
                id: customer,
                type: 'customer',
                radius: 45,
                baseRadius: 45, // Store original radius
                color: color,
                label: customer,
                messageCount: 0,
                brightness: 1.0, // Start at full brightness
                sizeScale: 1.0 // Start at full size
            };
            this.d3Nodes.push(customerNode);
            
            // Create link from broker to customer
            this.d3Links.push({
                source: 'broker',
                target: customer,
                distance: 250 // Increased for longer lines
            });
        }
        
        // Update customer node activity, brightness and size
        customerNode.messageCount++;
        customerNode.lastActivity = Date.now();
        customerNode.brightness = 1.0; // Full brightness on new message
        customerNode.sizeScale = 1.0; // Full size on new message
        customerNode.radius = customerNode.baseRadius * customerNode.sizeScale; // Update radius immediately
        
        // Find or create topic node (one per unique device, not per topic)
        const deviceId = this.extractDeviceFromTopic(topic);
        const topicNodeId = `${customer}-${deviceId}`;
        let topicNode = this.d3Nodes.find(n => n.id === topicNodeId);
        if (!topicNode) {
            topicNode = {
                id: topicNodeId,
                type: 'topic',
                radius: 18,
                baseRadius: 18, // Store original radius
                color: this.getTopicColor(topic),
                label: this.createTopicLabel(topic),
                customer: customer,
                deviceId: deviceId, // Store device ID for grouping
                topics: new Set([topic]), // Track all topics for this device
                messageCount: 0,
                lastActivity: Date.now(),
                brightness: 1.0, // Start at full brightness
                sizeScale: 1.0 // Start at full size
            };
            this.d3Nodes.push(topicNode);
            
            // Create link from customer to topic
            this.d3Links.push({
                source: customer,
                target: topicNodeId,
                distance: 120 // Increased from 80 for longer lines
            });
        }
        
        // Update topic node activity, brightness and size (don't create new nodes, just update existing)
        // Add this topic to the set of topics handled by this device node
        topicNode.topics.add(topic);
        topicNode.messageCount++;
        topicNode.lastActivity = Date.now();
        topicNode.brightness = 1.0; // Full brightness on new message
        topicNode.sizeScale = 1.0; // Full size on new message
        topicNode.radius = topicNode.baseRadius * topicNode.sizeScale; // Update radius immediately
        
        // Clean up old topic nodes that haven't received messages recently
        this.cleanupOldTopics();
        
        // Immediately update visual properties for instant brightness/size reset
        this.updateNodeVisualProperties();
    }
    
    startBrightnessDecay() {
        // Update brightness 10x per second for smoother transitions
        this.brightnessInterval = setInterval(() => {
            this.updateNodeBrightness();
            this.updateMessageBubbleBrightness();
        }, 100);
    }
    
    updateNodeBrightness() {
        const now = Date.now();
        const decayRate = 0.005; // Decreases by 0.5% per update (5% per second at 10Hz)
        const minBrightness = 0.3; // Minimum 30% brightness
        const minSizeScale = 0.5; // Minimum 50% size
        
        let updated = false;
        
        this.d3Nodes.forEach(node => {
            // Skip broker node - it stays at full brightness and size
            if (node.type === 'broker') return;
            
            // Calculate time since last activity (in 0.1 second units for smoother updates)
            const timeSinceActivity = (now - node.lastActivity) / 100;
            
            // Decay brightness and size over time (start after 10 updates = 1 second)
            if (timeSinceActivity > 10) {
                const newBrightness = Math.max(minBrightness, 1.0 - ((timeSinceActivity - 10) * decayRate));
                const newSizeScale = Math.max(minSizeScale, 1.0 - ((timeSinceActivity - 10) * decayRate));

                // Use smaller threshold for smoother interpolation
                if (Math.abs(node.brightness - newBrightness) > 0.005) {
                    node.brightness = newBrightness;
                    updated = true;
                }
                
                if (Math.abs(node.sizeScale - newSizeScale) > 0.005) {
                    node.sizeScale = newSizeScale;
                    // Update actual radius used by simulation
                    node.radius = node.baseRadius * newSizeScale;
                    updated = true;
                }
            }
        });
        
        // Update visual elements if brightness or size changed
        if (updated) {
            this.updateNodeVisualProperties();
        }
    }
    
    updateNodeVisualProperties() {
        // Update visual brightness and size of nodes
        this.d3Container.nodes.selectAll('g.node circle')
            .style('opacity', d => d.brightness)
            .attr('r', d => d.radius); // Update radius
            
        this.d3Container.nodes.selectAll('g.node text')
            .style('opacity', d => d.brightness * 0.9); // Text slightly dimmer
    }
    
    updateMessageBubbleBrightness() {
        // Update brightness and smooth scaling for message bubbles in bubbles and radial modes
        if (this.visualizationMode !== 'bubbles' && this.visualizationMode !== 'radial') {
            return;
        }
        
        const now = Date.now();
        const bubbles = this.domElements.messageFlow.querySelectorAll('.message-bubble[data-brightness]');
        
        bubbles.forEach(bubble => {
            const createdAt = parseInt(bubble.dataset.createdAt || '0');
            const currentBrightness = parseFloat(bubble.dataset.brightness || '1.0');
            const currentScale = parseFloat(bubble.dataset.scale || '1.0');
            
            // Calculate age in seconds
            const ageInSeconds = (now - createdAt) / 1000;
            
            // Gradually decrease brightness after 2 seconds
            let targetBrightness = 1.0;
            if (ageInSeconds > 2) {
                // Decrease brightness by 40% over 10 seconds, minimum 60%
                const decayProgress = Math.min((ageInSeconds - 2) / 10, 1);
                targetBrightness = Math.max(0.6, 1.0 - (decayProgress * 0.4));
            }
            
            // For radial mode, gradually increase scale based on age
            let targetScale = 0.3;
            if (this.visualizationMode === 'radial' && ageInSeconds > 0.5) {
                // Gradually increase scale from 0.3 to 1.5 over 8 seconds
                const scaleProgress = Math.min((ageInSeconds - 0.5) / 8, 1);
                targetScale = 0.3 + (scaleProgress * 1.2); // 0.3 + 1.2 = 1.5 maximum
            }
            
            // Smooth interpolation (move 15% towards target each update for smoother transitions)
            const newBrightness = currentBrightness + (targetBrightness - currentBrightness) * 0.15;
            const newScale = currentScale + (targetScale - currentScale) * 0.15;
            
            // Update brightness if change is significant enough
            if (Math.abs(newBrightness - currentBrightness) > 0.01) {
                bubble.dataset.brightness = newBrightness.toFixed(3);
                bubble.style.filter = `brightness(${newBrightness})`;
            }
            
            // Update scale if change is significant enough
            if (Math.abs(newScale - currentScale) > 0.01) {
                bubble.dataset.scale = newScale.toFixed(3);
                bubble.style.transform = `scale(${newScale})`;
            }
        });
    }
    
    updateD3Simulation() {
        if (!this.d3Simulation) return;
        
        // Update simulation with new data
        this.d3Simulation.nodes(this.d3Nodes);
        this.d3Simulation.force('link').links(this.d3Links);
        
        // Restart simulation
        this.d3Simulation.alpha(0.3).restart();
        
        // Update visual elements
        this.updateD3Visuals();
    }
    
    onSimulationTick() {
        // Enforce hard boundary constraints before updating visuals
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.d3Nodes.forEach(node => {
            if (node.type === 'broker') return; // Skip broker (fixed in center)
            
            const nodeRadius = node.radius || 20;
            const padding = nodeRadius + 30;
            
            // Hard boundary enforcement - never allow nodes to go off screen
            node.x = Math.max(padding, Math.min(width - padding, node.x));
            node.y = Math.max(padding, Math.min(height - padding, node.y));
        });
        
        // Update node positions
        const nodeGroups = this.d3Container.nodes.selectAll('g.node')
            .data(this.d3Nodes, d => d.id);
        
        nodeGroups.select('circle')
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
            
        const textElements = nodeGroups.select('text')
            .attr('x', d => d.x)
            .attr('y', d => d.y + d.radius + 25); // Position below circle: radius + 25px margin
            
        // Update tspan positions to match their parent node
        textElements.selectAll('tspan')
            .attr('x', function() {
                const parentNode = d3.select(this.parentNode).datum();
                return parentNode.x;
            });
        
        // Update link positions
        this.d3Container.links.selectAll('line')
            .data(this.d3Links)
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);
    }
    
    updateD3Visuals() {
        // Update nodes
        const nodeGroups = this.d3Container.nodes.selectAll('g.node')
            .data(this.d3Nodes, d => d.id);
        
        // Enter new nodes
        const nodeEnter = nodeGroups.enter()
            .append('g')
            .attr('class', 'node')
            .attr('id', d => `node-${d.id}`);
        
        // Add circles with initial positions, brightness and size
        nodeEnter.append('circle')
            .attr('r', d => d.radius) // Uses current radius (baseRadius * sizeScale)
            .attr('cx', d => {
                // Only use broker center positioning for network graph mode
                if (this.visualizationMode === 'network') {
                    // Start new nodes at broker center if not positioned
                    if (d.x !== undefined && d.x !== null) return d.x;
                    const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
                    return brokerNode ? brokerNode.x : this.SCREEN_CENTER_X;
                }
                return d.x || 0;
            })
            .attr('cy', d => {
                // Only use broker center positioning for network graph mode
                if (this.visualizationMode === 'network') {
                    // Start new nodes at broker center if not positioned
                    if (d.y !== undefined && d.y !== null) return d.y;
                    const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
                    return brokerNode ? brokerNode.y : this.SCREEN_CENTER_Y;
                }
                return d.y || 0;
            })
            .attr('fill', d => d.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', d => d.type === 'broker' ? 3 : 2)
            .attr('filter', 'url(#glow)')
            .style('opacity', d => d.brightness || 1.0);
        
        // Add labels with initial positions and brightness
        const textElements = nodeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('x', d => {
                // Only use broker center positioning for network graph mode
                if (this.visualizationMode === 'network') {
                    // Start new node labels at broker center if not positioned
                    if (d.x !== undefined && d.x !== null) return d.x;
                    const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
                    return brokerNode ? brokerNode.x : this.SCREEN_CENTER_X;
                }
                return d.x || 0;
            })
            .attr('y', d => {
                // Only use broker center positioning for network graph mode
                let baseY;
                if (this.visualizationMode === 'network') {
                    if (d.y !== undefined && d.y !== null) {
                        baseY = d.y;
                    } else {
                        const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
                        baseY = brokerNode ? brokerNode.y : this.SCREEN_CENTER_Y;
                    }
                } else {
                    baseY = d.y || 0;
                }
                return baseY + (d.radius || 20) + 25; // Position below circle: radius + 25px margin
            })
            .attr('fill', 'white')
            .attr('font-size', d => {
                if (d.type === 'broker') return '23px';  // 15px * 1.5 = 22.5px → 23px
                if (d.type === 'customer') return '20px';  // 13px * 1.5 = 19.5px → 20px
                if (d.type === 'topic') return '15px';     // 10px * 1.5 = 15px
                return '7px';
            })
            .attr('font-weight', d => d.type === 'broker' ? 'bold' : 'normal')
            .attr('filter', 'url(#textShadow)')
            .style('opacity', d => (d.brightness || 1.0) * 0.9);
        
        // Handle multi-line labels with tspan elements
        textElements.each(function(d) {
            const textElement = d3.select(this);
            const lines = d.label.split('\n');
            const lineHeight = d.type === 'topic' ? 16 : 20; // Adjust line height based on node type
            
            lines.forEach((line, index) => {
                textElement.append('tspan')
                    .attr('x', 0) // Use relative positioning, parent text element handles absolute position
                    .attr('dy', index === 0 ? 0 : lineHeight)
                    .text(line);
            });
        });
        
        // Remove old nodes
        nodeGroups.exit().remove();
        
        // Update links
        const linkSelection = this.d3Container.links.selectAll('line')
            .data(this.d3Links);
        
        // Enter new links
        linkSelection.enter()
            .append('line')
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('stroke-opacity', 0.6);
        
        // Remove old links
        linkSelection.exit().remove();
    }
    
    createD3Pulse(customer, topic) {
        // Create pulse animation from broker to customer to topic
        const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
        const customerNode = this.d3Nodes.find(n => n.id === customer);
        const deviceId = this.extractDeviceFromTopic(topic);
        const topicNodeId = `${customer}-${deviceId}`;
        const topicNode = this.d3Nodes.find(n => n.id === topicNodeId);
        
        if (!brokerNode || !customerNode) return;
        
        // Ensure broker is at screen center if not positioned
        if (!brokerNode.x || !brokerNode.y || (brokerNode.x === 0 && brokerNode.y === 0)) {
            brokerNode.x = brokerNode.fx || this.SCREEN_CENTER_X;
            brokerNode.y = brokerNode.fy || this.SCREEN_CENTER_Y;
        }
        
        // Create pulse circle
        const pulse = this.d3Container.pulses.append('circle')
            .attr('r', 6)  // 4 * 1.5 = 6
            .attr('fill', customerNode.color)
            .attr('cx', brokerNode.x)
            .attr('cy', brokerNode.y)
            .attr('opacity', 0.8);
        
        // Animate from broker to customer
        pulse.transition()
            .duration(800)
            .attr('cx', customerNode.x)
            .attr('cy', customerNode.y)
            .on('end', () => {
                if (topicNode) {
                    // Continue pulse to topic node
                    pulse.transition()
                        .duration(400)
                        .attr('cx', topicNode.x)
                        .attr('cy', topicNode.y)
                        .attr('opacity', 0)
                        .remove();
                } else {
                    // Topic node doesn't exist yet, just fade out at customer
                    pulse.transition()
                        .duration(200)
                        .attr('opacity', 0)
                        .remove();
                }
            });
    }
    
    cleanupOldTopics() {
        const maxAge = 300000; // 5 minutes - much longer to keep topics visible
        const now = Date.now();
        
        // Find old topic nodes that haven't received messages recently
        const oldTopics = this.d3Nodes.filter(n => 
            n.type === 'topic' && (now - n.lastActivity) > maxAge
        );
        
        // Remove old topics and their links
        oldTopics.forEach(topicNode => {
            console.log('Removing old topic node:', topicNode.id);
            
            // Remove from nodes array
            const nodeIndex = this.d3Nodes.findIndex(n => n.id === topicNode.id);
            if (nodeIndex !== -1) {
                this.d3Nodes.splice(nodeIndex, 1);
            }
            
            // Remove associated links (D3 converts source/target to objects after simulation starts)
            this.d3Links = this.d3Links.filter(link => {
                const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
                const targetId = typeof link.target === 'object' ? link.target.id : link.target;
                const shouldKeep = sourceId !== topicNode.id && targetId !== topicNode.id;
                if (!shouldKeep) {
                    console.log('Removing link:', sourceId, '->', targetId);
                }
                return shouldKeep;
            });
        });
        
        // If we removed any topics, update the simulation
        if (oldTopics.length > 0) {
            this.updateD3Simulation();
        }
    }
    
    // Legacy method - no longer used with D3.js implementation
    updateCustomerNode(customer, messageData) {
        // This method is no longer used - functionality moved to addNetworkMessage()
        return;
        
        if (!this.networkNodes.has(customer)) {
            // Create new customer node with proper radial positioning
            const nodeCount = this.networkNodes.size;
            const angle = (nodeCount * 2 * Math.PI) / Math.max(1, nodeCount + 1);
            const flowWidth = this.domElements.messageFlow.clientWidth;
            const flowHeight = this.domElements.messageFlow.clientHeight;
            // Scale distance based on screen size - reduced for shorter lines
            const distance = Math.min(flowWidth, flowHeight) * 0.35;
            
            const node = {
                x: this.brokerNode.x + Math.cos(angle) * distance,
                y: this.brokerNode.y + Math.sin(angle) * distance,
                radius: 45, // Scaled up for full screen (increased by 50%)
                color: color,
                customer: customer,
                messageCount: 0,
                lastActivity: Date.now(),
                element: null,
                topics: new Set(),
                targetX: this.brokerNode.x + Math.cos(angle) * distance,
                targetY: this.brokerNode.y + Math.sin(angle) * distance
            };
            
            this.createCustomerNodeElement(node);
            this.networkNodes.set(customer, node);
            
            // Create connection to broker
            this.createConnection(this.brokerNode, node, color);
            
            // Redistribute all customer nodes for even spacing
            this.redistributeCustomerNodes();
        }
        
        // Update activity
        const node = this.networkNodes.get(customer);
        node.messageCount++;
        node.lastActivity = Date.now();
        node.topics.add(messageData.topic);
    }
    
    createMessageCircle(messageData) {
        const customer = this.extractCustomerFromTopic(messageData.topic);
        const customerNode = this.networkNodes.get(customer);
        
        if (!customerNode) {
            console.log('No customer node found for:', customer);
            return;
        }
        
        const topic = messageData.topic;
        const messageId = `${customer}-${topic}-${Date.now()}`;
        
        // Get or create topic ring for this customer
        if (!customerNode.topicRings) {
            customerNode.topicRings = new Map();
        }
        
        let topicRing = customerNode.topicRings.get(topic);
        if (!topicRing) {
            // Create new ring for this topic
            const ringIndex = customerNode.topicRings.size;
            topicRing = {
                topic: topic,
                distance: 80 + (ringIndex * 50), // Each topic gets its own ring - scaled up
                messages: [],
                color: this.getTopicColor(topic)
            };
            customerNode.topicRings.set(topic, topicRing);
            console.log(`Created new topic ring for ${topic} at distance ${topicRing.distance}`);
        }
        
        // Create message circle
        const messageCircle = this.createMessageCircleElement(messageData, customerNode, topicRing);
        
        // Add to topic ring
        topicRing.messages.push(messageCircle);
        
        // Store the message circle for tracking
        this.networkMessages.set(`${customer}-${topic}-${messageCircle.createdAt}`, messageCircle);
        
        // Position circle in the ring
        this.positionMessageInRing(customerNode, topicRing);
        
        console.log(`Total message circles for ${customer}: ${topicRing.messages.length}`);
        
        // Remove old messages if too many (keep last 8 per topic)
        if (topicRing.messages.length > 8) {
            const oldMessage = topicRing.messages.shift();
            if (oldMessage.element && oldMessage.element.parentNode) {
                oldMessage.element.parentNode.removeChild(oldMessage.element);
                // Remove from network messages tracking
                this.networkMessages.forEach((msg, key) => {
                    if (msg === oldMessage) {
                        this.networkMessages.delete(key);
                    }
                });
                console.log('Removed old message circle'); // Debug log
            }
        }
    }
    
    createMessageCircleElement(messageData, customerNode, topicRing) {
        // Create circle directly (no group wrapper for simplicity)
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.className = 'message-circle';
        circle.setAttribute('r', '10'); // Even larger for better visibility
        circle.setAttribute('fill', topicRing.color);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('opacity', '1'); // Full opacity
        circle.setAttribute('filter', 'url(#glow)');
        
        // Calculate initial position for the message circle
        const messageCount = topicRing.messages.length;
        const angle = (messageCount * 2 * Math.PI) / Math.max(messageCount + 1, 1);
        const initialX = customerNode.x + Math.cos(angle) * topicRing.distance;
        const initialY = customerNode.y + Math.sin(angle) * topicRing.distance;
        
        // Set initial position
        circle.setAttribute('cx', initialX);
        circle.setAttribute('cy', initialY);
        
        // Add click handler for message details
        circle.style.cursor = 'pointer';
        circle.addEventListener('click', () => {
            this.showMessageModal(messageData);
        });
        
        // Add to SVG - ensure it's visible
        this.networkSvg.querySelector('#nodes').appendChild(circle);
        
        console.log(`Created message circle at (${initialX}, ${initialY}) for topic ${topicRing.topic}`); // Debug log
        
        const messageCircle = {
            element: circle,
            circle: circle,
            messageData: messageData,
            customer: customerNode.customer,
            topic: topicRing.topic,
            x: initialX,
            y: initialY,
            angle: angle,
            createdAt: Date.now()
        };
        
        return messageCircle;
    }
    
    positionMessageInRing(customerNode, topicRing) {
        const messageCount = topicRing.messages.length;
        
        topicRing.messages.forEach((messageCircle, index) => {
            // Distribute messages evenly around the ring
            const angle = (index * 2 * Math.PI) / Math.max(messageCount, 1);
            const x = customerNode.x + Math.cos(angle) * topicRing.distance;
            const y = customerNode.y + Math.sin(angle) * topicRing.distance;
            
            messageCircle.x = x;
            messageCircle.y = y;
            messageCircle.angle = angle;
            
            // Update visual position with smooth animation
            this.animateMessageCircle(messageCircle, x, y);
        });
    }
    
    animateMessageCircle(messageCircle, targetX, targetY) {
        const startX = parseFloat(messageCircle.circle.getAttribute('cx')) || messageCircle.x;
        const startY = parseFloat(messageCircle.circle.getAttribute('cy')) || messageCircle.y;
        
        // Skip animation if already at target position
        const dx = Math.abs(targetX - startX);
        const dy = Math.abs(targetY - startY);
        if (dx < 1 && dy < 1) {
            return;
        }
        
        const duration = 300;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeInOutCubic(progress);
            
            const currentX = startX + (targetX - startX) * easeProgress;
            const currentY = startY + (targetY - startY) * easeProgress;
            
            messageCircle.circle.setAttribute('cx', currentX);
            messageCircle.circle.setAttribute('cy', currentY);
            
            // Update stored position
            messageCircle.x = currentX;
            messageCircle.y = currentY;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    createCustomerNodeElement(node) {
        const customerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        customerGroup.id = `customer-${node.customer}`;
        
        const customerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        customerCircle.setAttribute('cx', node.x);
        customerCircle.setAttribute('cy', node.y);
        customerCircle.setAttribute('r', node.radius);
        customerCircle.setAttribute('fill', node.color);
        customerCircle.setAttribute('stroke', '#fff');
        customerCircle.setAttribute('stroke-width', '2');
        customerCircle.setAttribute('opacity', '0.9');
        
        const customerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        customerText.setAttribute('x', node.x);
        customerText.setAttribute('y', node.y + 3);
        customerText.setAttribute('text-anchor', 'middle');
        customerText.setAttribute('fill', 'white');
        customerText.setAttribute('font-size', '18');  // 12px * 1.5 = 18px
        customerText.setAttribute('font-weight', 'bold');
        customerText.setAttribute('filter', 'url(#textShadow)');
        customerText.textContent = node.customer.toUpperCase().substring(0, 6);
        
        customerGroup.appendChild(customerCircle);
        customerGroup.appendChild(customerText);
        
        // Add click handler
        customerGroup.style.cursor = 'pointer';
        customerGroup.addEventListener('click', () => {
            this.showNetworkNodeDetails(node);
        });
        
        this.networkSvg.querySelector('#nodes').appendChild(customerGroup);
        node.element = customerGroup;
    }
    
    updateTopicNode(topic, customer) {
        const topicKey = `${customer}:${topic}`;
        
        if (!this.networkTopics.has(topicKey)) {
            // Create new topic node with dynamic positioning
            const customerNode = this.networkNodes.get(customer);
            const flowWidth = this.domElements.messageFlow.clientWidth;
            const flowHeight = this.domElements.messageFlow.clientHeight;
            // Scale topic distance based on screen size - reduced for shorter lines
            const distance = Math.min(flowWidth, flowHeight) * 0.10;
            
            // Find optimal position with collision avoidance
            const optimalPosition = this.findOptimalTopicPosition(customerNode, distance, customer);
            
            const topicNode = {
                x: optimalPosition.x,
                y: optimalPosition.y,
                radius: 18, // Increased from 8 (50% bigger)
                color: customerNode.color,
                topic: topic,
                customer: customer,
                messageCount: 0,
                lastActivity: Date.now(),
                element: null,
                targetX: optimalPosition.x, // For smooth animations
                targetY: optimalPosition.y
            };
            
            this.createTopicNodeElement(topicNode);
            this.networkTopics.set(topicKey, topicNode);
            
            // Create connection from customer to topic
            this.createConnection(customerNode, topicNode, customerNode.color);
            
            // Shift existing nodes to make room if needed
            this.optimizeTopicLayout(customer);
        }
        
        // Update activity
        const topicNode = this.networkTopics.get(topicKey);
        topicNode.messageCount++;
        topicNode.lastActivity = Date.now();
    }
    
    createTopicNodeElement(node) {
        const topicGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        topicGroup.id = `topic-${node.customer}-${node.topic.replace(/[^a-zA-Z0-9]/g, '')}`;
        
        const topicCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        topicCircle.setAttribute('cx', node.x);
        topicCircle.setAttribute('cy', node.y);
        topicCircle.setAttribute('r', node.radius);
        topicCircle.setAttribute('fill', node.color);
        topicCircle.setAttribute('stroke', '#fff');
        topicCircle.setAttribute('stroke-width', '1');
        topicCircle.setAttribute('opacity', '0.8');
        
        topicGroup.appendChild(topicCircle);
        
        // Add click handler
        topicGroup.style.cursor = 'pointer';
        topicGroup.addEventListener('click', () => {
            this.showTopicDetails(node);
        });
        
        this.networkSvg.querySelector('#nodes').appendChild(topicGroup);
        node.element = topicGroup;
    }
    
    createConnection(fromNode, toNode, color) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromNode.x);
        line.setAttribute('y1', fromNode.y);
        line.setAttribute('x2', toNode.x);
        line.setAttribute('y2', toNode.y);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '2');
        line.setAttribute('opacity', '0.3');
        line.id = `connection-${fromNode.customer || 'broker'}-${toNode.customer || toNode.topic || 'broker'}`;
        
        this.networkSvg.querySelector('#connections').appendChild(line);
    }
    
    createNetworkPulse(customer, topic, messageData) {
        const customerNode = this.networkNodes.get(customer);
        
        if (!customerNode) return;
        
        // Create pulse from broker to customer
        this.createPulseAlongPath(this.brokerNode, customerNode, customerNode.color);
        
        // Find the specific message circle for this topic
        setTimeout(() => {
            if (customerNode.topicRings && customerNode.topicRings.has(topic)) {
                const topicRing = customerNode.topicRings.get(topic);
                // Get the most recently added message circle
                const latestMessage = topicRing.messages[topicRing.messages.length - 1];
                
                if (latestMessage) {
                    // Create pulse from customer to the specific message circle
                    this.createPulseAlongPath(customerNode, latestMessage, customerNode.color);
                }
            }
        }, 400); // Delay to let the first pulse reach the customer
    }
    
    createPulseAlongPath(fromNode, toNode, color) {
        const pulse = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pulse.setAttribute('r', '12'); // Larger for full screen visibility (8 * 1.5 = 12)
        pulse.setAttribute('fill', color);
        pulse.setAttribute('opacity', '0.9');
        pulse.setAttribute('filter', 'url(#glow)');
        
        this.networkSvg.querySelector('#pulses').appendChild(pulse);
        
        // Calculate collision-avoiding path
        const pathPoints = this.calculateCollisionFreePath(fromNode, toNode);
        
        const startTime = Date.now();
        const duration = 1000; // Slightly longer for curved paths
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Calculate position along curved path
            const position = this.getPositionAlongPath(pathPoints, progress);
            
            pulse.setAttribute('cx', position.x);
            pulse.setAttribute('cy', position.y);
            
            // Fade out near the end
            const opacity = progress < 0.8 ? 0.9 : 0.9 * (1 - (progress - 0.8) / 0.2);
            pulse.setAttribute('opacity', opacity);
            
            // Scale pulse during animation for visual effect
            const scale = 0.8 + (Math.sin(progress * Math.PI) * 0.4);
            pulse.setAttribute('r', 12 * scale);  // Base size increased from 8 to 12
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Remove pulse when animation completes
                if (pulse.parentNode) {
                    pulse.parentNode.removeChild(pulse);
                }
            }
        };
        
        animate();
    }
    
    calculateCollisionFreePath(fromNode, toNode) {
        const startX = fromNode.x;
        const startY = fromNode.y;
        const endX = toNode.x;
        const endY = toNode.y;
        
        // Get all potential obstacle nodes
        const obstacles = this.getAllObstacleNodes(fromNode, toNode);
        
        // Start with direct path
        let pathPoints = [
            { x: startX, y: startY },
            { x: endX, y: endY }
        ];
        
        // Check if direct path has collisions
        const collisions = this.findPathCollisions(pathPoints, obstacles);
        
        if (collisions.length > 0) {
            // Calculate curved path around obstacles
            pathPoints = this.calculateCurvedPath(startX, startY, endX, endY, obstacles);
        }
        
        return pathPoints;
    }
    
    getAllObstacleNodes(fromNode, toNode) {
        const obstacles = [];
        const pulseRadius = 5;
        const clearanceDistance = 40; // Minimum clearance around nodes for full screen
        
        // Add all customer nodes (except the ones we're traveling between)
        this.networkNodes.forEach((node) => {
            if (node !== fromNode && node !== toNode) {
                obstacles.push({
                    x: node.x,
                    y: node.y,
                    radius: node.radius + clearanceDistance
                });
            }
        });
        
        // Add all topic nodes (except the ones we're traveling between)
        this.networkTopics.forEach((node) => {
            if (node !== fromNode && node !== toNode) {
                obstacles.push({
                    x: node.x,
                    y: node.y,
                    radius: node.radius + clearanceDistance
                });
            }
        });
        
        // Add broker node if it's not one of the endpoints
        if (this.brokerNode !== fromNode && this.brokerNode !== toNode) {
            obstacles.push({
                x: this.brokerNode.x,
                y: this.brokerNode.y,
                radius: this.brokerNode.radius + clearanceDistance
            });
        }
        
        return obstacles;
    }
    
    findPathCollisions(pathPoints, obstacles) {
        const collisions = [];
        
        for (let i = 0; i < pathPoints.length - 1; i++) {
            const start = pathPoints[i];
            const end = pathPoints[i + 1];
            
            for (const obstacle of obstacles) {
                const distance = this.pointToLineDistance(obstacle.x, obstacle.y, start.x, start.y, end.x, end.y);
                if (distance < obstacle.radius) {
                    collisions.push({
                        obstacle: obstacle,
                        segmentStart: start,
                        segmentEnd: end,
                        distance: distance
                    });
                }
            }
        }
        
        return collisions;
    }
    
    calculateCurvedPath(startX, startY, endX, endY, obstacles) {
        const pathPoints = [{ x: startX, y: startY }];
        
        // Find the main obstacle to avoid (closest to straight line)
        const directDx = endX - startX;
        const directDy = endY - startY;
        const directDistance = Math.sqrt(directDx * directDx + directDy * directDy);
        
        let mainObstacle = null;
        let minDistance = Infinity;
        
        for (const obstacle of obstacles) {
            const distToLine = this.pointToLineDistance(obstacle.x, obstacle.y, startX, startY, endX, endY);
            if (distToLine < obstacle.radius && distToLine < minDistance) {
                minDistance = distToLine;
                mainObstacle = obstacle;
            }
        }
        
        if (mainObstacle) {
            // Calculate waypoints around the obstacle
            const waypoints = this.calculateWaypoints(startX, startY, endX, endY, mainObstacle);
            pathPoints.push(...waypoints);
        }
        
        pathPoints.push({ x: endX, y: endY });
        
        return pathPoints;
    }
    
    calculateWaypoints(startX, startY, endX, endY, obstacle) {
        const waypoints = [];
        
        // Vector from start to end
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Unit vector perpendicular to the line
        const perpX = -dy / distance;
        const perpY = dx / distance;
        
        // Determine which side of the obstacle to go around
        const obstacleToStart = {
            x: startX - obstacle.x,
            y: startY - obstacle.y
        };
        
        // Use cross product to determine which side
        const cross = obstacleToStart.x * perpY - obstacleToStart.y * perpX;
        const side = cross > 0 ? 1 : -1;
        
        // Calculate waypoint around the obstacle
        const avoidanceRadius = obstacle.radius * 1.2; // 20% extra clearance
        const waypointX = obstacle.x + (perpX * side * avoidanceRadius);
        const waypointY = obstacle.y + (perpY * side * avoidanceRadius);
        
        waypoints.push({ x: waypointX, y: waypointY });
        
        return waypoints;
    }
    
    getPositionAlongPath(pathPoints, progress) {
        if (pathPoints.length < 2) {
            return pathPoints[0] || { x: 0, y: 0 };
        }
        
        if (progress <= 0) return pathPoints[0];
        if (progress >= 1) return pathPoints[pathPoints.length - 1];
        
        // Calculate total path length
        let totalLength = 0;
        const segmentLengths = [];
        
        for (let i = 0; i < pathPoints.length - 1; i++) {
            const dx = pathPoints[i + 1].x - pathPoints[i].x;
            const dy = pathPoints[i + 1].y - pathPoints[i].y;
            const length = Math.sqrt(dx * dx + dy * dy);
            segmentLengths.push(length);
            totalLength += length;
        }
        
        // Find which segment the progress point is in
        const targetDistance = progress * totalLength;
        let currentDistance = 0;
        
        for (let i = 0; i < segmentLengths.length; i++) {
            if (currentDistance + segmentLengths[i] >= targetDistance) {
                // Interpolate within this segment
                const segmentProgress = (targetDistance - currentDistance) / segmentLengths[i];
                const start = pathPoints[i];
                const end = pathPoints[i + 1];
                
                return {
                    x: start.x + (end.x - start.x) * segmentProgress,
                    y: start.y + (end.y - start.y) * segmentProgress
                };
            }
            currentDistance += segmentLengths[i];
        }
        
        // Fallback to last point
        return pathPoints[pathPoints.length - 1];
    }
    
    updateNodeActivity() {
        const now = Date.now();
        const inactiveTime = 10000; // 10 seconds
        
        // Update customer nodes
        this.networkNodes.forEach((node) => {
            const timeSinceActivity = now - node.lastActivity;
            const activityLevel = Math.max(0, 1 - (timeSinceActivity / inactiveTime));
            
            // Update node size based on activity
            const baseRadius = 45;
            const maxRadius = 45;
            const currentRadius = baseRadius + (maxRadius - baseRadius) * activityLevel;
            
            const circle = node.element.querySelector('circle');
            if (circle) {
                circle.setAttribute('r', currentRadius);
                circle.setAttribute('opacity', 0.7 + activityLevel * 0.3);
            }
        });
        
        // Update topic nodes
        this.networkTopics.forEach((node) => {
            const timeSinceActivity = now - node.lastActivity;
            const activityLevel = Math.max(0, 1 - (timeSinceActivity / inactiveTime));
            
            const baseRadius = 18;
            const maxRadius = 18;
            const currentRadius = baseRadius + (maxRadius - baseRadius) * activityLevel;
            
            const circle = node.element.querySelector('circle');
            if (circle) {
                circle.setAttribute('r', currentRadius);
                circle.setAttribute('opacity', 0.6 + activityLevel * 0.4);
            }
        });
    }
    
    showNetworkNodeDetails(node) {
        const modalData = {
            topic: `Customer: ${node.customer}`,
            payload: `Messages: ${node.messageCount}\nTopics: ${node.topics.size}\nLast Activity: ${new Date(node.lastActivity).toLocaleString()}`,
            timestamp: node.lastActivity / 1000,
            qos: 'N/A',
            retain: false
        };
        this.showMessageModal(modalData);
    }
    
    showTopicDetails(node) {
        const modalData = {
            topic: node.topic,
            payload: `Customer: ${node.customer}\nMessages: ${node.messageCount}\nLast Activity: ${new Date(node.lastActivity).toLocaleString()}`,
            timestamp: node.lastActivity / 1000,
            qos: 'N/A',
            retain: false
        };
        this.showMessageModal(modalData);
    }
    
    redistributeCustomerNodes() {
        if (this.networkNodes.size <= 1) return;
        
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        const distance = Math.min(flowWidth, flowHeight) * 0.18;
        const totalNodes = this.networkNodes.size;
        
        let nodeIndex = 0;
        this.networkNodes.forEach((node) => {
            // Calculate new angle for even distribution
            const angle = (nodeIndex * 2 * Math.PI) / totalNodes;
            
            // Calculate new position
            const newX = this.brokerNode.x + Math.cos(angle) * distance;
            const newY = this.brokerNode.y + Math.sin(angle) * distance;
            
            // Only animate if there's a significant change
            const dx = Math.abs(newX - node.x);
            const dy = Math.abs(newY - node.y);
            
            if (dx > 5 || dy > 5) {
                node.targetX = newX;
                node.targetY = newY;
                
                // Smooth animation to new position
                this.animateCustomerNode(node);
            }
            
            nodeIndex++;
        });
        
        // Update all connections after redistribution
        setTimeout(() => {
            this.updateNetworkConnections();
        }, 300);
    }
    
    animateCustomerNode(node) {
        const duration = 400;
        const startTime = Date.now();
        const startX = node.x;
        const startY = node.y;
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeInOutCubic(progress);
            
            // Interpolate position
            node.x = startX + (node.targetX - startX) * easeProgress;
            node.y = startY + (node.targetY - startY) * easeProgress;
            
            // Update visual position
            const circle = node.element.querySelector('circle');
            const text = node.element.querySelector('text');
            if (circle) {
                circle.setAttribute('cx', node.x);
                circle.setAttribute('cy', node.y);
            }
            if (text) {
                text.setAttribute('x', node.x);
                text.setAttribute('y', node.y + 3);
            }
            
            // Update message circles that orbit this customer node
            this.updateCustomerMessageCircles(node);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Update connections when animation completes
                this.updateNetworkConnections();
            }
        };
        
        animate();
    }
    
    updateCustomerMessageCircles(customerNode) {
        if (!customerNode.topicRings) return;
        
        // Update positions of all message circles for this customer
        customerNode.topicRings.forEach((topicRing) => {
            this.positionMessageInRing(customerNode, topicRing);
        });
    }
    
    // Dynamic positioning methods
    findOptimalTopicPosition(customerNode, distance, customer) {
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        const minSpacing = 60; // Increased for full screen scale
        
        // Get ALL existing nodes (not just for this customer)
        const allNodes = [
            ...Array.from(this.networkTopics.values()),
            ...Array.from(this.networkNodes.values()),
            this.brokerNode
        ];
        
        // Try different distances and angles to find a non-colliding position
        const maxDistance = Math.min(flowWidth, flowHeight) * 0.15;
        let bestPosition = null;
        let bestScore = -1;
        
        // Try multiple distance rings
        for (let distanceRing = distance; distanceRing <= maxDistance; distanceRing += 20) {
            // Try more angles for better coverage
            const angleStep = Math.PI / 12; // 15 degrees
            
            for (let i = 0; i < 24; i++) { // Try 24 positions around each circle
                const angle = i * angleStep;
                const testX = customerNode.x + Math.cos(angle) * distanceRing;
                const testY = customerNode.y + Math.sin(angle) * distanceRing;
                
                // Check bounds with larger margin
                if (testX < 80 || testX > flowWidth - 80 || testY < 80 || testY > flowHeight - 80) {
                    continue;
                }
                
                // Calculate collision score (higher is better)
                let score = this.calculateAdvancedPositionScore(testX, testY, minSpacing, allNodes, customerNode);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestPosition = { x: testX, y: testY };
                    
                    // If we found a really good position, use it
                    if (score > 80) {
                        return bestPosition;
                    }
                }
            }
        }
        
        // If still no good position found, force one by pushing others away
        if (!bestPosition || bestScore < 20) {
            bestPosition = this.forceNonOverlappingPosition(customerNode, distance, allNodes, minSpacing);
        }
        
        return bestPosition;
    }
    
    calculatePositionScore(x, y, minSpacing, existingNodes, customerNode) {
        // Legacy method - kept for compatibility but not used for new positioning
        return this.calculateAdvancedPositionScore(x, y, minSpacing, existingNodes, customerNode);
    }
    
    calculateAdvancedPositionScore(x, y, minSpacing, allNodes, customerNode) {
        let score = 100; // Base score
        
        // Check distance to ALL existing nodes
        for (const node of allNodes) {
            if (node === customerNode) continue; // Skip the parent customer node
            
            const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            const nodeRadius = node.radius || 8;
            const effectiveMinSpacing = minSpacing + nodeRadius;
            
            if (dist < effectiveMinSpacing) {
                // Heavy penalty for collision, exponentially worse for closer distances
                score -= Math.pow((effectiveMinSpacing - dist) / effectiveMinSpacing, 2) * 50;
            } else {
                // Bonus for good spacing, but diminishing returns
                score += Math.min(15, (dist - effectiveMinSpacing) * 0.5);
            }
        }
        
        // Extra penalty for being too close to connection lines
        score -= this.calculateLineCollisionPenalty(x, y, minSpacing);
        
        // Bonus for being in a less crowded area
        score += this.calculateCrowdingBonus(x, y, allNodes, minSpacing * 2);
        
        // Bonus for outward positioning from center (favor directions away from center)
        score += this.calculateOutwardPositionBonus(x, y, customerNode);
        
        return score;
    }
    
    calculateLineCollisionPenalty(x, y, minSpacing) {
        let penalty = 0;
        const lineBuffer = minSpacing * 0.6; // Lines need some clearance too
        
        // Check distance to all existing connections
        this.networkNodes.forEach((customerNode) => {
            // Check customer-to-broker line
            const lineDist = this.pointToLineDistance(x, y, customerNode.x, customerNode.y, this.brokerNode.x, this.brokerNode.y);
            if (lineDist < lineBuffer) {
                penalty += (lineBuffer - lineDist) * 2;
            }
            
            // Check customer-to-topic lines
            this.networkTopics.forEach((topicNode) => {
                if (topicNode.customer === customerNode.customer) {
                    const topicLineDist = this.pointToLineDistance(x, y, customerNode.x, customerNode.y, topicNode.x, topicNode.y);
                    if (topicLineDist < lineBuffer) {
                        penalty += (lineBuffer - topicLineDist) * 1.5;
                    }
                }
            });
        });
        
        return penalty;
    }
    
    calculateCrowdingBonus(x, y, allNodes, radius) {
        let nodesInArea = 0;
        for (const node of allNodes) {
            const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
            if (dist < radius) {
                nodesInArea++;
            }
        }
        
        // Bonus for less crowded areas (inverse relationship)
        return Math.max(0, 10 - nodesInArea * 2);
    }
    
    calculateOutwardPositionBonus(x, y, customerNode) {
        // Get screen dimensions to find center
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        const centerX = flowWidth / 2;
        const centerY = flowHeight / 2;
        
        // Calculate distances from center for both the customer node and proposed position
        const customerDistFromCenter = Math.sqrt((customerNode.x - centerX) ** 2 + (customerNode.y - centerY) ** 2);
        const proposedDistFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        
        // Bonus if the proposed position is farther from center than the customer node
        if (proposedDistFromCenter > customerDistFromCenter) {
            // Scale the bonus based on how much farther outward it is
            const outwardDistance = proposedDistFromCenter - customerDistFromCenter;
            const maxBonus = 20; // Maximum bonus points
            const scaleFactor = 0.1; // How quickly bonus increases with distance
            return Math.min(maxBonus, outwardDistance * scaleFactor);
        }
        
        // Small penalty if moving inward toward center
        const inwardDistance = customerDistFromCenter - proposedDistFromCenter;
        return -inwardDistance * 0.05; // Small penalty for moving inward
    }
    
    pointToLineDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return Math.sqrt(A * A + B * B);
        
        const param = dot / lenSq;
        
        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    forceNonOverlappingPosition(customerNode, preferredDistance, allNodes, minSpacing) {
        // If no good position found, create one by pushing existing nodes
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        
        // Start with preferred position
        let bestX = customerNode.x + preferredDistance;
        let bestY = customerNode.y;
        
        // Apply multiple iterations of force-based positioning
        for (let iteration = 0; iteration < 10; iteration++) {
            let forceX = 0;
            let forceY = 0;
            let hasCollision = false;
            
            // Calculate repulsion forces from all nodes
            for (const node of allNodes) {
                if (node === customerNode) continue;
                
                const dx = bestX - node.x;
                const dy = bestY - node.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const nodeRadius = node.radius || 8;
                const requiredDist = minSpacing + nodeRadius;
                
                if (dist < requiredDist && dist > 0) {
                    hasCollision = true;
                    const force = (requiredDist - dist) / dist;
                    forceX += dx * force * 0.3;
                    forceY += dy * force * 0.3;
                }
            }
            
            // If no collision, we're done
            if (!hasCollision) break;
            
            // Apply forces with boundary constraints (account for node size)
            const dynamicMargin = Math.max(60, minSpacing); // At least 60px margin or node spacing
            bestX = Math.max(dynamicMargin, Math.min(flowWidth - dynamicMargin, bestX + forceX));
            bestY = Math.max(dynamicMargin, Math.min(flowHeight - dynamicMargin, bestY + forceY));
        }
        
        return { x: bestX, y: bestY };
    }
    
    calculateLineRepulsionForce(x, y, minDistance) {
        let forceX = 0;
        let forceY = 0;
        
        // Check repulsion from all connection lines
        this.networkNodes.forEach((customerNode) => {
            // Repulsion from customer-to-broker line
            const brokerLineDist = this.pointToLineDistance(x, y, customerNode.x, customerNode.y, this.brokerNode.x, this.brokerNode.y);
            if (brokerLineDist < minDistance && brokerLineDist > 0) {
                const closestPoint = this.getClosestPointOnLine(x, y, customerNode.x, customerNode.y, this.brokerNode.x, this.brokerNode.y);
                const dx = x - closestPoint.x;
                const dy = y - closestPoint.y;
                const force = (minDistance - brokerLineDist) / minDistance * 20;
                forceX += (dx / brokerLineDist) * force;
                forceY += (dy / brokerLineDist) * force;
            }
            
            // Repulsion from customer-to-topic lines
            this.networkTopics.forEach((topicNode) => {
                if (topicNode.customer === customerNode.customer) {
                    const topicLineDist = this.pointToLineDistance(x, y, customerNode.x, customerNode.y, topicNode.x, topicNode.y);
                    if (topicLineDist < minDistance && topicLineDist > 0) {
                        const closestPoint = this.getClosestPointOnLine(x, y, customerNode.x, customerNode.y, topicNode.x, topicNode.y);
                        const dx = x - closestPoint.x;
                        const dy = y - closestPoint.y;
                        const force = (minDistance - topicLineDist) / minDistance * 15;
                        forceX += (dx / topicLineDist) * force;
                        forceY += (dy / topicLineDist) * force;
                    }
                }
            });
        });
        
        return { x: forceX, y: forceY };
    }
    
    getClosestPointOnLine(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        if (lenSq === 0) return { x: x1, y: y1 };
        
        const param = Math.max(0, Math.min(1, dot / lenSq));
        
        return {
            x: x1 + param * C,
            y: y1 + param * D
        };
    }
    
    optimizeTopicLayout(customer) {
        const customerNode = this.networkNodes.get(customer);
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        const distance = Math.min(flowWidth, flowHeight) * 0.10;
        const minSpacing = 35; // Increased spacing
        
        // Get all topic nodes for this customer
        const customerTopics = Array.from(this.networkTopics.values())
            .filter(node => node.customer === customer);
        
        if (customerTopics.length <= 1) return; // Nothing to optimize
        
        // Get ALL nodes for collision detection
        const allNodes = [
            ...Array.from(this.networkTopics.values()),
            ...Array.from(this.networkNodes.values()),
            this.brokerNode
        ];
        
        // Apply aggressive force-based repositioning
        const iterations = 8; // More iterations for better results
        for (let iter = 0; iter < iterations; iter++) {
            customerTopics.forEach((topicNode) => {
                let forceX = 0;
                let forceY = 0;
                
                // Strong repulsion from ALL other nodes
                allNodes.forEach((otherNode) => {
                    if (otherNode === topicNode || otherNode === customerNode) return;
                    
                    const dx = topicNode.x - otherNode.x;
                    const dy = topicNode.y - otherNode.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const otherRadius = otherNode.radius || 8;
                    const requiredDist = minSpacing + otherRadius;
                    
                    if (dist < requiredDist && dist > 0) {
                        const force = Math.pow((requiredDist - dist) / requiredDist, 2) * 0.4;
                        forceX += (dx / dist) * force * 60;
                        forceY += (dy / dist) * force * 60;
                    }
                });
                
                // Moderate attraction to ideal distance from customer
                const dx = topicNode.x - customerNode.x;
                const dy = topicNode.y - customerNode.y;
                const currentDist = Math.sqrt(dx * dx + dy * dy);
                
                if (currentDist > 0) {
                    const idealForce = (distance - currentDist) / currentDist;
                    forceX -= dx * idealForce * 0.08;
                    forceY -= dy * idealForce * 0.08;
                }
                
                // Repulsion from connection lines
                const lineForce = this.calculateLineRepulsionForce(topicNode.x, topicNode.y, minSpacing * 0.7);
                forceX += lineForce.x;
                forceY += lineForce.y;
                
                // Apply forces with bounds checking
                const newX = Math.max(100, Math.min(flowWidth - 100, topicNode.x + forceX));
                const newY = Math.max(100, Math.min(flowHeight - 100, topicNode.y + forceY));
                
                topicNode.targetX = newX;
                topicNode.targetY = newY;
            });
        }
        
        // Animate nodes to their new positions
        this.animateTopicNodes(customerTopics);
    }
    
    animateTopicNodes(nodes) {
        const duration = 500; // 500ms animation
        const startTime = Date.now();
        
        // Store initial positions
        nodes.forEach(node => {
            node.startX = node.x;
            node.startY = node.y;
        });
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeInOutCubic(progress);
            
            nodes.forEach(node => {
                if (node.element && node.startX !== undefined && node.startY !== undefined) {
                    // Interpolate position
                    node.x = node.startX + (node.targetX - node.startX) * easeProgress;
                    node.y = node.startY + (node.targetY - node.startY) * easeProgress;
                    
                    // Update visual position
                    const circle = node.element.querySelector('circle');
                    if (circle) {
                        circle.setAttribute('cx', node.x);
                        circle.setAttribute('cy', node.y);
                    }
                }
            });
            
            // Update connections
            this.updateNetworkConnections();
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Clean up animation properties
                nodes.forEach(node => {
                    delete node.startX;
                    delete node.startY;
                });
            }
        };
        
        animate();
    }
    
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    optimizeEntireNetwork() {
        // Optimize layout for all customers that have multiple topics
        this.networkNodes.forEach((customerNode, customer) => {
            const customerTopics = Array.from(this.networkTopics.values())
                .filter(node => node.customer === customer);
            
            if (customerTopics.length > 1) {
                // Use a lighter optimization for global updates
                this.lightOptimizeTopicLayout(customer);
            }
        });
    }
    
    lightOptimizeTopicLayout(customer) {
        const customerNode = this.networkNodes.get(customer);
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        const distance = Math.min(flowWidth, flowHeight) * 0.10;
        const minSpacing = 30; // Still maintain good spacing for global optimization
        
        // Get all topic nodes for this customer
        const customerTopics = Array.from(this.networkTopics.values())
            .filter(node => node.customer === customer);
        
        if (customerTopics.length <= 1) return;
        
        // Light force-based repositioning (fewer iterations)
        const iterations = 2;
        for (let iter = 0; iter < iterations; iter++) {
            customerTopics.forEach((topicNode) => {
                let forceX = 0;
                let forceY = 0;
                
                // Repulsion from other topic nodes of the same customer
                customerTopics.forEach((otherNode) => {
                    if (otherNode === topicNode) return;
                    
                    const dx = topicNode.x - otherNode.x;
                    const dy = topicNode.y - otherNode.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < minSpacing && dist > 0) {
                        const force = (minSpacing - dist) / dist;
                        forceX += dx * force * 0.05; // Gentler force
                        forceY += dy * force * 0.05;
                    }
                });
                
                // Apply forces with bounds checking
                const newX = Math.max(100, Math.min(flowWidth - 100, topicNode.x + forceX));
                const newY = Math.max(100, Math.min(flowHeight - 100, topicNode.y + forceY));
                
                topicNode.targetX = newX;
                topicNode.targetY = newY;
            });
        }
        
        // Animate nodes to their new positions (shorter animation)
        this.animateTopicNodesLight(customerTopics);
    }
    
    animateTopicNodesLight(nodes) {
        const duration = 300; // Shorter animation for light optimization
        const startTime = Date.now();
        
        // Store initial positions
        nodes.forEach(node => {
            node.startX = node.x;
            node.startY = node.y;
        });
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeProgress = this.easeInOutCubic(progress);
            
            nodes.forEach(node => {
                if (node.element && node.startX !== undefined && node.startY !== undefined) {
                    // Only animate if there's a significant difference
                    const dx = Math.abs(node.targetX - node.startX);
                    const dy = Math.abs(node.targetY - node.startY);
                    
                    if (dx > 2 || dy > 2) { // Only animate if moving more than 2px
                        // Interpolate position
                        node.x = node.startX + (node.targetX - node.startX) * easeProgress;
                        node.y = node.startY + (node.targetY - node.startY) * easeProgress;
                        
                        // Update visual position
                        const circle = node.element.querySelector('circle');
                        if (circle) {
                            circle.setAttribute('cx', node.x);
                            circle.setAttribute('cy', node.y);
                        }
                    }
                }
            });
            
            // Update connections less frequently for performance
            if (progress > 0.5) {
                this.updateNetworkConnections();
            }
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Clean up animation properties and ensure final update
                nodes.forEach(node => {
                    delete node.startX;
                    delete node.startY;
                });
                this.updateNetworkConnections();
            }
        };
        
        animate();
    }
    
    setupNetworkResizeHandling() {
        // Listen for window resize events for full viewport responsiveness
        window.addEventListener('resize', () => {
            this.handleNetworkResize();
        });
    }
    
    handleNetworkResize() {
        if (!this.d3Svg || this.visualizationMode !== 'network') {
            return;
        }
        
        // Debounce resize handling
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        this.resizeTimeout = setTimeout(() => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            // Update SVG dimensions to full viewport
            this.d3Svg
                .attr('width', width)
                .attr('height', height)
                .style('width', '100vw')
                .style('height', '100vh');
            
            // Update force center and boundary
            if (this.d3Simulation) {
                this.d3Simulation.force('center', d3.forceCenter(width / 2, height / 2));
                this.d3Simulation.force('boundary', this.createBoundaryForce(width, height));
                
                // Update broker node fixed position to viewport center
                const brokerNode = this.d3Nodes.find(n => n.id === 'broker');
                if (brokerNode) {
                    brokerNode.fx = width / 2;
                    brokerNode.fy = height / 2;
                }
                
                this.d3Simulation.alpha(0.3).restart();
            }
        }, 100);
    }
    
    resizeNetworkGraph() {
        const flowWidth = this.domElements.messageFlow.clientWidth;
        const flowHeight = this.domElements.messageFlow.clientHeight;
        
        // Update SVG dimensions
        this.networkSvg.setAttribute('width', flowWidth);
        this.networkSvg.setAttribute('height', flowHeight);
        this.networkSvg.setAttribute('viewBox', `0 0 ${flowWidth} ${flowHeight}`);
        
        // Update broker node position (center)
        const centerX = flowWidth / 2;
        const centerY = flowHeight / 2;
        
        this.brokerNode.x = centerX;
        this.brokerNode.y = centerY;
        
        // Update broker node visual position
        const brokerCircle = this.brokerNode.element.querySelector('circle');
        const brokerText = this.brokerNode.element.querySelector('text');
        if (brokerCircle) {
            brokerCircle.setAttribute('cx', centerX);
            brokerCircle.setAttribute('cy', centerY);
        }
        if (brokerText) {
            brokerText.setAttribute('x', centerX);
            brokerText.setAttribute('y', centerY + 5);
        }
        
        // Recalculate and update customer node positions
        this.repositionCustomerNodes(centerX, centerY, flowWidth, flowHeight);
        
        // Recalculate and update topic node positions
        this.repositionTopicNodes(flowWidth, flowHeight);
        
        // Update all connections
        this.updateNetworkConnections();
    }
    
    repositionCustomerNodes(centerX, centerY, flowWidth, flowHeight) {
        const distance = Math.min(flowWidth, flowHeight) * 0.18;
        let nodeIndex = 0;
        const totalNodes = this.networkNodes.size;
        
        this.networkNodes.forEach((node) => {
            // Recalculate angle for even distribution around full circle
            const angle = (nodeIndex * 2 * Math.PI) / totalNodes;
            
            // Update node position
            node.x = centerX + Math.cos(angle) * distance;
            node.y = centerY + Math.sin(angle) * distance;
            
            // Update target positions for smooth animations
            node.targetX = node.x;
            node.targetY = node.y;
            
            // Update visual position
            const circle = node.element.querySelector('circle');
            const text = node.element.querySelector('text');
            if (circle) {
                circle.setAttribute('cx', node.x);
                circle.setAttribute('cy', node.y);
            }
            if (text) {
                text.setAttribute('x', node.x);
                text.setAttribute('y', node.y + 3);
            }
            
            // Update message circles that orbit this customer node
            this.updateCustomerMessageCircles(node);
            
            nodeIndex++;
        });
    }
    
    repositionTopicNodes(flowWidth, flowHeight) {
        const topicDistance = Math.min(flowWidth, flowHeight) * 0.10;
        
        this.networkTopics.forEach((topicNode) => {
            const customerNode = this.networkNodes.get(topicNode.customer);
            if (customerNode) {
                // Keep relative angle but update distance based on new screen size
                const angle = Math.atan2(topicNode.y - customerNode.y, topicNode.x - customerNode.x);
                
                topicNode.x = customerNode.x + Math.cos(angle) * topicDistance;
                topicNode.y = customerNode.y + Math.sin(angle) * topicDistance;
                
                // Update visual position
                const circle = topicNode.element.querySelector('circle');
                if (circle) {
                    circle.setAttribute('cx', topicNode.x);
                    circle.setAttribute('cy', topicNode.y);
                }
            }
        });
    }
    
    updateNetworkConnections() {
        // Clear existing connections
        const connectionsGroup = this.networkSvg.querySelector('#connections');
        connectionsGroup.innerHTML = '';
        
        // Recreate connections with new positions (only broker to customers now)
        this.networkNodes.forEach((customerNode) => {
            // Recreate broker to customer connection
            this.createConnection(this.brokerNode, customerNode, customerNode.color);
        });
    }

    // D3 Bubbles Implementation
    updateD3Bubbles(messageData) {
        if (!this.d3BubblesSvg) {
            this.initializeD3Bubbles();
        }
        
        // Create a new bubble node for this message
        this.createD3Bubble(messageData);
    }
    
    initializeD3Bubbles() {
        // Clear existing content
        const existingSvg = this.domElements.messageFlow.querySelector('#d3-bubbles');
        if (existingSvg) {
            existingSvg.remove();
        }
        
        // Remove any existing message bubbles
        const bubbles = this.domElements.messageFlow.querySelectorAll('.message-bubble');
        bubbles.forEach(bubble => bubble.remove());
        
        // Clear any existing D3 network
        if (this.d3Svg) {
            this.d3Svg.remove();
            this.d3Svg = null;
            this.d3Simulation = null;
        }
        
        // Create D3 SVG for bubbles - use container dimensions to avoid sidebar
        const container = this.domElements.messageFlow;
        const width = container.clientWidth;
        const height = container.clientHeight;
        
        this.d3BubblesSvg = d3.select(container)
            .append('svg')
            .attr('id', 'd3-bubbles')
            .attr('width', width)
            .attr('height', height)
            .style('position', 'fixed')
            .style('top', '0')
            .style('left', '0')
            .style('width', '100vw')
            .style('height', '100vh')
            .style('z-index', '1');
        
        // Create container groups
        this.d3BubblesContainer = {
            bubbles: this.d3BubblesSvg.append('g').attr('class', 'bubbles'),
            labels: this.d3BubblesSvg.append('g').attr('class', 'labels')
        };
        
        // Initialize bubbles data array
        this.d3BubblesData = [];
        
        // Setup resize handling
        window.addEventListener('resize', () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            this.d3BubblesSvg
                .attr('width', newWidth)
                .attr('height', newHeight);
        });
    }
    
    createD3Bubble(messageData) {
        // Unified Falling Boxes Mode Implementation - Task 5.1 Complete
        if (!this.unifiedContainer) {
            console.warn('Unified container not initialized for falling boxes mode');
            return;
        }
        
        // Process message data using unified MessageProcessor
        const processedMessage = this.messageProcessor.processMessage(messageData);
        
        // Get container and dimensions from unified system
        const container = this.unifiedContainer.getContainer();
        const dimensions = this.unifiedContainer.getDimensions();
        
        // Create LinearAnimation with current bubble direction
        const linearAnimation = new LinearAnimation(
            container, 
            this.bubbleDirection, 
            this.layoutCalculator,
            {
                duration: 15000, // 15 seconds like original
                margin: 100,
                elementSize: { width: 50, height: 50 }
            }
        );
        
        // Calculate starting position using LinearAnimation logic
        const startPos = linearAnimation.getStartPosition(dimensions.width, dimensions.height);
        
        // Create circle using Unified Element System
        const circle = this.elementSystem.createSVGElement(
            container, 
            processedMessage, 
            startPos.x, 
            startPos.y
        );
        
        // Add click handler for message modal
        circle.on('click', () => {
            this.showMessageModal(messageData);
        });
        
        // Track element with unified tracker
        this.elementTracker.trackElement(circle, {
            type: 'linear',
            status: 'animating',
            createdAt: Date.now(),
            messageData: processedMessage
        });
        
        // Register element with cleanup manager for automatic cleanup
        this.cleanupManager.trackElement(circle, {
            type: 'linear',
            onCleanup: () => {
                this.elementTracker.removeElement(circle);
                console.log('CleanupManager: Removed stuck falling element');
            }
        });
        
        // Start linear animation
        linearAnimation.animateSVGElement(
            circle, 
            dimensions.width, 
            dimensions.height,
            () => {
                // Animation complete - untrack element
                this.cleanupManager.untrackElement(circle);
                this.elementTracker.removeElement(circle);
                console.log('LinearAnimation: Element completed and removed');
            }
        );
        
        console.log('LinearAnimation: Started falling element, will travel from', linearAnimation.getStartPosition(dimensions.width, dimensions.height), 'to end position');
        
        console.log('Task 5.1: Created falling circle with direction:', this.bubbleDirection);
    }

    // D3 Radial Implementation (using original DOM bubbles with D3 animation)
    createD3RadialBubble(messageData) {
        // Unified Radial Mode Implementation - Task 5.2 Complete
        if (!this.unifiedContainer) {
            console.warn('Unified container not initialized for radial mode');
            return;
        }
        
        // Respect animation limits for performance
        if (this.activeRadialAnimations >= this.maxRadialAnimations) {
            return; // Skip creation if too many active animations
        }
        
        // Process message data using unified MessageProcessor
        const processedMessage = this.messageProcessor.processMessage(messageData);
        
        // Get container and dimensions from unified system
        const container = this.unifiedContainer.getContainer();
        const dimensions = this.unifiedContainer.getDimensions();
        
        // Create circle using Unified Element System
        const circle = this.elementSystem.createSVGElement(
            container, 
            processedMessage, 
            dimensions.centerX, 
            dimensions.centerY
        );
        
        // Add click handler for message modal
        circle.on('click', () => {
            this.showMessageModal(messageData);
        });
        
        // Track element with unified tracker
        this.elementTracker.trackElement(circle, {
            type: 'radial',
            status: 'animating',
            createdAt: Date.now(),
            messageData: processedMessage
        });
        
        // Register element with cleanup manager for automatic cleanup
        this.cleanupManager.trackElement(circle, {
            type: 'radial',
            onCleanup: () => {
                this.activeRadialAnimations--;
                this.elementTracker.removeElement(circle);
                console.log('CleanupManager: Removed stuck radial element');
            }
        });
        
        // Create RadialAnimation for burst effect
        const radialAnimation = new RadialAnimation(dimensions.centerX, dimensions.centerY, {
            duration: 8000, // 8 seconds like original radial mode
            fadeStartPoint: 0.2, // Start fading at 20% of journey
            elementSize: { width: 50, height: 50 }
        });
        
        // Start radial burst animation using actual window dimensions for proper off-screen detection
        radialAnimation.animateSVGElement(
            circle,
            window.innerWidth,
            window.innerHeight,
            () => {
                // Animation complete - untrack and decrement counter
                this.cleanupManager.untrackElement(circle);
                this.elementTracker.removeElement(circle);
                this.activeRadialAnimations--;
                console.log('RadialAnimation: Element completed and removed');
            }
        );
        
        console.log('RadialAnimation: Started radial burst from center:', dimensions.centerX, dimensions.centerY);
        
        // Increment active animation counter
        this.activeRadialAnimations++;
    }
    

    // Visualization switching
    switchVisualization(mode) {
        if (!mode) {
            // If no mode provided, get from current active button
            const activeBtn = document.querySelector('.viz-icon-btn.active, .viz-mode-btn.active');
            mode = activeBtn ? activeBtn.dataset.mode : 'bubbles';
        }

        // Use the unified mode switching manager for clean transitions
        return this.modeSwitchingManager.switchMode(mode);
    }
    
    // Update active states for visualization buttons
    updateVisualizationButtonStates(activeMode) {
        // Update icon buttons (collapsed sidebar)
        this.domElements.vizIconButtons.forEach(btn => {
            if (btn.dataset.mode === activeMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Update mode buttons (expanded sidebar)
        this.domElements.vizModeButtons.forEach(btn => {
            if (btn.dataset.mode === activeMode) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    
    clearAllVisualizations() {
        // Cancel all active animation frames
        this.animationFramePool.forEach(frameId => {
            cancelAnimationFrame(frameId);
        });
        this.animationFramePool.clear();
        
        // Clear bubbles and return to pool where possible
        const bubbles = document.querySelectorAll('.message-bubble');
        bubbles.forEach(bubble => {
            if (bubble.parentNode) {
                bubble.parentNode.removeChild(bubble);
                if (!this.returnBubbleToPool(bubble)) {
                    bubble.innerHTML = '';
                }
            }
        });
        
        this.activeAnimations.clear();
        this.activeRadialAnimations = 0;
        
        // Clean up unified container (removes all visualizations)
        if (this.unifiedContainer) {
            this.unifiedContainer.cleanup();
        }
        
        // Clear legacy references
        this.d3BubblesSvg = null;
        this.d3BubblesContainer = null;
        this.d3BubblesData = [];
        
        // Clear D3 radial data
        this.d3RadialSvg = null;
        this.d3RadialContainer = null;
        
        // Stop D3 simulation and brightness decay
        if (this.d3Simulation) {
            this.d3Simulation.stop();
            this.d3Simulation = null;
        }
        
        // Stop brightness decay interval
        if (this.brightnessInterval) {
            clearInterval(this.brightnessInterval);
            this.brightnessInterval = null;
        }
        
        // Clear D3 data
        this.d3Nodes = [];
        this.d3Links = [];
        this.d3Svg = null;
        this.d3Container = null;
        
        // Clear old network data structures (legacy)
        if (this.networkNodes) this.networkNodes.clear();
        if (this.networkTopics) this.networkTopics.clear();
        this.networkPulses = [];
        this.networkSvg = null;
        this.brokerNode = null;
        
        // Cleanup resize observer
        if (this.networkResizeObserver) {
            this.networkResizeObserver.disconnect();
            this.networkResizeObserver = null;
        }
        
        // Clear resize timeout
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
    }
    
    resetVisualizationState() {
        // Clear topic and customer color mappings
        this.topicColors.clear();
        this.customerColors.clear();
        this.activeTopics.clear();
        
        // Hide and clear the color legend
        this.domElements.colorLegend.style.display = 'none';
        this.domElements.legendItems.innerHTML = '';
        
        // Reset stats
        this.domElements.activeTopics.textContent = '0';
    }

    // Color Management
    getTopicColor(topic) {
        if (!this.topicColors.has(topic)) {
            const customer = this.extractCustomerFromTopic(topic);
            const color = this.getCustomerColor(customer);
            this.topicColors.set(topic, color);
            this.updateTopicLegend();
        }
        return this.topicColors.get(topic);
    }

    getCustomerColor(customer) {
        if (!this.customerColors.has(customer)) {
            const colors = this.getThemeColors();
            const color = colors[this.customerColors.size % colors.length];
            this.customerColors.set(customer, color);
        }
        
        return this.customerColors.get(customer);
    }

    // Extract color palettes into separate method for better organization
    getThemeColors() {
        const currentTheme = document.body.getAttribute('data-theme') || 'default';
        
        const colorPalettes = {
            dark: [
                '#00FF41', '#00FFFF', '#FF1493', '#FF4500', '#FFFF00',
                '#FF69B4', '#00FA9A', '#FF6347', '#7FFF00', '#00BFFF'
            ],
            spring: [
                '#8BC34A', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7',
                '#C8E6C9', '#E8F5E8', '#FFEB3B', '#FFF176', '#FFECB3'
            ],
            summer: [
                '#FF9800', '#FFB74D', '#FFCC02', '#FFC107', '#FF8F00',
                '#FF6F00', '#E65100', '#FF5722', '#FF7043', '#FFAB40'
            ],
            autumn: [
                '#D2691E', '#CD853F', '#DEB887', '#F4A460', '#DAA520',
                '#B8860B', '#A0522D', '#8B4513', '#FF8C00', '#FF7F50'
            ],
            winter: [
                '#4682B4', '#5F9EA0', '#6495ED', '#87CEEB', '#B0C4DE',
                '#B0E0E6', '#ADD8E6', '#E0F6FF', '#F0F8FF', '#DCDCDC'
            ],
            default: [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
            ]
        };
        
        return colorPalettes[currentTheme] || colorPalettes.default;
    }

    // Z-index management with bounds checking
    getNextZIndex() {
        // Decrement z-index for depth layering (newer cards behind older ones)
        this.messageZIndex--;
        
        // Reset to max when hitting minimum to prevent overflow
        if (this.messageZIndex < this.minZIndex) {
            this.messageZIndex = this.maxZIndex;
        }
    }

    // Utility Functions
    formatPayload(payload) {
        return payload.length > 100 ? payload.substring(0, 100) + '...' : payload;
    }

    formatTime(timestamp) {
        return new Date(timestamp * 1000).toLocaleTimeString();
    }

    extractCustomerFromTopic(topic) {
        return topic.split('/')[0] || topic;
    }
    
    createTopicLabel(topic) {
        const parts = topic.split('/');
        
        // Show only device ID (2nd level) 
        return parts[1] || parts[parts.length - 1] || 'topic';
    }
    
    extractDeviceFromTopic(topic) {
        const parts = topic.split('/');
        
        // Return device ID (2nd level) for grouping
        return parts[1] || parts[parts.length - 1] || 'device';
    }

    // UI Updates - using cached DOM elements for better performance
    updateConnectionStatus(status) {
        this.domElements.status.className = `status ${status.toLowerCase()}`;
        
        const statusConfig = this.getStatusConfig(status.toLowerCase());
        
        this.domElements.status.textContent = statusConfig.statusText;
        this.domElements.connectionStatus.textContent = statusConfig.connectionText;
        this.domElements.connectBtn.textContent = statusConfig.buttonText;
        this.domElements.connectBtn.style.background = statusConfig.buttonColor;
        this.domElements.connectBtn.disabled = statusConfig.buttonDisabled;
    }

    // Extract status configuration for better readability
    getStatusConfig(status) {
        const configs = {
            connected: {
                statusText: '🟢 Connected',
                connectionText: 'Online',
                buttonText: 'Disconnect',
                buttonColor: '#f44336',
                buttonDisabled: false
            },
            connecting: {
                statusText: '🟡 Connecting...',
                connectionText: 'Connecting',
                buttonText: 'Connect',
                buttonColor: '#4CAF50',
                buttonDisabled: true
            },
            disconnected: {
                statusText: '🔴 Disconnected',
                connectionText: 'Offline',
                buttonText: 'Connect',
                buttonColor: '#4CAF50',
                buttonDisabled: false
            }
        };
        
        return configs[status] || configs.disconnected;
    }

    updateStats() {
        // Use cached DOM elements for better performance
        //this.domElements.totalMessages.textContent = this.messageCount;
        this.domElements.messageRate.textContent = this.messageRate.toFixed(1);
        this.domElements.activeTopics.textContent = this.activeTopics.size;
    }

    updateTopicLegend() {
        // Update main content area legend only (sidebar topic list removed)
        this.updateMainLegend();
    }

    updateMainLegend() {
        if (this.customerColors.size === 0) {
            this.domElements.colorLegend.style.display = 'none';
            return;
        }
        
        this.domElements.colorLegend.style.display = 'block';
        this.domElements.legendItems.innerHTML = '';
        
        // Use DocumentFragment for better performance when adding multiple elements
        const fragment = document.createDocumentFragment();
        
        this.customerColors.forEach((color, customer) => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.innerHTML = `
                <div class="legend-color" style="background-color: ${color}"></div>
                <span class="legend-customer">${customer.toUpperCase()}</span>
            `;
            fragment.appendChild(item);
        });
        
        this.domElements.legendItems.appendChild(fragment);
    }


    startStatsUpdate() {
        // Use throttled updates to improve performance
        setInterval(() => {
            this.updateStats();
        }, 1000);
    }

    // API Calls
    async apiCall(endpoint, method = 'GET', data = null) {
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        
        if (data) {
            config.body = JSON.stringify(data);
        }
        
        try {
            const response = await fetch(`/api${endpoint}`, config);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.detail || 'API call failed');
            }
            
            return result;
        } catch (error) {
            console.error('API call error:', error);
            // Better error handling
            if (error.message) {
                throw new Error(error.message);
            }
            throw error;
        }
    }

    // Connection Management
    async toggleConnection() {
        if (this.isConnected) {
            await this.disconnect();
        } else {
            await this.connect();
        }
    }

    async connect() {
        const connectionConfig = this.getConnectionConfig();
        
        if (!connectionConfig.host) {
            alert('Please enter a broker host');
            return;
        }
        
        try {
            // Connect WebSocket first
            this.connectWebSocket();
            
            // Then connect to MQTT
            await this.apiCall('/connect', 'POST', connectionConfig);
            
            console.log('MQTT connection initiated');
        } catch (error) {
            console.error('Connection failed:', error);
            alert('Connection failed: ' + error.message);
            this.updateConnectionStatus('disconnected');
        }
    }

    // Extract connection configuration for better organization
    getConnectionConfig() {
        return {
            host: this.domElements.host.value.trim(),
            port: parseInt(this.domElements.port.value),
            username: this.domElements.username.value.trim() || null,
            password: this.domElements.password.value.trim() || null
        };
    }

    async disconnect() {
        try {
            // First, update UI to show disconnecting state
            this.updateConnectionStatus('disconnected');
            
            // Call backend disconnect
            await this.apiCall('/disconnect', 'POST');
            
            // Give time for status updates to propagate before closing WebSocket
            await new Promise(resolve => setTimeout(resolve, 200));
            
            if (this.websocket) {
                this.websocket.close();
            }
            
            // Reset client state
            this.resetClientState();
            
        } catch (error) {
            console.error('Disconnect failed:', error);
            // Still update UI even if API call fails
            this.updateConnectionStatus('disconnected');
            this.isConnected = false;
        }
    }

    resetClientState() {
        this.isConnected = false;
        //this.messageCount = 0;
        this.activeTopics.clear();
        this.topicColors.clear();
        this.messageHistory = [];
        
        this.updateTopicLegend();
        this.updateStats();
        this.clearAllVisualizations();
        
        // Hide UI elements when disconnected
        this.domElements.statsPanel.style.display = 'none';
    }

    async subscribeToTopic() {
        const topic = this.domElements.topic.value;
        
        if (!topic) {
            alert('Please enter a topic to subscribe to');
            return;
        }
        
        if (!this.isConnected) {
            alert('Please connect to MQTT broker first');
            return;
        }
        
        try {
            await this.apiCall('/subscribe', 'POST', {
                topic,
                qos: 0
            });
            
            console.log('Subscribed to:', topic);
            this.domElements.topic.value = '';
        } catch (error) {
            console.error('Subscription failed:', error);
            alert('Subscription failed: ' + error.message);
        }
    }
    
    detectPassiveSupport() {
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
    
    // Optimized animation frame pooling
    requestOptimizedFrame(callback) {
        const frameId = requestAnimationFrame((timestamp) => {
            this.animationFramePool.delete(frameId);
            callback(timestamp);
        });
        this.animationFramePool.add(frameId);
        return frameId;
    }
    
    cancelOptimizedFrame(frameId) {
        if (this.animationFramePool.has(frameId)) {
            cancelAnimationFrame(frameId);
            this.animationFramePool.delete(frameId);
        }
    }
    
    // Object pooling for message bubbles
    getBubbleFromPool() {
        if (this.bubblePool.length > 0) {
            const bubble = this.bubblePool.pop();
            // Reset bubble properties
            bubble.className = 'message-bubble';
            bubble.style.cssText = '';
            bubble.innerHTML = '';
            bubble.removeAttribute('data-reused');
            return bubble;
        }
        return document.createElement('div');
    }
    
    returnBubbleToPool(bubble) {
        if (this.bubblePool.length < this.maxPoolSize) {
            // Clean up bubble
            bubble.style.display = 'none';
            bubble.innerHTML = '';
            bubble.className = '';
            bubble.setAttribute('data-reused', 'true');
            this.bubblePool.push(bubble);
            return true;
        }
        return false;
    }
    
    startFrameRateMonitoring() {
        let lastStatsUpdate = Date.now();
        
        const updateFrameRate = () => {
            this.frameCount++;
            const now = Date.now();
            const timeDiff = now - lastStatsUpdate;
            
            // Update stats every second
            if (timeDiff >= 1000) {
                const fps = Math.round((this.frameCount * 1000) / timeDiff);
                
                // Update DOM elements directly
                if (this.domElements.frameRate) {
                    this.domElements.frameRate.textContent = fps;
                }
                
                // Use unified element tracker for accurate count
                const activeCards = this.elementTracker ? this.elementTracker.getCounts().total : 0;
                if (this.domElements.activeCards) {
                    this.domElements.activeCards.textContent = activeCards;
                }
                
                this.frameCount = 0;
                lastStatsUpdate = now;
            }
            
            requestAnimationFrame(updateFrameRate);
        };
        
        updateFrameRate();
    }
    
}

// Global functions for HTML onclick handlers
let visualizer;

function toggleConnection() {
    visualizer.toggleConnection();
}

function subscribeToTopic() {
    visualizer.subscribeToTopic();
}

function switchVisualization() {
    visualizer.switchVisualization();
}

function switchTheme() {
    visualizer.switchTheme();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    visualizer = new MQTTVisualizer();
    
});