/**
 * Linear Animation
 *
 * Handles linear directional animations for visualization elements.
 * Supports both SVG (D3) and DOM element animations with customizable directions
 * and automatic start/end position calculations.
 */
class LinearAnimation {
    constructor(container, direction, layoutCalculator = null, options = {}) {
        this.container = container;
        this.direction = direction; // { x: 0, y: 1 } for down, { x: -1, y: 0 } for left, etc.
        this.layoutCalculator = layoutCalculator;

        // Default options
        this.options = {
            duration: 11250, // Reduced by 25% for increased acceleration (was 15000)
            margin: 100,
            elementSize: { width: 50, height: 50 }, // For positioning calculations
            ...options
        };
    }

    /**
     * Calculate start position based on direction
     * @param {number} containerWidth - Container width
     * @param {number} containerHeight - Container height
     * @returns {Object} Start position with x and y coordinates
     */
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

    /**
     * Calculate end position based on direction and travel distance
     * @param {number} startX - Starting X coordinate
     * @param {number} startY - Starting Y coordinate
     * @param {number} containerWidth - Container width
     * @param {number} containerHeight - Container height
     * @returns {Object} End position with x and y coordinates
     */
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

    /**
     * Animate SVG element using D3 transition
     * @param {Object} svgGroup - D3 SVG group element
     * @param {number} containerWidth - Container width
     * @param {number} containerHeight - Container height
     * @param {Function} onComplete - Completion callback
     * @returns {Object} Start and end positions
     */
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

    /**
     * Animate DOM element using CSS transforms
     * @param {Element} element - DOM element to animate
     * @param {number} containerWidth - Container width
     * @param {number} containerHeight - Container height
     * @param {Function} onComplete - Completion callback
     * @returns {Object} Start and end positions
     */
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

export default LinearAnimation;