/**
 * MapVisualization Tests
 *
 * Test suite for the map-based MQTT message visualization
 */

import MapVisualization from './MapVisualization.js';

describe('MapVisualization', () => {
    let mapViz;
    let mockDomManager;
    let mockEventEmitter;
    let mockThemeManager;
    let mockColorLegend;
    let mockContainer;

    beforeEach(() => {
        // Create mock container
        mockContainer = document.createElement('div');
        mockContainer.id = 'messageFlow';
        mockContainer.style.width = '1000px';
        mockContainer.style.height = '800px';
        document.body.appendChild(mockContainer);

        // Create mock managers
        mockDomManager = {
            get: jest.fn((id) => {
                if (id === 'messageFlow') return mockContainer;
                return null;
            })
        };

        mockEventEmitter = {
            on: jest.fn(),
            off: jest.fn(),
            emit: jest.fn()
        };

        mockThemeManager = {
            getCurrentColors: jest.fn(() => [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'
            ])
        };

        mockColorLegend = {
            getCustomerColor: jest.fn((customer) => '#FF6B6B')
        };

        // Create MapVisualization instance
        mapViz = new MapVisualization(
            mockDomManager,
            mockEventEmitter,
            mockThemeManager,
            mockColorLegend
        );
    });

    afterEach(() => {
        if (mapViz) {
            mapViz.destroy();
        }
        document.body.removeChild(mockContainer);
    });

    describe('Initialization', () => {
        test('should initialize successfully', () => {
            mapViz.initialize();
            expect(mapViz.initialized).toBe(true);
        });

        test('should create SVG container', () => {
            mapViz.initialize();
            mapViz.activate();
            const svg = mockContainer.querySelector('svg.map-visualization');
            expect(svg).toBeTruthy();
        });

        test('should create central node', () => {
            mapViz.initialize();
            mapViz.activate();
            expect(mapViz.centralNode).toBeTruthy();
            expect(mapViz.centralNode.id).toBe('central');
        });
    });

    describe('Device Positioning', () => {
        test('should fetch device coordinates from external API', async () => {
            mapViz.initialize();
            mapViz.activate();

            const mockCoordinates = {
                lat: 59.3293,
                lng: 18.0686
            };

            // Mock the API call
            global.fetch = jest.fn(() =>
                Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(mockCoordinates)
                })
            );

            const coords = await mapViz.fetchDeviceCoordinates('customer1', 'device1');
            expect(coords).toEqual(mockCoordinates);
        });

        test('should convert lat/lng to screen coordinates', () => {
            mapViz.initialize();
            mapViz.activate();

            const screenCoords = mapViz.latLngToScreen(59.3293, 18.0686);
            expect(screenCoords.x).toBeGreaterThan(0);
            expect(screenCoords.y).toBeGreaterThan(0);
        });

        test('should position device markers on map', () => {
            mapViz.initialize();
            mapViz.activate();

            const deviceNode = mapViz.createDeviceNode('customer1', 'device1', 59.3293, 18.0686, '#FF6B6B');
            expect(deviceNode).toBeTruthy();
            expect(deviceNode.lat).toBe(59.3293);
            expect(deviceNode.lng).toBe(18.0686);
        });
    });

    describe('Message Flow Animation', () => {
        test('should create flow animation from device to central node', () => {
            mapViz.initialize();
            mapViz.activate();

            const deviceNode = {
                id: 'customer1/device1',
                x: 100,
                y: 100
            };

            const centralNode = {
                id: 'central',
                x: 500,
                y: 400
            };

            mapViz.deviceNodes.set('customer1/device1', deviceNode);
            mapViz.centralNode = centralNode;

            const messageData = {
                topic: 'customer1/device1/sensor/temp',
                payload: '{"temperature": 25}',
                timestamp: Date.now() / 1000,
                qos: 0,
                retain: false
            };

            mapViz.addMessage(messageData);

            // Check that pulse animation was created
            const pulses = mockContainer.querySelectorAll('.message-pulse');
            expect(pulses.length).toBeGreaterThan(0);
        });

        test('should animate pulse along path from device to central', (done) => {
            mapViz.initialize();
            mapViz.activate();

            const deviceNode = {
                id: 'customer1/device1',
                x: 100,
                y: 100
            };

            mapViz.deviceNodes.set('customer1/device1', deviceNode);
            mapViz.centralNode = { id: 'central', x: 500, y: 400 };

            const messageData = {
                topic: 'customer1/device1/sensor',
                payload: '{}',
                timestamp: Date.now() / 1000,
                qos: 0,
                retain: false
            };

            mapViz.addMessage(messageData);

            // Verify animation completes
            setTimeout(() => {
                expect(mockEventEmitter.emit).toHaveBeenCalled();
                done();
            }, 1600); // Slightly longer than animation duration
        });
    });

    describe('Map Projection', () => {
        test('should use Mercator projection by default', () => {
            mapViz.initialize();
            expect(mapViz.projection).toBe('mercator');
        });

        test('should handle multiple devices in different locations', () => {
            mapViz.initialize();
            mapViz.activate();

            const devices = [
                { customer: 'c1', device: 'd1', lat: 59.3293, lng: 18.0686 },
                { customer: 'c1', device: 'd2', lat: 40.7128, lng: -74.0060 },
                { customer: 'c2', device: 'd3', lat: 51.5074, lng: -0.1278 }
            ];

            devices.forEach(d => {
                mapViz.createDeviceNode(d.customer, d.device, d.lat, d.lng, '#FF6B6B');
            });

            expect(mapViz.deviceNodes.size).toBe(3);
        });
    });

    describe('Cleanup', () => {
        test('should clean up all elements on deactivate', () => {
            mapViz.initialize();
            mapViz.activate();

            // Add some devices
            mapViz.createDeviceNode('c1', 'd1', 59.3293, 18.0686, '#FF6B6B');

            mapViz.deactivate();

            expect(mapViz.deviceNodes.size).toBe(0);
            const svg = mockContainer.querySelector('svg.map-visualization');
            expect(svg).toBeFalsy();
        });
    });
});
