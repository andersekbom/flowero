/**
 * Test file for Base Visualization Component
 * Run with: node BaseVisualization.test.js
 */

// Mock DOM and browser APIs
global.document = {
    createElement: (tag) => {
        const element = {
            className: '',
            style: {},
            textContent: '',
            appendChild: (child) => {
                element.children = element.children || [];
                element.children.push(child);
            },
            parentNode: null,
            querySelector: (selector) => null,
            querySelectorAll: (selector) => [],
            removeChild: (child) => {
                if (element.children) {
                    const index = element.children.indexOf(child);
                    if (index > -1) {
                        element.children.splice(index, 1);
                    }
                }
            }
        };

        if (tag === 'div') {
            element.clientWidth = 800;
            element.clientHeight = 600;
        }

        return element;
    },
    createElementNS: (namespace, tag) => {
        const element = {
            setAttribute: (name, value) => {
                element.attributes = element.attributes || {};
                element.attributes[name] = value;
            },
            style: {},
            textContent: '',
            appendChild: (child) => {
                element.children = element.children || [];
                element.children.push(child);
            },
            firstChild: null,
            removeChild: (child) => {
                if (element.children) {
                    const index = element.children.indexOf(child);
                    if (index > -1) {
                        element.children.splice(index, 1);
                    }
                }
            }
        };
        return element;
    }
};

global.window = {
    requestAnimationFrame: (callback) => {
        setTimeout(callback, 16);
        return Math.floor(Math.random() * 1000);
    },
    cancelAnimationFrame: (id) => {
        // Mock implementation
    }
};

global.requestAnimationFrame = global.window.requestAnimationFrame;
global.cancelAnimationFrame = global.window.cancelAnimationFrame;

// Mock DOM Manager
class MockDOMManager {
    constructor() {
        this.elements = {
            messageFlow: {
                clientWidth: 800,
                clientHeight: 600,
                appendChild: (child) => {},
                querySelector: (selector) => {
                    if (selector === 'svg') {
                        return null; // Will trigger SVG creation
                    }
                    return null;
                },
                querySelectorAll: (selector) => []
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

    off(event, handler) {
        if (this.listeners.has(event)) {
            const handlers = this.listeners.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        console.log(`Emitted event: ${event}`, data ? `with data` : '');
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(handler => handler(data));
        }
    }
}

// Mock Theme Manager
class MockThemeManager {
    constructor() {
        this.currentColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'
        ];
    }

    getCurrentColors() {
        return this.currentColors;
    }
}

// Import the modules
import { BaseVisualization, CircleRenderer } from './BaseVisualization.js';

/**
 * Test suite
 */
async function runTests() {
    console.log('🧪 Starting Base Visualization Tests\n');

    let testsPassed = 0;
    let testsTotal = 0;

    function test(name, testFn) {
        testsTotal++;
        try {
            console.log(`Testing: ${name}`);
            testFn();
            console.log('✅ PASSED\n');
            testsPassed++;
        } catch (error) {
            console.log('❌ FAILED:', error.message, '\n');
        }
    }

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    // Create test instances
    const domManager = new MockDOMManager();
    const eventEmitter = new MockEventEmitter();
    const themeManager = new MockThemeManager();

    // Test 1: CircleRenderer DOM circle creation
    test('CircleRenderer should create DOM circle elements correctly', () => {
        const color = '#FF6B6B';
        const deviceId = 'device001';
        const options = { size: 60, showLabel: true };

        const element = CircleRenderer.createCircleElement(color, deviceId, options);

        assert(element.className === 'circle-element', 'Should have correct class name');
        assert(element.style.width === '60px', 'Should have correct width');
        assert(element.style.height === '60px', 'Should have correct height');
        assert(element.style.backgroundColor === color, 'Should have correct background color');
        assert(element.style.borderRadius === '50%', 'Should be circular');
        assert(element.children && element.children.length === 1, 'Should have label child');
        assert(element.children[0].textContent === deviceId, 'Label should have correct text');
    });

    // Test 2: CircleRenderer SVG circle creation
    test('CircleRenderer should create SVG circle elements correctly', () => {
        const container = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        const color = '#4ECDC4';
        const deviceId = 'device002';
        const x = 100;
        const y = 200;
        const options = { radius: 30, showLabel: true };

        const element = CircleRenderer.createSVGCircle(container, color, deviceId, x, y, options);

        assert(element.attributes.cx === x.toString(), 'Should have correct x position');
        assert(element.attributes.cy === y.toString(), 'Should have correct y position');
        assert(element.attributes.r === '30', 'Should have correct radius');
        assert(element.attributes.fill === color, 'Should have correct fill color');
        assert(container.children && container.children.length === 2, 'Container should have circle and text');
    });

    // Test 3: BaseVisualization initialization
    test('BaseVisualization should initialize correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager);

        assert(!visualization.initialized, 'Should start uninitialized');
        assert(!visualization.isActive, 'Should start inactive');

        visualization.initialize();

        assert(visualization.initialized, 'Should be initialized');
        assert(visualization.container, 'Should have cached container');
        assert(visualization.svgContainer, 'Should have created SVG container');
    });

    // Test 4: Message processing
    test('Should process messages correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        const testMessage = {
            topic: 'customer1/device1/data',
            payload: 'test payload',
            timestamp: Date.now() / 1000
        };

        const processed = visualization.processMessage(testMessage);

        assert(processed.customer === 'customer1', 'Should extract customer correctly');
        assert(processed.deviceId === 'device1', 'Should extract device correctly');
        assert(processed.color, 'Should assign color');
        assert(processed.customerColor, 'Should assign customer color');
        assert(typeof processed.processedAt === 'number', 'Should add processing timestamp');
    });

    // Test 5: Color management
    test('Should manage colors correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        const customer1 = 'customer1';
        const customer2 = 'customer2';
        const topic1 = 'customer1/device1/data';
        const topic2 = 'customer1/device2/data';

        const color1 = visualization.getCustomerColor(customer1);
        const color2 = visualization.getCustomerColor(customer2);
        const topicColor1 = visualization.getTopicColor(topic1);
        const topicColor2 = visualization.getTopicColor(topic2);

        assert(color1 !== color2, 'Different customers should have different colors');
        assert(topicColor1 === topicColor2, 'Same customer topics should have same color');
        assert(visualization.customerColors.size === 2, 'Should track customer colors');
        assert(visualization.topicColors.size === 2, 'Should track topic colors');
    });

    // Test 6: Circle element creation
    test('Should create circle elements correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        const testMessage = {
            topic: 'test/device',
            color: '#FF6B6B',
            deviceId: 'testDevice'
        };

        const element = visualization.createCircleElement(testMessage, { size: 40 });

        assert(element, 'Should create element');
        assert(element.style.width === '40px', 'Should apply custom options');
        assert(visualization.performanceMetrics.elementsCreated === 1, 'Should track element creation');
    });

    // Test 7: SVG element creation
    test('Should create SVG elements correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        const testMessage = {
            topic: 'test/device',
            color: '#4ECDC4',
            deviceId: 'testDevice'
        };

        const element = visualization.createSVGElement(visualization.svgContainer, testMessage, 50, 75);

        assert(element, 'Should create SVG element');
        assert(element.attributes.cx === '50', 'Should set correct position');
        assert(visualization.performanceMetrics.elementsCreated === 1, 'Should track SVG creation');
    });

    // Test 8: Animation frame management
    test('Should manage animation frames correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        const frameId1 = 123;
        const frameId2 = 456;

        visualization.addAnimationFrame(frameId1);
        visualization.addAnimationFrame(frameId2);

        assert(visualization.animationFramePool.size === 2, 'Should track animation frames');

        visualization.removeAnimationFrame(frameId1);
        assert(visualization.animationFramePool.size === 1, 'Should remove animation frames');
    });

    // Test 9: Theme change handling
    test('Should handle theme changes correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        // Add some colors first
        visualization.getCustomerColor('customer1');
        visualization.getTopicColor('customer1/device1');

        assert(visualization.customerColors.size === 1, 'Should have customer colors');
        assert(visualization.topicColors.size === 1, 'Should have topic colors');

        const themeData = { oldTheme: 'default', newTheme: 'dark' };
        visualization.handleThemeChange(themeData);

        assert(visualization.customerColors.size === 0, 'Should clear customer colors');
        assert(visualization.topicColors.size === 0, 'Should clear topic colors');
        assert(visualization.colorIndex === 0, 'Should reset color index');
    });

    // Test 10: Mode changes
    test('Should handle mode changes correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        assert(visualization.currentMode === null, 'Should start with no mode');

        let eventReceived = false;
        eventEmitter.on('visualization_mode_transition', (data) => {
            eventReceived = true;
            assert(data.oldMode === null, 'Should include old mode');
            assert(data.newMode === 'bubbles', 'Should include new mode');
        });

        visualization.handleModeChange('bubbles');

        assert(visualization.currentMode === 'bubbles', 'Should update current mode');
        assert(eventReceived, 'Should emit mode transition event');
    });

    // Test 11: Activation and deactivation
    test('Should handle activation and deactivation correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        let activatedEvent = false;
        let deactivatedEvent = false;

        eventEmitter.on('visualization_activated', () => { activatedEvent = true; });
        eventEmitter.on('visualization_deactivated', () => { deactivatedEvent = true; });

        visualization.activate();
        assert(visualization.isActive, 'Should be active');
        assert(activatedEvent, 'Should emit activation event');

        visualization.deactivate();
        assert(!visualization.isActive, 'Should be inactive');
        assert(deactivatedEvent, 'Should emit deactivation event');
    });

    // Test 12: Cleanup functionality
    test('Should cleanup correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        // Add some animation frames
        visualization.addAnimationFrame(123);
        visualization.addAnimationFrame(456);
        visualization.activeAnimations.set('test', 'animation');

        let cleanupEvent = false;
        eventEmitter.on('visualization_cleaned', (data) => {
            cleanupEvent = true;
            assert(typeof data.cleanupTime === 'number', 'Should include cleanup time');
        });

        visualization.cleanup();

        assert(visualization.animationFramePool.size === 0, 'Should clear animation pool');
        assert(visualization.activeAnimations.size === 0, 'Should clear active animations');
        assert(cleanupEvent, 'Should emit cleanup event');
    });

    // Test 13: Performance metrics
    test('Should track performance metrics correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        // Create some elements to track
        visualization.createCircleElement({ color: '#FF0000', deviceId: 'test1' });
        visualization.createCircleElement({ color: '#00FF00', deviceId: 'test2' });

        const metrics = visualization.emitPerformanceMetrics();

        assert(metrics.elementsCreated === 2, 'Should track created elements');
        assert(typeof metrics.lastCleanup === 'number', 'Should track cleanup time');
        assert(metrics.activeAnimations === 0, 'Should track active animations');
    });

    // Test 14: Container dimensions
    test('Should get container dimensions correctly', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        const dimensions = visualization.getContainerDimensions();

        assert(dimensions.width === 800, 'Should return correct width');
        assert(dimensions.height === 600, 'Should return correct height');
    });

    // Test 15: State information
    test('Should provide comprehensive state information', () => {
        const visualization = new BaseVisualization(domManager, eventEmitter, themeManager).initialize();

        visualization.currentMode = 'bubbles';
        visualization.isActive = true;

        const state = visualization.getState();

        assert(state.initialized === true, 'Should include initialization state');
        assert(state.isActive === true, 'Should include active state');
        assert(state.currentMode === 'bubbles', 'Should include current mode');
        assert(typeof state.performanceMetrics === 'object', 'Should include performance metrics');
        assert(typeof state.colorStats === 'object', 'Should include color statistics');
        assert(typeof state.animations === 'object', 'Should include animation statistics');
    });

    // Print results
    console.log(`\n📊 Test Results: ${testsPassed}/${testsTotal} tests passed`);

    if (testsPassed === testsTotal) {
        console.log('🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('💥 Some tests failed!');
        process.exit(1);
    }
}

// Run tests
runTests().catch(console.error);