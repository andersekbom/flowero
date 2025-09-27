/**
 * Container System
 *
 * Unified SVG container management for all visualization modes.
 * Handles container initialization, dimensions, filters, and cleanup.
 */

class ContainerSystem {
    constructor(parentElement) {
        this.parentElement = parentElement;
        this.svg = null;
        this.containerGroup = null;
        this.width = 0;
        this.height = 0;
        this.centerX = 0;
        this.centerY = 0;
    }

    /**
     * Initialize the container with optional layout calculator
     * @param {Object} layoutCalculator - Optional layout calculator for dimensions
     * @returns {ContainerSystem} This instance for chaining
     */
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

    /**
     * Update container dimensions based on layout calculator or parent element
     * @param {Object} layoutCalculator - Optional layout calculator
     */
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

    /**
     * Add SVG filters for glow and text shadow effects
     */
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

    /**
     * Get the main container group for element placement
     * @returns {Object} D3 selection of the container group
     */
    getContainer() {
        return this.containerGroup;
    }

    /**
     * Get current container dimensions and center coordinates
     * @returns {Object} Dimensions object with width, height, centerX, centerY
     */
    getDimensions() {
        return {
            width: this.width,
            height: this.height,
            centerX: this.centerX,
            centerY: this.centerY
        };
    }

    /**
     * Clean up all visualization containers and DOM elements
     */
    cleanup() {
        // Remove all existing visualization containers
        const existingContainers = [
            '#d3-bubbles',
            '#d3-network',
            '#unified-visualization'
        ];

        existingContainers.forEach(id => {
            const element = this.parentElement.querySelector(id);
            if (element) {
                element.remove();
            }
        });

        // Clear DOM message bubbles
        const bubbles = this.parentElement.querySelectorAll('.message-bubble');
        bubbles.forEach(bubble => bubble.remove());
    }

    /**
     * Get the SVG element
     * @returns {Object} D3 selection of the SVG element
     */
    getSVG() {
        return this.svg;
    }

    /**
     * Check if container is initialized
     * @returns {boolean} True if container is ready for use
     */
    isInitialized() {
        return this.svg !== null && this.containerGroup !== null;
    }

    /**
     * Resize container to new dimensions
     * @param {number} width - New width
     * @param {number} height - New height
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.centerX = width / 2;
        this.centerY = height / 2;

        if (this.svg) {
            this.svg
                .attr('width', this.width)
                .attr('height', this.height);
        }
    }
}

export default ContainerSystem;