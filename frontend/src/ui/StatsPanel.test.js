/**
 * Test file for Stats Panel
 * Run with: node StatsPanel.test.js
 */

// Mock DOM and browser APIs
global.document = {
    createElement: (tag) => ({
        style: {},
        classList: {
            add: () => {},
            remove: () => {}
        }
    })
};

global.window = {
    getComputedStyle: (element) => ({
        display: element && element.style && element.style.display || 'block'
    }),
    requestAnimationFrame: (callback) => {
        setTimeout(callback, 16); // ~60fps
        return 1;
    }
};

global.requestAnimationFrame = global.window.requestAnimationFrame;

global.performance = {
    memory: {
        usedJSHeapSize: 1024 * 1024,
        totalJSHeapSize: 2048 * 1024,
        jsHeapSizeLimit: 4096 * 1024
    }
};

// Mock DOM Manager
class MockDOMManager {
    constructor() {
        this.elements = {
            statsPanel: {
                style: { display: 'none' }
            },
            totalMessages: {
                textContent: '0'
            },
            messageRate: {
                textContent: '0.0'
            },
            activeTopics: {
                textContent: '0'
            },
            frameRate: {
                textContent: '0'
            },
            activeCards: {
                textContent: '0'
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

// Import the module
import StatsPanel from './StatsPanel.js';

/**
 * Test suite
 */
async function runTests() {
    console.log('🧪 Starting Stats Panel Tests\n');

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

    // Test 1: Initialization
    test('Should initialize stats panel correctly', () => {
        const statsPanel = new StatsPanel(domManager, eventEmitter);
        assert(!statsPanel.initialized, 'Should start uninitialized');

        statsPanel.initialize();
        assert(statsPanel.initialized, 'Should be initialized');
        assert(statsPanel.stats.totalMessages === 0, 'Should start with zero messages');
        assert(statsPanel.stats.activeTopics.size === 0, 'Should start with no topics');
    });

    // Test 2: Message tracking
    test('Should track messages correctly', () => {
        const statsPanel = new StatsPanel(domManager, eventEmitter).initialize();

        const testMessage1 = {
            topic: 'test/topic1',
            payload: 'test1',
            timestamp: Date.now() / 1000
        };

        const testMessage2 = {
            topic: 'test/topic2',
            payload: 'test2',
            timestamp: Date.now() / 1000
        };

        statsPanel.onMessageReceived(testMessage1);
        assert(statsPanel.stats.totalMessages === 1, 'Should count first message');
        assert(statsPanel.stats.activeTopics.has('test/topic1'), 'Should track first topic');

        statsPanel.onMessageReceived(testMessage2);
        assert(statsPanel.stats.totalMessages === 2, 'Should count second message');
        assert(statsPanel.stats.activeTopics.size === 2, 'Should track both topics');
    });

    // Test 3: Message rate calculation
    test('Should calculate message rate correctly', () => {
        const statsPanel = new StatsPanel(domManager, eventEmitter, {
            messageHistoryWindow: 10 // 10 seconds for faster testing
        }).initialize();

        // Add several messages quickly
        for (let i = 0; i < 5; i++) {
            statsPanel.updateMessageRate();
        }

        assert(statsPanel.stats.messageRate === 0.5, 'Should calculate rate as 5 messages / 10 seconds = 0.5');
        assert(statsPanel.messageHistory.length === 5, 'Should track all messages in history');
    });

    // Test 4: Panel visibility
    test('Should manage panel visibility correctly', () => {
        const statsPanel = new StatsPanel(domManager, eventEmitter).initialize();

        assert(!statsPanel.isVisible(), 'Should start hidden');

        statsPanel.show();
        assert(domManager.elements.statsPanel.style.display === 'block', 'Should show panel');

        statsPanel.hide();
        assert(domManager.elements.statsPanel.style.display === 'none', 'Should hide panel');

        statsPanel.toggle();
        assert(domManager.elements.statsPanel.style.display === 'block', 'Should toggle to visible');

        statsPanel.toggle();
        assert(domManager.elements.statsPanel.style.display === 'none', 'Should toggle to hidden');
    });

    // Test 5: Connection events
    test('Should handle connection events correctly', () => {
        const statsPanel = new StatsPanel(domManager, eventEmitter).initialize();

        assert(!statsPanel.connectionStartTime, 'Should start with no connection time');

        statsPanel.onConnectionEstablished();
        assert(statsPanel.connectionStartTime, 'Should set connection start time');
        assert(statsPanel.isVisible(), 'Should show panel on connection');

        statsPanel.onConnectionLost();
        assert(!statsPanel.connectionStartTime, 'Should clear connection time');
        assert(!statsPanel.isVisible(), 'Should hide panel on disconnection');
    });

    // Test 6: Statistics reset
    test('Should reset statistics correctly', () => {
        const statsPanel = new StatsPanel(domManager, eventEmitter).initialize();

        // Add some data
        statsPanel.stats.totalMessages = 10;
        statsPanel.stats.activeTopics.add('test/topic');
        statsPanel.stats.activeCards = 5;

        assert(statsPanel.stats.totalMessages === 10, 'Should have test data');
        assert(statsPanel.stats.activeTopics.size === 1, 'Should have test topic');

        statsPanel.resetStats();

        assert(statsPanel.stats.totalMessages === 0, 'Should reset message count');
        assert(statsPanel.stats.activeTopics.size === 0, 'Should reset topics');
        assert(statsPanel.stats.activeCards === 0, 'Should reset active cards');
    });

    // Test 7: Performance metrics
    test('Should provide performance metrics correctly', () => {
        const statsPanel = new StatsPanel(domManager, eventEmitter).initialize();

        statsPanel.stats.frameRate = 60;
        statsPanel.stats.messageRate = 2.5;
        statsPanel.stats.activeCards = 15;

        const metrics = statsPanel.getPerformanceMetrics();

        assert(metrics.frameRate === 60, 'Should include frame rate');
        assert(metrics.messageRate === 2.5, 'Should include message rate');
        assert(metrics.activeCards === 15, 'Should include active cards');
        assert(metrics.memoryUsage, 'Should include memory usage');
        assert(typeof metrics.lastUpdate === 'number', 'Should include timestamp');
    });

    // Test 8: Event handling
    test('Should handle external events correctly', () => {
        const statsPanel = new StatsPanel(domManager, eventEmitter).initialize();

        let eventReceived = false;
        eventEmitter.on('stats_updated', (data) => {
            eventReceived = true;
            assert(typeof data.totalMessages === 'number', 'Should emit message count');
            assert(typeof data.activeTopics === 'number', 'Should emit topic count as number');
        });

        statsPanel.updateDisplay();
        assert(eventReceived, 'Should emit stats update event');
    });

    // Test 9: Options configuration
    test('Should respect configuration options', () => {
        const customOptions = {
            updateInterval: 2000,
            enableFrameRate: false,
            enableMessageRate: false,
            messageHistoryWindow: 30
        };

        const statsPanel = new StatsPanel(domManager, eventEmitter, customOptions).initialize();

        assert(statsPanel.options.updateInterval === 2000, 'Should use custom update interval');
        assert(statsPanel.options.enableFrameRate === false, 'Should use custom frame rate option');
        assert(statsPanel.options.messageHistoryWindow === 30, 'Should use custom history window');
    });

    // Test 10: Uptime formatting
    test('Should format uptime correctly', () => {
        const statsPanel = new StatsPanel(domManager, eventEmitter).initialize();

        assert(statsPanel.formatUptime(30000) === '30s', 'Should format seconds');
        assert(statsPanel.formatUptime(90000) === '1m 30s', 'Should format minutes and seconds');
        assert(statsPanel.formatUptime(3660000) === '1h 1m', 'Should format hours and minutes');
    });

    // Test 11: State information
    test('Should provide comprehensive state information', () => {
        const statsPanel = new StatsPanel(domManager, eventEmitter).initialize();

        const state = statsPanel.getState();

        assert(typeof state.initialized === 'boolean', 'Should include initialization state');
        assert(typeof state.isVisible === 'boolean', 'Should include visibility state');
        assert(typeof state.stats === 'object', 'Should include statistics object');
        assert(typeof state.options === 'object', 'Should include options object');
        assert(Array.isArray(state.elements), 'Should include elements array');
    });

    // Test 12: Active cards management
    test('Should manage active cards count correctly', () => {
        const statsPanel = new StatsPanel(domManager, eventEmitter).initialize();

        assert(statsPanel.stats.activeCards === 0, 'Should start with zero active cards');

        statsPanel.setActiveCards(25);
        assert(statsPanel.stats.activeCards === 25, 'Should update active cards count');

        statsPanel.updateStat('activeCards', 50);
        assert(statsPanel.stats.activeCards === 50, 'Should update via updateStat method');
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