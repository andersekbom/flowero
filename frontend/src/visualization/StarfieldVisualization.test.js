/**
 * Test file for D3 Starfield Visualization System
 * Run with: node StarfieldVisualization.test.js
 */

// Mock D3.js with proper chaining
const createMockSelection = () => ({
    append: (tag) => createMockSelection(),
    attr: (name, value) => createMockSelection(),
    style: (name, value) => createMockSelection(),
    remove: () => createMockSelection(),
    selectAll: (selector) => createMockSelection(),
    select: (selector) => createMockSelection(),
    node: () => null,
    on: (event, handler) => createMockSelection(),
    transition: () => createMockSelection(),
    duration: (time) => createMockSelection(),
    ease: (easing) => createMockSelection(),
    empty: () => false
});

global.d3 = {
    select: (selector) => createMockSelection(),
    easeQuadIn: 'easeQuadIn',
    easeLinear: 'easeLinear'
};

// Mock DOM and browser APIs
global.document = {
    createElement: (tag) => ({
        className: '',
        style: {},
        textContent: '',
        appendChild: () => {},
        querySelector: () => null,
        querySelectorAll: () => []
    }),
    createElementNS: (namespace, tag) => ({
        setAttribute: () => {},
        style: {},
        textContent: '',
        appendChild: () => {}
    })
};

global.window = {
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.requestAnimationFrame = (callback) => {
    setTimeout(callback, 16);
    return Math.floor(Math.random() * 1000);
};

global.cancelAnimationFrame = (id) => {
    // Mock implementation - in tests we don't need to actually cancel
};

// Mock DOM Manager
class MockDOMManager {
    constructor() {
        this.elements = {
            messageFlow: {
                clientWidth: 800,
                clientHeight: 600,
                getBoundingClientRect: () => ({ width: 800, height: 600 }),
                querySelector: () => null,
                querySelectorAll: () => [],
                appendChild: () => {}
            }
        };
    }

    get(elementId) {
        return this.elements[elementId] || null;
    }
}

// Mock Event Emitter
class MockEventEmitter {
    constructor() {
        this.listeners = new Map();
    }

    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(handler);
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(handler => handler(data));
        }
    }

    off() {}
}

// Mock Theme Manager
class MockThemeManager {
    getCurrentColors() {
        return ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    }
}

// Mock Color Legend
class MockColorLegend {
    constructor() {
        this.customerColors = new Map();
        this.colorIndex = 0;
        this.colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
    }

    getCustomerColor(customer) {
        if (!this.customerColors.has(customer)) {
            const color = this.colors[this.colorIndex % this.colors.length];
            this.customerColors.set(customer, color);
            this.colorIndex++;
        }
        return this.customerColors.get(customer);
    }
}

// Import the class to test
import StarfieldVisualization from './StarfieldVisualization.js';

// Test Suite
class StarfieldVisualizationTests {
    constructor() {
        this.testCount = 0;
        this.passedCount = 0;
        this.failedCount = 0;
    }

    // Test helper method
    test(testName, testFunction) {
        this.testCount++;
        console.log(`\n🧪 Running test: ${testName}`);

        try {
            testFunction();
            this.passedCount++;
            console.log(`✅ PASSED: ${testName}`);
        } catch (error) {
            this.failedCount++;
            console.log(`❌ FAILED: ${testName}`);
            console.error(`   Error: ${error.message}`);
            console.error(error.stack);
        }
    }

    // Assertion helper
    assert(condition, message) {
        if (!condition) {
            throw new Error(message || 'Assertion failed');
        }
    }

    // Run all tests
    runAllTests() {
        console.log('🌟 Starting StarfieldVisualization Tests...\n');

        this.testInitialization();
        this.testMessageProcessing();
        this.testStarCreation();
        this.testAnimationCalculations();
        this.testCleanup();
        this.testThemeChanges();

        // Print summary
        console.log('\n📊 Test Summary:');
        console.log(`   Total tests: ${this.testCount}`);
        console.log(`   Passed: ${this.passedCount}`);
        console.log(`   Failed: ${this.failedCount}`);

        if (this.failedCount === 0) {
            console.log('🎉 All tests passed!');
        } else {
            console.log('💥 Some tests failed. Please check the output above.');
        }

        return this.failedCount === 0;
    }

    // Test: Initialization
    testInitialization() {
        this.test('StarfieldVisualization should initialize correctly', () => {
            const mockDOMManager = new MockDOMManager();
            const mockEventEmitter = new MockEventEmitter();
            const mockThemeManager = new MockThemeManager();
            const mockColorLegend = new MockColorLegend();

            const starfield = new StarfieldVisualization(
                mockDOMManager,
                mockEventEmitter,
                mockThemeManager,
                mockColorLegend
            );

            this.assert(starfield !== null, 'StarfieldVisualization should be created');
            this.assert(starfield.options.duration === 15000, 'Default duration should be 15000ms');
            this.assert(starfield.options.intensity === 8, 'Default intensity should be 8');
            this.assert(starfield.options.minScale === 0.3, 'Default minScale should be 0.3');
            this.assert(starfield.options.maxScale === 10.0, 'Default maxScale should be 10.0');
            this.assert(starfield.isRunning === false, 'Should not be running initially');
            this.assert(starfield.starData.length === 0, 'Should have no stars initially');
        });

        this.test('StarfieldVisualization should initialize with custom options', () => {
            const mockDOMManager = new MockDOMManager();
            const mockEventEmitter = new MockEventEmitter();
            const mockThemeManager = new MockThemeManager();
            const mockColorLegend = new MockColorLegend();

            const customOptions = {
                duration: 10000,
                intensity: 5,
                maxStars: 200
            };

            const starfield = new StarfieldVisualization(
                mockDOMManager,
                mockEventEmitter,
                mockThemeManager,
                mockColorLegend,
                customOptions
            );

            this.assert(starfield.options.duration === 10000, 'Custom duration should be applied');
            this.assert(starfield.options.intensity === 5, 'Custom intensity should be applied');
            this.assert(starfield.options.maxStars === 200, 'Custom maxStars should be applied');
        });
    }

    // Test: Message Processing
    testMessageProcessing() {
        this.test('StarfieldVisualization should process messages correctly', () => {
            const mockDOMManager = new MockDOMManager();
            const mockEventEmitter = new MockEventEmitter();
            const mockThemeManager = new MockThemeManager();
            const mockColorLegend = new MockColorLegend();

            const starfield = new StarfieldVisualization(
                mockDOMManager,
                mockEventEmitter,
                mockThemeManager,
                mockColorLegend
            );

            starfield.initialize();

            const mockMessage = {
                topic: 'customer1/device123/sensor/temperature',
                payload: '{"temperature": 25}',
                timestamp: Date.now()
            };

            const processedMessage = starfield.processMessage(mockMessage);

            this.assert(processedMessage !== null, 'Message should be processed');
            this.assert(processedMessage.customer === 'customer1', 'Customer should be extracted correctly');
            this.assert(processedMessage.deviceId === 'device123', 'Device ID should be extracted correctly');
            this.assert(processedMessage.color !== undefined, 'Color should be assigned');
        });
    }

    // Test: Star Creation
    testStarCreation() {
        this.test('StarfieldVisualization should create stars with correct properties', () => {
            const mockDOMManager = new MockDOMManager();
            const mockEventEmitter = new MockEventEmitter();
            const mockThemeManager = new MockThemeManager();
            const mockColorLegend = new MockColorLegend();

            const starfield = new StarfieldVisualization(
                mockDOMManager,
                mockEventEmitter,
                mockThemeManager,
                mockColorLegend
            );

            starfield.initialize();
            starfield.activate();

            const mockMessage = {
                topic: 'customer1/device123/sensor',
                payload: '{"value": 42}',
                timestamp: Date.now()
            };

            // Add message to create star
            starfield.addMessage(mockMessage);

            this.assert(starfield.starData.length === 1, 'One star should be created');

            const star = starfield.starData[0];
            this.assert(star.id.startsWith('star-'), 'Star should have correct ID format');
            this.assert(star.customer === 'customer1', 'Star should have correct customer');
            this.assert(star.deviceId === 'device123', 'Star should have correct device ID');
            this.assert(star.x === starfield.centerX, 'Star should start at center X');
            this.assert(star.y === starfield.centerY, 'Star should start at center Y');
            this.assert(star.scale === starfield.options.minScale, 'Star should start with minimum scale');
        });
    }

    // Test: Animation Calculations
    testAnimationCalculations() {
        this.test('StarfieldVisualization should calculate star states correctly', () => {
            const mockDOMManager = new MockDOMManager();
            const mockEventEmitter = new MockEventEmitter();
            const mockThemeManager = new MockThemeManager();
            const mockColorLegend = new MockColorLegend();

            const starfield = new StarfieldVisualization(
                mockDOMManager,
                mockEventEmitter,
                mockThemeManager,
                mockColorLegend
            );

            starfield.initialize();
            starfield.updateDimensions();

            const mockStar = {
                centerX: starfield.centerX,
                centerY: starfield.centerY,
                directionX: 1, // Moving right
                directionY: 0  // No vertical movement
            };

            // Test at start of animation (elapsed = 0)
            const startState = starfield.calculateStarState(0, mockStar);
            this.assert(startState.distance === 0, 'Distance should be 0 at start');
            this.assert(startState.scale === starfield.options.minScale, 'Scale should be minimum at start');
            this.assert(startState.progress === 0, 'Progress should be 0 at start');
            this.assert(startState.isComplete === false, 'Should not be complete at start');

            // Test at middle of animation
            const midState = starfield.calculateStarState(starfield.options.duration / 2, mockStar);
            this.assert(midState.distance > 0, 'Distance should increase over time');
            this.assert(midState.scale > starfield.options.minScale, 'Scale should increase over time');
            this.assert(midState.progress > 0 && midState.progress < 1, 'Progress should be between 0 and 1');

            // Test at end of animation
            const endState = starfield.calculateStarState(starfield.options.duration, mockStar);
            this.assert(endState.progress === 1, 'Progress should be 1 at end');
            this.assert(endState.isComplete === true, 'Should be complete at end');
        });
    }

    // Test: Cleanup
    testCleanup() {
        this.test('StarfieldVisualization should clean up properly', () => {
            const mockDOMManager = new MockDOMManager();
            const mockEventEmitter = new MockEventEmitter();
            const mockThemeManager = new MockThemeManager();
            const mockColorLegend = new MockColorLegend();

            const starfield = new StarfieldVisualization(
                mockDOMManager,
                mockEventEmitter,
                mockThemeManager,
                mockColorLegend
            );

            starfield.initialize();
            starfield.activate();

            // Add some messages
            for (let i = 0; i < 5; i++) {
                starfield.addMessage({
                    topic: `customer${i}/device${i}/sensor`,
                    payload: '{"value": 1}',
                    timestamp: Date.now()
                });
            }

            this.assert(starfield.starData.length === 5, 'Should have 5 stars before cleanup');

            // Cleanup
            starfield.cleanup();

            this.assert(starfield.starData.length === 0, 'Should have no stars after cleanup');
            this.assert(starfield.starIdCounter === 0, 'Star ID counter should be reset');
        });
    }

    // Test: Theme Changes
    testThemeChanges() {
        this.test('StarfieldVisualization should handle theme changes', () => {
            const mockDOMManager = new MockDOMManager();
            const mockEventEmitter = new MockEventEmitter();
            const mockThemeManager = new MockThemeManager();
            const mockColorLegend = new MockColorLegend();

            const starfield = new StarfieldVisualization(
                mockDOMManager,
                mockEventEmitter,
                mockThemeManager,
                mockColorLegend
            );

            starfield.initialize();
            starfield.activate();

            // Add a message to create a star
            starfield.addMessage({
                topic: 'customer1/device1/sensor',
                payload: '{"value": 1}',
                timestamp: Date.now()
            });

            const star = starfield.starData[0];
            const originalColor = star.color;

            // Simulate theme change
            mockColorLegend.customerColors.set('customer1', '#NEW_COLOR');
            starfield.handleThemeChange({ newTheme: 'dark' });

            this.assert(star.color === '#NEW_COLOR', 'Star color should be updated after theme change');
        });
    }
}

// Run the tests
const tests = new StarfieldVisualizationTests();
const allTestsPassed = tests.runAllTests();

// Exit with appropriate code
process.exit(allTestsPassed ? 0 : 1);