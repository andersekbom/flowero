/**
 * Test file for Sidebar Controller
 * Run with: node SidebarController.test.js
 */

// Mock DOM and localStorage
global.document = {
    getElementById: (id) => {
        const elements = {
            'sidebarToggle': {
                id: 'sidebarToggle',
                addEventListener: () => {},
                removeEventListener: () => {}
            },
            'sidebar': {
                id: 'sidebar',
                classList: {
                    add: (className) => console.log(`Added class: ${className}`),
                    remove: (className) => console.log(`Removed class: ${className}`),
                    contains: (className) => className === 'collapsed'
                }
            }
        };
        return elements[id] || null;
    },
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.window = {
    innerWidth: 1200,
    innerHeight: 800,
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.localStorage = {
    getItem: (key) => {
        const storage = { 'flowero-sidebar-collapsed': 'false' };
        return storage[key] || null;
    },
    setItem: (key, value) => {
        console.log(`localStorage.setItem(${key}, ${value})`);
    }
};

// Mock DOM Manager
class MockDOMManager {
    constructor() {
        this.elements = {
            sidebar: document.getElementById('sidebar'),
            vizIconButtons: [
                { dataset: { mode: 'bubbles' }, classList: { add: () => {}, remove: () => {} } },
                { dataset: { mode: 'radial' }, classList: { add: () => {}, remove: () => {} } }
            ],
            vizModeButtons: [
                { dataset: { mode: 'network' }, classList: { add: () => {}, remove: () => {} } },
                { dataset: { mode: 'clusters' }, classList: { add: () => {}, remove: () => {} } }
            ]
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
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(handler => handler(data));
        }
    }
}

// Import the module
import SidebarController from './SidebarController.js';

/**
 * Test suite
 */
async function runTests() {
    console.log('🧪 Starting Sidebar Controller Tests\n');

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
    test('Should initialize sidebar controller correctly', () => {
        const sidebarController = new SidebarController(domManager, eventEmitter);
        assert(!sidebarController.initialized, 'Should start uninitialized');

        sidebarController.initialize();
        assert(sidebarController.initialized, 'Should be initialized');
    });

    // Test 2: State management
    test('Should manage sidebar state correctly', () => {
        const sidebarController = new SidebarController(domManager, eventEmitter).initialize();

        assert(!sidebarController.isCollapsed, 'Should start expanded');

        sidebarController.collapse();
        assert(sidebarController.isCollapsed, 'Should be collapsed after collapse()');

        sidebarController.expand();
        assert(!sidebarController.isCollapsed, 'Should be expanded after expand()');
    });

    // Test 3: Toggle functionality
    test('Should toggle sidebar state correctly', () => {
        const sidebarController = new SidebarController(domManager, eventEmitter).initialize();

        const initialState = sidebarController.isCollapsed;
        sidebarController.toggle();
        assert(sidebarController.isCollapsed !== initialState, 'State should change after toggle');

        sidebarController.toggle();
        assert(sidebarController.isCollapsed === initialState, 'State should return to initial after second toggle');
    });

    // Test 4: Width calculation
    test('Should calculate sidebar width correctly', () => {
        const sidebarController = new SidebarController(domManager, eventEmitter).initialize();

        sidebarController.expand();
        const expandedWidth = sidebarController.getSidebarWidth();
        assert(expandedWidth === 300, 'Expanded width should be 300px');

        sidebarController.collapse();
        const collapsedWidth = sidebarController.getSidebarWidth();
        assert(collapsedWidth === 60, 'Collapsed width should be 60px');
    });

    // Test 5: Event emission
    test('Should emit events on state changes', () => {
        const sidebarController = new SidebarController(domManager, eventEmitter).initialize();

        let eventReceived = false;
        eventEmitter.on('sidebar_state_changed', (data) => {
            eventReceived = true;
            assert(typeof data.collapsed === 'boolean', 'Event should include collapsed state');
            assert(typeof data.width === 'number', 'Event should include width');
        });

        sidebarController.toggle();
        assert(eventReceived, 'Should emit state change event');
    });

    // Test 6: Container dimensions calculation
    test('Should calculate effective container dimensions', () => {
        const sidebarController = new SidebarController(domManager, eventEmitter).initialize();

        const mockContainer = {
            getBoundingClientRect: () => ({ width: 1000, height: 600 })
        };

        sidebarController.expand();
        const dimensions = sidebarController.getEffectiveContainerDimensions(mockContainer);

        assert(dimensions.width === 700, 'Effective width should be container width minus sidebar width');
        assert(dimensions.height === 600, 'Height should remain unchanged');
        assert(dimensions.sidebarWidth === 300, 'Should include sidebar width');
    });

    // Test 7: Position offset
    test('Should calculate position offset correctly', () => {
        const sidebarController = new SidebarController(domManager, eventEmitter).initialize();

        sidebarController.expand();
        const offsetExpanded = sidebarController.getPositionOffset();
        assert(offsetExpanded.x === 300, 'X offset should equal sidebar width when expanded');
        assert(offsetExpanded.y === 0, 'Y offset should be 0');

        sidebarController.collapse();
        const offsetCollapsed = sidebarController.getPositionOffset();
        assert(offsetCollapsed.x === 60, 'X offset should equal sidebar width when collapsed');
    });

    // Test 8: Visualization buttons setup
    test('Should setup visualization buttons correctly', () => {
        const sidebarController = new SidebarController(domManager, eventEmitter).initialize();

        let clickHandlerCalled = false;
        const mockClickHandler = (mode) => {
            clickHandlerCalled = true;
            assert(typeof mode === 'string', 'Click handler should receive mode string');
        };

        // This should not throw errors
        sidebarController.setupVisualizationButtons(mockClickHandler);
        assert(true, 'Should setup buttons without errors');
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