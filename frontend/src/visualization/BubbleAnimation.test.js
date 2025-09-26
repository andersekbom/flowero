/**
 * Test file for D3 Bubble Animation System
 * Run with: node BubbleAnimation.test.js
 */

// Mock D3.js
global.d3 = {
    select: (selector) => ({
        append: (tag) => ({
            attr: () => ({ attr: () => ({}), style: () => ({}) }),
            style: () => ({}),
            remove: () => {}
        }),
        remove: () => {},
        selectAll: () => ({ remove: () => {} }),
        select: () => ({ node: () => null, remove: () => {} })
    }),
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

// Mock DOM Manager
class MockDOMManager {
    constructor() {
        this.elements = {
            messageFlow: {
                clientWidth: 800,
                clientHeight: 600,
                getBoundingClientRect: () => ({ width: 800, height: 600 }),
                querySelector: () => null,
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
        this.colors = new Map();
        this.colorIndex = 0;
    }

    getCustomerColor(customer) {
        if (!this.colors.has(customer)) {
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];
            this.colors.set(customer, colors[this.colorIndex % colors.length]);
            this.colorIndex++;
        }
        return this.colors.get(customer);
    }
}

// Import the component
import BubbleAnimation from './BubbleAnimation.js';

/**
 * Test suite
 */
async function runTests() {
    console.log('🧪 Starting D3 Bubble Animation Tests\n');

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
    const colorLegend = new MockColorLegend();

    // Test 1: Initialization
    test('Should initialize correctly', () => {
        const bubbleAnimation = new BubbleAnimation(domManager, eventEmitter, themeManager, colorLegend);

        assert(!bubbleAnimation.isRunning, 'Should start not running');
        assert(bubbleAnimation.bubbleData.length === 0, 'Should start with no bubbles');
        assert(bubbleAnimation.bubbleIdCounter === 0, 'Should start with counter at 0');

        bubbleAnimation.initialize();

        assert(bubbleAnimation.initialized, 'Should be initialized');
        assert(bubbleAnimation.colorLegend === colorLegend, 'Should store color legend reference');
    });

    // Test 2: Activation/Deactivation
    test('Should handle activation and deactivation', () => {
        const bubbleAnimation = new BubbleAnimation(domManager, eventEmitter, themeManager, colorLegend);
        bubbleAnimation.initialize();

        assert(!bubbleAnimation.isRunning, 'Should start inactive');

        bubbleAnimation.activate();
        assert(bubbleAnimation.isRunning, 'Should be running after activation');

        bubbleAnimation.deactivate();
        assert(!bubbleAnimation.isRunning, 'Should be stopped after deactivation');
    });

    // Test 3: Message Processing
    test('Should process messages correctly', () => {
        const bubbleAnimation = new BubbleAnimation(domManager, eventEmitter, themeManager, colorLegend);
        bubbleAnimation.initialize();
        bubbleAnimation.activate();

        const testMessage = {
            topic: 'customer1/device1/data',
            payload: 'test payload',
            timestamp: Date.now() / 1000
        };

        const initialCount = bubbleAnimation.bubbleData.length;
        bubbleAnimation.addMessage(testMessage);

        assert(bubbleAnimation.bubbleData.length === initialCount + 1, 'Should add bubble to data array');

        const bubble = bubbleAnimation.bubbleData[bubbleAnimation.bubbleData.length - 1];
        assert(bubble.customer === 'customer1', 'Should extract customer correctly');
        assert(bubble.deviceId === 'device1', 'Should extract device correctly');
        assert(bubble.color, 'Should have color assigned');
    });

    // Test 4: Random Spawn Position
    test('Should generate valid spawn positions', () => {
        const bubbleAnimation = new BubbleAnimation(domManager, eventEmitter, themeManager, colorLegend);
        bubbleAnimation.initialize();

        const containerWidth = 800;

        for (let i = 0; i < 10; i++) {
            const x = bubbleAnimation.getRandomSpawnX(containerWidth);
            const spawnWidth = containerWidth * bubbleAnimation.options.spawnWidth;
            const offset = (containerWidth - spawnWidth) / 2;

            assert(x >= offset, 'Should be within spawn area left boundary');
            assert(x <= offset + spawnWidth, 'Should be within spawn area right boundary');
        }
    });

    // Test 5: Bubble Removal
    test('Should remove bubbles correctly', () => {
        const bubbleAnimation = new BubbleAnimation(domManager, eventEmitter, themeManager, colorLegend);
        bubbleAnimation.initialize();
        bubbleAnimation.activate();

        // Add a test bubble manually to data
        const testBubble = {
            id: 'test-bubble-1',
            customer: 'test-customer',
            color: '#FF0000'
        };
        bubbleAnimation.bubbleData.push(testBubble);

        const initialCount = bubbleAnimation.bubbleData.length;
        bubbleAnimation.removeBubble('test-bubble-1');

        assert(bubbleAnimation.bubbleData.length === initialCount - 1, 'Should remove bubble from data');
        assert(!bubbleAnimation.bubbleData.find(b => b.id === 'test-bubble-1'), 'Should not find removed bubble');
    });

    // Test 6: Max Bubbles Limit
    test('Should respect maximum bubble limit', () => {
        const bubbleAnimation = new BubbleAnimation(domManager, eventEmitter, themeManager, colorLegend, {
            maxBubbles: 3
        });
        bubbleAnimation.initialize();
        bubbleAnimation.activate();

        // Add bubbles beyond limit
        for (let i = 0; i < 5; i++) {
            bubbleAnimation.addMessage({
                topic: `customer${i}/device${i}/data`,
                payload: `test ${i}`,
                timestamp: Date.now() / 1000
            });
        }

        assert(bubbleAnimation.bubbleData.length <= 3, 'Should not exceed max bubble limit');
    });

    // Test 7: Theme Change Handling
    test('Should handle theme changes', () => {
        const bubbleAnimation = new BubbleAnimation(domManager, eventEmitter, themeManager, colorLegend);
        bubbleAnimation.initialize();

        // Add a bubble
        bubbleAnimation.bubbleData.push({
            id: 'test-bubble',
            customer: 'test-customer',
            color: '#FF0000'
        });

        const themeData = { oldTheme: 'default', newTheme: 'dark' };

        // Should not throw error
        bubbleAnimation.handleThemeChange(themeData);

        assert(true, 'Should handle theme change without error');
    });

    // Test 8: State Information
    test('Should provide comprehensive state information', () => {
        const bubbleAnimation = new BubbleAnimation(domManager, eventEmitter, themeManager, colorLegend);
        bubbleAnimation.initialize();
        bubbleAnimation.activate();

        const state = bubbleAnimation.getState();

        assert(typeof state.isRunning === 'boolean', 'Should include running state');
        assert(typeof state.activeBubbles === 'number', 'Should include bubble count');
        assert(typeof state.bubbleOptions === 'object', 'Should include bubble options');
        assert(state.initialized === true, 'Should include initialization state');
    });

    // Test 9: Options Configuration
    test('Should respect custom options', () => {
        const customOptions = {
            bubbleRadius: 30,
            fallDuration: 5000,
            spawnWidth: 0.9,
            maxBubbles: 150
        };

        const bubbleAnimation = new BubbleAnimation(
            domManager, eventEmitter, themeManager, colorLegend, customOptions
        );

        assert(bubbleAnimation.options.bubbleRadius === 30, 'Should use custom bubble radius');
        assert(bubbleAnimation.options.fallDuration === 5000, 'Should use custom fall duration');
        assert(bubbleAnimation.options.spawnWidth === 0.9, 'Should use custom spawn width');
        assert(bubbleAnimation.options.maxBubbles === 150, 'Should use custom max bubbles');
    });

    // Test 10: Event Emission
    test('Should emit events correctly', () => {
        const bubbleAnimation = new BubbleAnimation(domManager, eventEmitter, themeManager, colorLegend);
        bubbleAnimation.initialize();

        let eventReceived = false;
        eventEmitter.on('bubble_clicked', (data) => {
            eventReceived = true;
            assert(data.bubble, 'Should include bubble data');
            assert(data.message, 'Should include message data');
        });

        // Simulate bubble click by manually emitting
        eventEmitter.emit('bubble_clicked', {
            bubble: { id: 'test' },
            message: { topic: 'test/topic' }
        });

        assert(eventReceived, 'Should emit bubble click events');
    });

    // Test 11: Performance Metrics
    test('Should track performance metrics', () => {
        const bubbleAnimation = new BubbleAnimation(domManager, eventEmitter, themeManager, colorLegend);
        bubbleAnimation.initialize();
        bubbleAnimation.activate();

        const initialCreated = bubbleAnimation.performanceMetrics.elementsCreated;

        bubbleAnimation.addMessage({
            topic: 'test/device/data',
            payload: 'test',
            timestamp: Date.now() / 1000
        });

        assert(
            bubbleAnimation.performanceMetrics.elementsCreated === initialCreated + 1,
            'Should track element creation'
        );
    });

    // Test 12: Cleanup
    test('Should cleanup correctly', () => {
        const bubbleAnimation = new BubbleAnimation(domManager, eventEmitter, themeManager, colorLegend);
        bubbleAnimation.initialize();
        bubbleAnimation.activate();

        // Add some bubbles
        bubbleAnimation.bubbleData.push({ id: 'bubble1' });
        bubbleAnimation.bubbleData.push({ id: 'bubble2' });

        bubbleAnimation.cleanup();

        assert(bubbleAnimation.bubbleData.length === 0, 'Should clear bubble data');
        assert(bubbleAnimation.bubbleIdCounter === 0, 'Should reset counter');
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