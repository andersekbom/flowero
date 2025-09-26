/**
 * Test file for DOM Manager
 * Run with: node DOMManager.test.js
 */

// Mock DOM environment
global.document = {
    getElementById: (id) => {
        // Simulate some elements exist, some don't
        const elements = {
            'host': { id: 'host', value: 'localhost' },
            'port': { id: 'port', value: '1883' },
            'connectBtn': { id: 'connectBtn', textContent: 'Connect' },
            'subscribeBtn': { id: 'subscribeBtn', textContent: 'Subscribe' },
            'topic': { id: 'topic', value: '' },
            'messageFlow': { id: 'messageFlow', clientWidth: 800, clientHeight: 600 }
        };
        return elements[id] || null;
    },
    querySelectorAll: (selector) => {
        if (selector === '.viz-icon-btn') {
            return [
                { dataset: { mode: 'bubbles' } },
                { dataset: { mode: 'radial' } }
            ];
        }
        if (selector === '.viz-mode-btn') {
            return [
                { dataset: { mode: 'network' } },
                { dataset: { mode: 'clusters' } }
            ];
        }
        return [];
    }
};

global.window = {
    getComputedStyle: () => ({ visibility: 'visible' })
};

// Import the module
import DOMManager from './DOMManager.js';

/**
 * Test suite
 */
async function runTests() {
    console.log('🧪 Starting DOM Manager Tests\n');

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

    // Test 1: Initialization
    test('Should initialize DOM manager correctly', () => {
        const domManager = new DOMManager();
        assert(!domManager.initialized, 'Should start uninitialized');

        domManager.initialize();
        assert(domManager.initialized, 'Should be initialized');
        assert(domManager.isReady(), 'Should be ready with required elements');
    });

    // Test 2: Element caching
    test('Should cache DOM elements correctly', () => {
        const domManager = new DOMManager().initialize();
        const elements = domManager.getAll();

        assert(elements.host !== null, 'Host element should be cached');
        assert(elements.port !== null, 'Port element should be cached');
        assert(elements.connectBtn !== null, 'Connect button should be cached');
    });

    // Test 3: Element retrieval
    test('Should retrieve cached elements correctly', () => {
        const domManager = new DOMManager().initialize();

        const hostElement = domManager.get('host');
        assert(hostElement !== null, 'Should retrieve host element');
        assert(hostElement.id === 'host', 'Should return correct element');
    });

    // Test 4: Lazy loading
    test('Should handle lazy loading for missing elements', () => {
        const domManager = new DOMManager().initialize();

        // This element doesn't exist in our mock
        const missingElement = domManager.get('nonExistentElement');
        assert(missingElement === null, 'Should return null for missing elements');
    });

    // Test 5: Validation
    test('Should validate required elements', () => {
        const domManager = new DOMManager();

        // Should work with required elements present
        try {
            domManager.initialize();
            assert(true, 'Should initialize successfully with required elements');
        } catch (error) {
            throw new Error('Should not throw error when required elements exist');
        }
    });

    // Test 6: Debug info
    test('Should provide useful debug information', () => {
        const domManager = new DOMManager().initialize();
        const debugInfo = domManager.getDebugInfo();

        assert(debugInfo.initialized === true, 'Debug info should show initialized state');
        assert(debugInfo.totalCached > 0, 'Should show cached elements count');
        assert(Array.isArray(debugInfo.requiredElements), 'Should list required elements');
        assert(Array.isArray(debugInfo.missingRequired), 'Should list missing required elements');
    });

    // Test 7: Element dimensions
    test('Should get element dimensions safely', () => {
        const domManager = new DOMManager().initialize();

        // Mock getBoundingClientRect for messageFlow
        const messageFlow = domManager.get('messageFlow');
        if (messageFlow) {
            messageFlow.getBoundingClientRect = () => ({
                width: 800,
                height: 600,
                top: 0,
                left: 0
            });
        }

        const dimensions = domManager.getDimensions('messageFlow');
        assert(dimensions.width >= 0, 'Should return valid width');
        assert(dimensions.height >= 0, 'Should return valid height');
    });

    // Test 8: Element visibility check
    test('Should check element visibility correctly', () => {
        const domManager = new DOMManager().initialize();

        // Mock getBoundingClientRect for host element
        const hostElement = domManager.get('host');
        if (hostElement) {
            hostElement.getBoundingClientRect = () => ({
                width: 200,
                height: 30,
                top: 100,
                left: 50
            });
        }

        const isVisible = domManager.isElementVisible('host');
        assert(typeof isVisible === 'boolean', 'Should return boolean value');
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