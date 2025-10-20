/**
 * Device Simulator
 *
 * Generates randomized geographic coordinates for devices when no real
 * location data is available. Creates realistic distributions across
 * the world with configurable regions and clustering.
 */
class DeviceSimulator {
    constructor(options = {}) {
        this.options = {
            // Coordinate generation mode: 'global', 'regional', 'cluster'
            mode: options.mode || 'global',

            // Seed for deterministic randomization (null = truly random)
            seed: options.seed || null,

            // Region constraints (for 'regional' mode)
            regionBounds: options.regionBounds || {
                minLat: -60,  // Excludes Antarctica
                maxLat: 75,   // Includes most populated areas
                minLng: -180,
                maxLng: 180
            },

            // Cluster configuration (for 'cluster' mode)
            clusters: options.clusters || [
                { name: 'Europe', lat: 50, lng: 10, radius: 20 },
                { name: 'North America', lat: 40, lng: -100, radius: 25 },
                { name: 'Asia', lat: 30, lng: 100, radius: 30 },
                { name: 'South America', lat: -15, lng: -60, radius: 20 },
                { name: 'Africa', lat: 0, lng: 20, radius: 25 },
                { name: 'Oceania', lat: -25, lng: 135, radius: 15 }
            ],

            ...options
        };

        // Random number generator state
        this.rngState = this.options.seed || Date.now();

        // Cache for generated coordinates
        this.coordinateCache = new Map();
    }

    /**
     * Generate coordinates for a device
     * Uses device ID for deterministic generation if seed is set
     * @param {string} customer - Customer identifier
     * @param {string} deviceId - Device identifier
     * @returns {Object} {lat, lng} coordinates
     */
    generateCoordinates(customer, deviceId) {
        const cacheKey = `${customer}/${deviceId}`;

        // Check cache first
        if (this.coordinateCache.has(cacheKey)) {
            return this.coordinateCache.get(cacheKey);
        }

        // Generate based on mode
        let coordinates;
        switch (this.options.mode) {
            case 'cluster':
                coordinates = this.generateClusteredCoordinates(customer, deviceId);
                break;
            case 'regional':
                coordinates = this.generateRegionalCoordinates(customer, deviceId);
                break;
            case 'global':
            default:
                coordinates = this.generateGlobalCoordinates(customer, deviceId);
                break;
        }

        // Cache the result
        this.coordinateCache.set(cacheKey, coordinates);

        return coordinates;
    }

    /**
     * Generate truly global random coordinates
     */
    generateGlobalCoordinates(customer, deviceId) {
        const deviceSeed = this.hashString(`${customer}-${deviceId}`);

        // Generate latitude (-90 to 90, but weight towards populated areas)
        const latRandom = this.seededRandom(deviceSeed);
        let lat = (latRandom - 0.5) * 180;

        // Apply population weighting (avoid poles)
        lat = lat * Math.abs(Math.cos(lat * Math.PI / 180)) * 1.5;
        lat = Math.max(-75, Math.min(75, lat));

        // Generate longitude (-180 to 180)
        const lngRandom = this.seededRandom(deviceSeed + 1);
        const lng = (lngRandom - 0.5) * 360;

        return {
            lat: parseFloat(lat.toFixed(6)),
            lng: parseFloat(lng.toFixed(6))
        };
    }

    /**
     * Generate coordinates within specified regional bounds
     */
    generateRegionalCoordinates(customer, deviceId) {
        const deviceSeed = this.hashString(`${customer}-${deviceId}`);
        const { minLat, maxLat, minLng, maxLng } = this.options.regionBounds;

        const latRandom = this.seededRandom(deviceSeed);
        const lat = minLat + (latRandom * (maxLat - minLat));

        const lngRandom = this.seededRandom(deviceSeed + 1);
        const lng = minLng + (lngRandom * (maxLng - minLng));

        return {
            lat: parseFloat(lat.toFixed(6)),
            lng: parseFloat(lng.toFixed(6))
        };
    }

    /**
     * Generate coordinates around predefined cluster centers
     */
    generateClusteredCoordinates(customer, deviceId) {
        const deviceSeed = this.hashString(`${customer}-${deviceId}`);

        // Select a cluster (use customer hash for consistency per customer)
        const customerSeed = this.hashString(customer);
        const clusterIndex = Math.floor(this.seededRandom(customerSeed) * this.options.clusters.length);
        const cluster = this.options.clusters[clusterIndex];

        // Generate offset from cluster center
        const angle = this.seededRandom(deviceSeed) * 2 * Math.PI;
        const distance = this.seededRandom(deviceSeed + 1) * cluster.radius;

        // Convert polar to cartesian (approximate, works for small distances)
        const latOffset = (distance * Math.cos(angle)) / 111; // 1 degree ≈ 111 km
        const lngOffset = (distance * Math.sin(angle)) / (111 * Math.cos(cluster.lat * Math.PI / 180));

        const lat = cluster.lat + latOffset;
        const lng = cluster.lng + lngOffset;

        // Ensure within valid bounds
        const clampedLat = Math.max(-90, Math.min(90, lat));
        const clampedLng = ((lng + 180) % 360) - 180; // Wrap longitude

        return {
            lat: parseFloat(clampedLat.toFixed(6)),
            lng: parseFloat(clampedLng.toFixed(6))
        };
    }

    /**
     * Hash a string to a number (for deterministic randomization)
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Seeded random number generator (0 to 1)
     * Uses linear congruential generator algorithm
     */
    seededRandom(seed) {
        const x = Math.sin(seed) * 10000;
        return x - Math.floor(x);
    }

    /**
     * Get all generated coordinates
     */
    getAllCoordinates() {
        return new Map(this.coordinateCache);
    }

    /**
     * Clear coordinate cache
     */
    clearCache() {
        this.coordinateCache.clear();
    }

    /**
     * Update simulation mode
     */
    setMode(mode) {
        this.options.mode = mode;
        this.clearCache();
    }

    /**
     * Get statistics about generated coordinates
     */
    getStats() {
        const coords = Array.from(this.coordinateCache.values());

        if (coords.length === 0) {
            return {
                count: 0,
                latRange: null,
                lngRange: null
            };
        }

        const lats = coords.map(c => c.lat);
        const lngs = coords.map(c => c.lng);

        return {
            count: coords.length,
            latRange: {
                min: Math.min(...lats),
                max: Math.max(...lats)
            },
            lngRange: {
                min: Math.min(...lngs),
                max: Math.max(...lngs)
            }
        };
    }
}

export default DeviceSimulator;
