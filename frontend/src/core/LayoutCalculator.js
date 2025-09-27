/**
 * Layout Calculator
 *
 * Handles sidebar-aware layout calculations and coordinate transformations.
 * Provides methods for calculating effective container dimensions, positioning offsets,
 * and coordinate conversions between container and viewport space.
 */
class LayoutCalculator {
    constructor(containerElement) {
        this.containerElement = containerElement;
        this.sidebarCollapsedWidth = 60;
        this.sidebarExpandedWidth = 300;
    }

    /**
     * Detect current sidebar state
     * @returns {Object} Sidebar state with isCollapsed and width properties
     */
    getSidebarState() {
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) {
            return { isCollapsed: true, width: 0 }; // No sidebar
        }

        const isCollapsed = sidebar.classList.contains('collapsed');
        const width = isCollapsed ? this.sidebarCollapsedWidth : this.sidebarExpandedWidth;

        return { isCollapsed, width };
    }

    /**
     * Calculate effective container dimensions excluding sidebar
     * @returns {Object} Dimensions object with width, height, center coordinates, etc.
     */
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

    /**
     * Get positioning offset for elements (sidebar compensation)
     * @returns {Object} Offset object with x and y properties
     */
    getPositionOffset() {
        const sidebarState = this.getSidebarState();

        return {
            x: sidebarState.width, // Offset elements by sidebar width
            y: 0 // No vertical offset needed
        };
    }

    /**
     * Convert container-relative coordinates to viewport coordinates
     * @param {number} x - Container-relative x coordinate
     * @param {number} y - Container-relative y coordinate
     * @returns {Object} Viewport coordinates
     */
    containerToViewport(x, y) {
        const offset = this.getPositionOffset();
        return {
            x: x + offset.x,
            y: y + offset.y
        };
    }

    /**
     * Convert viewport coordinates to container-relative coordinates
     * @param {number} x - Viewport x coordinate
     * @param {number} y - Viewport y coordinate
     * @returns {Object} Container-relative coordinates
     */
    viewportToContainer(x, y) {
        const offset = this.getPositionOffset();
        return {
            x: x - offset.x,
            y: y - offset.y
        };
    }

    /**
     * Get safe bounds for element positioning (with margins)
     * @param {number} margin - Margin from container edges (default: 50)
     * @returns {Object} Safe bounds object
     */
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

    /**
     * Check if coordinates are within effective container bounds
     * @param {number} x - X coordinate to check
     * @param {number} y - Y coordinate to check
     * @param {number} buffer - Buffer zone around bounds (default: 0)
     * @returns {boolean} True if coordinates are within bounds
     */
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

export default LayoutCalculator;