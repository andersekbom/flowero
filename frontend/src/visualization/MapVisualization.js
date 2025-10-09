/**
 * Map Visualization Component
 *
 * Displays devices on a geographic map and animates MQTT messages
 * flowing from device locations to a central node.
 *
 * Features:
 * - Geographic positioning of devices based on coordinates from external API
 * - Mercator projection for lat/lng to screen coordinates
 * - Animated message flow from devices to central collection point
 * - Dynamic device discovery and positioning
 * - Support for multiple customers and devices
 */

import { BaseVisualization } from './BaseVisualization.js';

class MapVisualization extends BaseVisualization {
    constructor(domManager, eventEmitter, themeManager, colorLegend, options = {}) {
        super(domManager, eventEmitter, themeManager, options);

        this.colorLegend = colorLegend;
        this.options = {
            ...this.options,
            // Map configuration
            projection: 'mercator',
            centerLat: 55.0, // Default center (Northern Europe)
            centerLng: 15.0,
            zoomLevel: 3,

            // Visual parameters
            deviceRadius: 15,
            centralRadius: 25,
            pulseRadius: 6,
            pulseDuration: 1500,

            // API configuration
            coordinateApiUrl: options.coordinateApiUrl || '/api/device-coordinates',
            coordinateCacheTTL: 3600000, // 1 hour cache

            ...options
        };

        // D3 components
        this.svg = null;
        this.mapGroup = null;
        this.deviceGroup = null;
        this.pulseGroup = null;
        this.linkGroup = null;
        this.zoom = null;

        // D3 geo projection
        this.projection = null;
        this.path = null;
        this.worldData = null;

        // Map data
        this.deviceNodes = new Map();
        this.centralNode = null;
        this.coordinateCache = new Map();

        // Animation state
        this.isRunning = false;

        // Map bounds for projection
        this.mapBounds = {
            minLat: -90,
            maxLat: 90,
            minLng: -180,
            maxLng: 180
        };

        // World map TopoJSON URL
        this.worldAtlasUrl = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json';
    }

    /**
     * Initialize the map visualization system
     */
    initialize() {
        super.initialize();

        if (!this.container) {
            console.error('MapVisualization: No container found after base initialization!');
            return this;
        }

        console.log('MapVisualization: Initialized successfully');
        return this;
    }

    /**
     * Setup D3 SVG container for map
     */
    setupMapContainer() {
        // Remove any existing SVG
        const existingSvg = this.container.querySelector('svg.map-visualization');
        if (existingSvg) {
            existingSvg.remove();
        }

        // Get container dimensions
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;

        // Create SVG with D3
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('class', 'map-visualization')
            .attr('width', width)
            .attr('height', height)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('pointer-events', 'auto')
            .style('z-index', '10');

        // Create main group for zoom/pan transformations
        const zoomGroup = this.svg.append('g').attr('class', 'zoom-group');

        // Create groups for organization (bottom to top rendering order)
        this.mapGroup = zoomGroup.append('g').attr('class', 'map-background');
        this.linkGroup = zoomGroup.append('g').attr('class', 'links');
        this.deviceGroup = zoomGroup.append('g').attr('class', 'devices');
        this.pulseGroup = zoomGroup.append('g').attr('class', 'pulses');

        // Setup zoom and pan
        this.setupZoomPan(zoomGroup);

        // Setup D3 geo projection
        this.setupProjection(width, height);

        // Load and render world map
        this.loadWorldMap();

        console.log('MapVisualization: SVG container created');
    }

    /**
     * Setup D3 geo projection
     */
    setupProjection(width, height) {
        // Use Natural Earth projection for a nice world view
        this.projection = d3.geoNaturalEarth1()
            .scale(width / 6.5)
            .translate([width / 2, height / 2]);

        // Create path generator
        this.path = d3.geoPath().projection(this.projection);
    }

    /**
     * Setup zoom and pan behavior
     */
    setupZoomPan(zoomGroup) {
        // Create zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 8]) // Allow zoom from 50% to 800%
            .on('zoom', (event) => {
                zoomGroup.attr('transform', event.transform);
            });

        // Apply zoom to SVG
        this.svg.call(this.zoom);
    }

    /**
     * Load world map from TopoJSON
     */
    async loadWorldMap() {
        try {
            console.log('MapVisualization: Loading world map...');
            const response = await fetch(this.worldAtlasUrl);
            const world = await response.json();

            // Convert TopoJSON to GeoJSON
            this.worldData = topojson.feature(world, world.objects.countries);

            // Draw the world map
            this.drawWorldMap();

            console.log('MapVisualization: World map loaded successfully');
        } catch (error) {
            console.error('MapVisualization: Failed to load world map:', error);
            // Fall back to simple background
            this.drawFallbackBackground();
        }
    }

    /**
     * Draw world map with theme colors
     */
    drawWorldMap() {
        if (!this.worldData) return;

        // Get current theme colors from CSS variables
        const mapColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--input-bg') || 'rgba(255, 255, 255, 0.1)';
        const borderColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--border-color') || 'rgba(255, 255, 255, 0.2)';

        // Draw countries
        this.mapGroup.selectAll('path')
            .data(this.worldData.features)
            .enter()
            .append('path')
            .attr('d', this.path)
            .attr('fill', mapColor)
            .attr('stroke', borderColor)
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.6)
            .style('transition', 'fill 0.3s ease');
    }

    /**
     * Update map colors when theme changes
     */
    updateMapColors() {
        if (!this.mapGroup) return;

        const mapColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--input-bg') || 'rgba(255, 255, 255, 0.1)';
        const borderColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--border-color') || 'rgba(255, 255, 255, 0.2)';

        this.mapGroup.selectAll('path')
            .transition()
            .duration(300)
            .attr('fill', mapColor)
            .attr('stroke', borderColor);
    }

    /**
     * Draw fallback background if world map fails to load
     */
    drawFallbackBackground() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;

        const mapColor = getComputedStyle(document.documentElement)
            .getPropertyValue('--input-bg') || 'rgba(20, 40, 60, 0.3)';

        // Add background rectangle
        this.mapGroup.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', mapColor)
            .attr('stroke', 'none');
    }

    /**
     * Create central collection node
     */
    createCentralNode() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;

        this.centralNode = {
            id: 'central',
            type: 'central',
            label: 'Broker',
            x: width / 2,
            y: height / 2,
            radius: this.options.centralRadius,
            color: '#ff7300ff'
        };

        // Draw central node
        const centralGroup = this.deviceGroup.append('g')
            .attr('class', 'central-node')
            .attr('transform', `translate(${this.centralNode.x}, ${this.centralNode.y})`);

        centralGroup.append('circle')
            .attr('r', this.centralNode.radius)
            .attr('fill', this.centralNode.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 3)
            .attr('filter', 'drop-shadow(0 0 8px rgba(255, 115, 0, 0.6))');

        centralGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', this.centralNode.radius + 20)
            .attr('fill', 'white')
            .attr('font-size', '14px')
            .attr('font-weight', 'bold')
            .text(this.centralNode.label);
    }

    /**
     * Convert latitude/longitude to screen coordinates using D3 geo projection
     */
    latLngToScreen(lat, lng) {
        if (!this.projection) {
            // Fallback if projection not ready
            const rect = this.container.getBoundingClientRect();
            const width = rect.width || window.innerWidth;
            const height = rect.height || window.innerHeight;

            const x = ((lng + 180) / 360) * width;
            const latRad = (lat * Math.PI) / 180;
            const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
            const y = (height / 2) - (width * mercN / (2 * Math.PI));

            return { x, y };
        }

        // Use D3 projection
        const coords = this.projection([lng, lat]);
        return coords ? { x: coords[0], y: coords[1] } : { x: 0, y: 0 };
    }

    /**
     * Fetch device coordinates from external API
     */
    async fetchDeviceCoordinates(customer, deviceId) {
        const cacheKey = `${customer}/${deviceId}`;

        // Check cache first
        const cached = this.coordinateCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.options.coordinateCacheTTL) {
            return cached.coordinates;
        }

        try {
            const url = `${this.options.coordinateApiUrl}?customer=${encodeURIComponent(customer)}&device=${encodeURIComponent(deviceId)}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const coordinates = await response.json();

            // Cache the result
            this.coordinateCache.set(cacheKey, {
                coordinates,
                timestamp: Date.now()
            });

            return coordinates;
        } catch (error) {
            console.warn(`MapVisualization: Failed to fetch coordinates for ${cacheKey}, using fallback`, error);

            // Fallback: generate deterministic position based on device ID
            return this.generateFallbackCoordinates(customer, deviceId);
        }
    }

    /**
     * Generate fallback coordinates when API is unavailable
     * Creates a deterministic position based on device ID hash
     */
    generateFallbackCoordinates(customer, deviceId) {
        // Simple hash function
        const hash = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32bit integer
            }
            return Math.abs(hash);
        };

        const deviceHash = hash(deviceId);
        const customerHash = hash(customer);

        // Generate coordinates in a reasonable range (Europe/North America)
        const lat = 40 + ((deviceHash % 3000) / 100); // 40-70 degrees
        const lng = -20 + ((customerHash % 8000) / 100); // -20 to 60 degrees

        return { lat, lng };
    }

    /**
     * Create or get device node
     */
    async createDeviceNode(customer, deviceId, lat, lng, color) {
        const nodeId = `${customer}/${deviceId}`;

        if (this.deviceNodes.has(nodeId)) {
            return this.deviceNodes.get(nodeId);
        }

        // Convert geo coordinates to screen coordinates
        const screenCoords = this.latLngToScreen(lat, lng);

        const deviceNode = {
            id: nodeId,
            type: 'device',
            customer,
            deviceId,
            label: deviceId,
            lat,
            lng,
            x: screenCoords.x,
            y: screenCoords.y,
            radius: this.options.deviceRadius,
            color: color,
            messageCount: 0
        };

        this.deviceNodes.set(nodeId, deviceNode);

        // Draw device node
        const deviceGroup = this.deviceGroup.append('g')
            .attr('class', 'device-node')
            .attr('data-device-id', nodeId)
            .attr('transform', `translate(${deviceNode.x}, ${deviceNode.y})`)
            .style('cursor', 'pointer');

        deviceGroup.append('circle')
            .attr('r', deviceNode.radius)
            .attr('fill', deviceNode.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('opacity', 0.9);

        deviceGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', deviceNode.radius + 15)
            .attr('fill', 'white')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
            .text(deviceNode.label);

        // Draw link to central node
        this.linkGroup.append('line')
            .attr('class', `link-${nodeId.replace(/\//g, '-')}`)
            .attr('x1', deviceNode.x)
            .attr('y1', deviceNode.y)
            .attr('x2', this.centralNode.x)
            .attr('y2', this.centralNode.y)
            .attr('stroke', color)
            .attr('stroke-width', 1)
            .attr('opacity', 0.3)
            .attr('stroke-dasharray', '5,5');

        return deviceNode;
    }

    /**
     * Activate the map visualization
     */
    activate() {
        super.activate();
        this.isRunning = true;

        console.log('MapVisualization: Activating...');
        this.setupMapContainer();

        // Wait for projection to be ready before creating central node
        setTimeout(() => {
            this.createCentralNode();
        }, 100);

        console.log('MapVisualization: Activated and ready');
    }

    /**
     * Deactivate the map visualization
     */
    deactivate() {
        super.deactivate();
        this.isRunning = false;
        this.cleanup();
    }

    /**
     * Process new MQTT message
     */
    async addMessage(messageData) {
        if (!this.isRunning || !this.svg) return;

        const processedMessage = this.processMessage(messageData);
        if (!processedMessage) return;

        const customer = processedMessage.customer;
        const deviceId = processedMessage.deviceId;
        const color = this.colorLegend.getCustomerColor(customer);

        // Get or fetch device coordinates
        let deviceNode = this.deviceNodes.get(`${customer}/${deviceId}`);

        if (!deviceNode) {
            // Fetch coordinates from API
            const coordinates = await this.fetchDeviceCoordinates(customer, deviceId);
            deviceNode = await this.createDeviceNode(customer, deviceId, coordinates.lat, coordinates.lng, color);
        }

        // Update message count
        deviceNode.messageCount++;

        // Create pulse animation from device to central node
        this.createMessagePulse(deviceNode, this.centralNode, color);

        // Track performance
        this.performanceMetrics.elementsCreated++;
    }

    /**
     * Create animated pulse from device to central node
     */
    createMessagePulse(fromNode, toNode, color) {
        if (!fromNode || !toNode) return;

        const pulse = this.pulseGroup.append('circle')
            .attr('class', 'message-pulse')
            .attr('r', this.options.pulseRadius)
            .attr('cx', fromNode.x)
            .attr('cy', fromNode.y)
            .attr('fill', color)
            .attr('opacity', 0.8)
            .style('filter', 'drop-shadow(0 0 4px rgba(255,255,255,0.6))');

        // Animate pulse to central node
        pulse.transition()
            .duration(this.options.pulseDuration)
            .ease(d3.easeCubicInOut)
            .attr('cx', toNode.x)
            .attr('cy', toNode.y)
            .attr('opacity', 0)
            .on('end', () => {
                pulse.remove();
            });
    }

    /**
     * Clean up all map elements
     */
    cleanup() {
        if (this.svg) {
            this.svg.selectAll('*').remove();
            this.svg.remove();
            this.svg = null;
        }

        // Clear data structures
        this.deviceNodes.clear();
        this.centralNode = null;

        super.cleanup();
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...super.getState(),
            isRunning: this.isRunning,
            deviceCount: this.deviceNodes.size,
            coordinateCacheSize: this.coordinateCache.size
        };
    }

    /**
     * Handle theme changes
     */
    handleThemeChange(themeData) {
        super.handleThemeChange(themeData);

        // Update map colors to match new theme
        this.updateMapColors();
    }

    /**
     * Destroy the map visualization
     */
    destroy() {
        this.cleanup();
        this.coordinateCache.clear();
        super.destroy();
    }
}

export default MapVisualization;
