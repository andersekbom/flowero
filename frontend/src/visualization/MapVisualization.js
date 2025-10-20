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
import DeviceSimulator from '../simulation/DeviceSimulator.js';

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

            // Simulation mode
            useSimulation: options.useSimulation !== undefined ? options.useSimulation : true,
            simulationMode: options.simulationMode || 'global', // 'global', 'regional', 'cluster'

            ...options
        };

        // Device simulator for randomized coordinates
        this.deviceSimulator = new DeviceSimulator({
            mode: this.options.simulationMode
        });

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

        // Resize handler
        this.resizeHandler = null;

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

        // Get full viewport dimensions
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Create SVG with D3 to fill entire screen
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('class', 'map-visualization')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet')
            .style('position', 'fixed')
            .style('top', '0')
            .style('left', '0')
            .style('width', '100vw')
            .style('height', '100vh')
            .style('pointer-events', 'auto')
            .style('z-index', '1');

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

        // Draw countries
        this.mapGroup.selectAll('path')
            .data(this.worldData.features)
            .enter()
            .append('path')
            .attr('d', this.path)
            .attr('fill', mapColor)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.5)
            .attr('stroke-opacity', 0.5)
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

        this.mapGroup.selectAll('path')
            .transition()
            .duration(300)
            .attr('fill', mapColor)
            .attr('stroke', '#ffffff')
            .attr('stroke-opacity', 0.5);
    }

    /**
     * Draw fallback background if world map fails to load
     */
    drawFallbackBackground() {
        const width = window.innerWidth;
        const height = window.innerHeight;

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
        // Stockholm, Sweden coordinates
        const stockholmLat = 59.3293;
        const stockholmLng = 18.0686;

        // Convert Stockholm coordinates to screen position
        const screenCoords = this.latLngToScreen(stockholmLat, stockholmLng);

        const starSize = 12; // Small star size

        this.centralNode = {
            id: 'central',
            type: 'central',
            label: 'Broker',
            lat: stockholmLat,
            lng: stockholmLng,
            x: screenCoords.x,
            y: screenCoords.y,
            size: starSize,
            color: '#ff7300ff'
        };

        // Draw central node as a star
        const centralGroup = this.deviceGroup.append('g')
            .attr('class', 'central-node')
            .attr('transform', `translate(${this.centralNode.x}, ${this.centralNode.y})`);

        // Create 5-pointed star path
        const starPath = this.createStarPath(starSize);

        centralGroup.append('path')
            .attr('d', starPath)
            .attr('fill', this.centralNode.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .attr('filter', 'drop-shadow(0 0 6px rgba(255, 115, 0, 0.8))');

        centralGroup.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', starSize + 18)
            .attr('fill', 'white')
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
            .text(this.centralNode.label);
    }

    /**
     * Create a 5-pointed star SVG path
     * @param {number} size - Outer radius of the star
     * @returns {string} SVG path string
     */
    createStarPath(size) {
        const points = 5;
        const innerRadius = size * 0.4;
        const outerRadius = size;
        let path = '';

        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (Math.PI * i) / points - Math.PI / 2;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            if (i === 0) {
                path += `M ${x} ${y}`;
            } else {
                path += ` L ${x} ${y}`;
            }
        }

        path += ' Z';
        return path;
    }

    /**
     * Convert latitude/longitude to screen coordinates using D3 geo projection
     */
    latLngToScreen(lat, lng) {
        if (!this.projection) {
            // Fallback if projection not ready
            const width = window.innerWidth;
            const height = window.innerHeight;

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
     * Extract latitude and longitude from MQTT message payload
     * Looks for Field 30001 (latitude) and Field 30002 (longitude) in the points array
     * @param {Object} messageData - MQTT message data
     * @returns {Object|null} {lat, lng} if found, null otherwise
     */
    extractCoordinatesFromPayload(messageData) {
        if (!messageData || !messageData.payload) {
            return null;
        }

        let payload;
        try {
            // Parse payload if it's a string
            payload = typeof messageData.payload === 'string'
                ? JSON.parse(messageData.payload)
                : messageData.payload;
        } catch (error) {
            console.warn('MapVisualization: Failed to parse payload', error);
            return null;
        }

        // Check if payload has points array
        if (!payload.points || !Array.isArray(payload.points)) {
            return null;
        }

        // Look for latitude (field 30001) and longitude (field 30002)
        let lat = null;
        let lng = null;

        for (const point of payload.points) {
            if (point.field === 30001) {
                lat = parseFloat(point.value);
            } else if (point.field === 30002) {
                lng = parseFloat(point.value);
            }

            // Early exit if both found
            if (lat !== null && lng !== null) {
                break;
            }
        }

        // Validate coordinates if found
        if (lat !== null && lng !== null) {
            // Check if coordinates are within valid ranges
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                console.log(`MapVisualization: Extracted coordinates from payload: lat=${lat}, lng=${lng}`);
                return { lat, lng };
            } else {
                console.warn(`MapVisualization: Invalid coordinates in payload: lat=${lat}, lng=${lng}`);
            }
        }

        return null;
    }

    /**
     * Fetch device coordinates from external API or simulation
     */
    async fetchDeviceCoordinates(customer, deviceId) {
        const cacheKey = `${customer}/${deviceId}`;

        // Check cache first
        const cached = this.coordinateCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < this.options.coordinateCacheTTL) {
            return cached.coordinates;
        }

        // Use simulation mode if enabled
        if (this.options.useSimulation) {
            const coordinates = this.deviceSimulator.generateCoordinates(customer, deviceId);

            // Cache the simulated result
            this.coordinateCache.set(cacheKey, {
                coordinates,
                timestamp: Date.now()
            });

            console.log(`MapVisualization: Generated simulated coordinates for ${cacheKey}:`, coordinates);
            return coordinates;
        }

        // Otherwise try to fetch from API
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
     * Fetch and update device position from external platform
     * This method is called when a message from a new device is received
     * @param {string} customer - Customer identifier
     * @param {string} deviceId - Device identifier
     * @returns {Promise<Object>} Updated device position {lat, lng} or null if failed
     */
    async fetchAndUpdateDevicePosition(customer, deviceId) {
        const nodeId = `${customer}/${deviceId}`;

        console.log(`MapVisualization: Fetching position for device ${nodeId} from external platform`);

        try {
            // Construct API URL for external platform
            const url = `${this.options.coordinateApiUrl}?customer=${encodeURIComponent(customer)}&device=${encodeURIComponent(deviceId)}`;

            // Fetch device position from external platform with timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Validate response data
            if (!data || typeof data.lat !== 'number' || typeof data.lng !== 'number') {
                throw new Error('Invalid coordinate data received from platform');
            }

            // Validate coordinate ranges
            if (data.lat < -90 || data.lat > 90 || data.lng < -180 || data.lng > 180) {
                throw new Error(`Invalid coordinates: lat=${data.lat}, lng=${data.lng}`);
            }

            const newPosition = {
                lat: data.lat,
                lng: data.lng
            };

            console.log(`MapVisualization: Received position for ${nodeId}:`, newPosition);

            // Update cache with fresh data
            this.coordinateCache.set(nodeId, {
                coordinates: newPosition,
                timestamp: Date.now()
            });

            // If device already exists, update its position
            const existingDevice = this.deviceNodes.get(nodeId);
            if (existingDevice) {
                await this.updateDevicePosition(nodeId, newPosition);
            }

            return newPosition;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.warn(`MapVisualization: Timeout fetching position for ${nodeId}`);
            } else {
                console.error(`MapVisualization: Error fetching position for ${nodeId}:`, error.message);
            }

            // Return null to indicate failure - caller should handle fallback
            return null;
        }
    }

    /**
     * Update an existing device's position on the map
     * @param {string} nodeId - Device node identifier (customer/deviceId)
     * @param {Object} newPosition - New position {lat, lng}
     */
    async updateDevicePosition(nodeId, newPosition) {
        const deviceNode = this.deviceNodes.get(nodeId);
        if (!deviceNode) {
            console.warn(`MapVisualization: Cannot update position - device ${nodeId} not found`);
            return;
        }

        console.log(`MapVisualization: Updating position for ${nodeId} from [${deviceNode.lat}, ${deviceNode.lng}] to [${newPosition.lat}, ${newPosition.lng}]`);

        // Update device node coordinates
        deviceNode.lat = newPosition.lat;
        deviceNode.lng = newPosition.lng;

        // Calculate new screen coordinates
        const screenCoords = this.latLngToScreen(newPosition.lat, newPosition.lng);
        deviceNode.x = screenCoords.x;
        deviceNode.y = screenCoords.y;

        // Animate device to new position
        const deviceGroup = this.deviceGroup.select(`[data-device-id="${nodeId}"]`);
        if (!deviceGroup.empty()) {
            deviceGroup.transition()
                .duration(1000)
                .ease(d3.easeCubicInOut)
                .attr('transform', `translate(${deviceNode.x}, ${deviceNode.y})`);
        }

        // Animate link to new position
        const linkClass = `.link-${nodeId.replace(/\//g, '-')}`;
        const link = this.linkGroup.select(linkClass);
        if (!link.empty()) {
            link.transition()
                .duration(1000)
                .ease(d3.easeCubicInOut)
                .attr('x1', deviceNode.x)
                .attr('y1', deviceNode.y);
        }

        console.log(`MapVisualization: Device ${nodeId} position updated successfully`);
    }

    /**
     * Refresh positions for all devices from external platform
     * Useful for periodic updates or manual refresh
     * @returns {Promise<Object>} Summary of refresh operation
     */
    async refreshAllDevicePositions() {
        console.log('MapVisualization: Refreshing positions for all devices');

        const results = {
            total: this.deviceNodes.size,
            updated: 0,
            failed: 0,
            errors: []
        };

        // Create array of fetch promises
        const fetchPromises = [];

        for (const [nodeId, deviceNode] of this.deviceNodes.entries()) {
            const promise = this.fetchAndUpdateDevicePosition(deviceNode.customer, deviceNode.deviceId)
                .then(position => {
                    if (position) {
                        results.updated++;
                    } else {
                        results.failed++;
                        results.errors.push(`Failed to update ${nodeId}`);
                    }
                })
                .catch(error => {
                    results.failed++;
                    results.errors.push(`Error updating ${nodeId}: ${error.message}`);
                });

            fetchPromises.push(promise);
        }

        // Wait for all fetches to complete
        await Promise.allSettled(fetchPromises);

        console.log(`MapVisualization: Position refresh complete. Updated: ${results.updated}, Failed: ${results.failed}`);

        return results;
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
     * Handle window resize
     */
    handleResize() {
        if (!this.svg || !this.isRunning) return;

        const width = window.innerWidth;
        const height = window.innerHeight;

        // Update viewBox
        this.svg.attr('viewBox', `0 0 ${width} ${height}`);

        // Update projection
        this.setupProjection(width, height);

        // Redraw map with new projection
        if (this.worldData) {
            this.mapGroup.selectAll('path').attr('d', this.path);
        }

        // Update central node position (recalculate from Stockholm coordinates)
        if (this.centralNode) {
            const screenCoords = this.latLngToScreen(this.centralNode.lat, this.centralNode.lng);
            this.centralNode.x = screenCoords.x;
            this.centralNode.y = screenCoords.y;
            this.deviceGroup.select('.central-node')
                .attr('transform', `translate(${this.centralNode.x}, ${this.centralNode.y})`);
        }

        // Update device positions
        this.deviceNodes.forEach((deviceNode) => {
            const screenCoords = this.latLngToScreen(deviceNode.lat, deviceNode.lng);
            deviceNode.x = screenCoords.x;
            deviceNode.y = screenCoords.y;

            // Update device node position
            this.deviceGroup.select(`[data-device-id="${deviceNode.id}"]`)
                .attr('transform', `translate(${deviceNode.x}, ${deviceNode.y})`);

            // Update link
            this.linkGroup.select(`.link-${deviceNode.id.replace(/\//g, '-')}`)
                .attr('x1', deviceNode.x)
                .attr('y1', deviceNode.y)
                .attr('x2', this.centralNode.x)
                .attr('y2', this.centralNode.y);
        });
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

        // Setup resize handler
        this.resizeHandler = () => this.handleResize();
        window.addEventListener('resize', this.resizeHandler);

        console.log('MapVisualization: Activated and ready');
    }

    /**
     * Deactivate the map visualization
     */
    deactivate() {
        super.deactivate();
        this.isRunning = false;

        // Remove resize handler
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }

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
        const nodeId = `${customer}/${deviceId}`;

        // Get or create device node
        let deviceNode = this.deviceNodes.get(nodeId);

        if (!deviceNode) {
            // New device detected - generate random coordinates
            console.log(`MapVisualization: New device detected: ${nodeId}`);

            // Use simulated random coordinates
            const coordinates = await this.fetchDeviceCoordinates(customer, deviceId);

            // Create the device node on the map
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
     * Toggle simulation mode on/off
     */
    setSimulationMode(enabled) {
        this.options.useSimulation = enabled;
        console.log(`MapVisualization: Simulation mode ${enabled ? 'enabled' : 'disabled'}`);

        // Clear cache to regenerate coordinates
        this.coordinateCache.clear();
        if (this.deviceSimulator) {
            this.deviceSimulator.clearCache();
        }
    }

    /**
     * Set simulation distribution mode
     * @param {string} mode - 'global', 'regional', or 'cluster'
     */
    setSimulationDistribution(mode) {
        if (!['global', 'regional', 'cluster'].includes(mode)) {
            console.warn(`MapVisualization: Invalid simulation mode "${mode}"`);
            return;
        }

        this.options.simulationMode = mode;
        if (this.deviceSimulator) {
            this.deviceSimulator.setMode(mode);
        }

        console.log(`MapVisualization: Simulation distribution set to ${mode}`);

        // Clear caches to regenerate with new distribution
        this.coordinateCache.clear();
    }

    /**
     * Get simulation statistics
     */
    getSimulationStats() {
        if (!this.deviceSimulator) {
            return null;
        }

        return {
            enabled: this.options.useSimulation,
            mode: this.options.simulationMode,
            stats: this.deviceSimulator.getStats()
        };
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...super.getState(),
            isRunning: this.isRunning,
            deviceCount: this.deviceNodes.size,
            coordinateCacheSize: this.coordinateCache.size,
            simulationEnabled: this.options.useSimulation,
            simulationMode: this.options.simulationMode
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
