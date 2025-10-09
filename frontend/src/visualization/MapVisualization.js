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

        // Create groups for organization (bottom to top rendering order)
        this.linkGroup = this.svg.append('g').attr('class', 'links');
        this.mapGroup = this.svg.append('g').attr('class', 'map-background');
        this.deviceGroup = this.svg.append('g').attr('class', 'devices');
        this.pulseGroup = this.svg.append('g').attr('class', 'pulses');

        // Add simple map background (grid lines)
        this.drawMapBackground();

        console.log('MapVisualization: SVG container created');
    }

    /**
     * Draw simple map background with grid lines
     */
    drawMapBackground() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;

        // Add background rectangle
        this.mapGroup.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'rgba(20, 40, 60, 0.3)')
            .attr('stroke', 'none');

        // Add grid lines
        const gridSpacing = 50;

        // Vertical lines
        for (let x = 0; x < width; x += gridSpacing) {
            this.mapGroup.append('line')
                .attr('x1', x)
                .attr('y1', 0)
                .attr('x2', x)
                .attr('y2', height)
                .attr('stroke', 'rgba(255, 255, 255, 0.1)')
                .attr('stroke-width', 1);
        }

        // Horizontal lines
        for (let y = 0; y < height; y += gridSpacing) {
            this.mapGroup.append('line')
                .attr('x1', 0)
                .attr('y1', y)
                .attr('x2', width)
                .attr('y2', y)
                .attr('stroke', 'rgba(255, 255, 255, 0.1)')
                .attr('stroke-width', 1);
        }
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
     * Convert latitude/longitude to screen coordinates using Mercator projection
     */
    latLngToScreen(lat, lng) {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;

        // Simple Mercator projection
        // Normalize longitude to 0-1 range
        const x = ((lng + 180) / 360) * width;

        // Mercator projection for latitude
        const latRad = (lat * Math.PI) / 180;
        const mercN = Math.log(Math.tan(Math.PI / 4 + latRad / 2));
        const y = (height / 2) - (width * mercN / (2 * Math.PI));

        return { x, y };
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
        this.createCentralNode();

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
     * Destroy the map visualization
     */
    destroy() {
        this.cleanup();
        this.coordinateCache.clear();
        super.destroy();
    }
}

export default MapVisualization;
