/**
 * Test file for Modal Controller
 * Run with: node ModalController.test.js
 */

// Mock DOM and browser APIs
global.document = {
    activeElement: null,
    addEventListener: (event, handler, options) => {
        console.log(`Added document listener for: ${event}`)
    },
    removeEventListener: (event, handler, options) => {
        console.log(`Removed document listener for: ${event}`)
    },
    querySelector: (selector) => {
        const mockFields = {
            '.modal-field:nth-child(5)': { style: { display: 'none' } },
            '.modal-field:nth-child(6)': { style: { display: 'none' } },
            '.modal-content': {
                style: {
                    background: '',
                    border: ''
                }
            }
        };
        return mockFields[selector] || null;
    }
};

global.window = {
    addEventListener: (event, handler, options) => {
        console.log(`Added window listener for: ${event}`)
    },
    removeEventListener: (event, handler, options) => {
        console.log(`Removed window listener for: ${event}`)
    }
};

// Mock DOM Manager
class MockDOMManager {
    constructor() {
        this.elements = {
            modal: {
                style: { display: 'none' },
                addEventListener: (event, handler, options) => {
                    console.log(`Added modal listener for: ${event}`)
                },
                querySelector: (selector) => {
                    if (selector === '.modal-content') {
                        return {
                            style: {
                                background: '',
                                border: ''
                            }
                        };
                    }
                    return null;
                }
            },
            modalClose: {
                addEventListener: (event, handler, options) => {
                    console.log(`Added modalClose listener for: ${event}`)
                },
                focus: () => console.log('Focused modalClose button'),
                cloneNode: () => ({ parentNode: null }),
                parentNode: {
                    replaceChild: () => console.log('Replaced modalClose node')
                }
            },
            modalCustomer: {
                textContent: ''
            },
            modalTopic: {
                textContent: ''
            },
            modalTimestamp: {
                textContent: ''
            },
            modalPayload: {
                textContent: ''
            },
            modalQos: {
                textContent: ''
            },
            modalRetain: {
                textContent: ''
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
        console.log(`Added listener for: ${event}`);
    }

    off(event, handler) {
        if (this.listeners.has(event)) {
            const handlers = this.listeners.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
        console.log(`Removed listener for: ${event}`);
    }

    emit(event, data) {
        console.log(`Emitted event: ${event}`, data ? `with data: ${JSON.stringify(data)}` : '');
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(handler => handler(data));
        }
    }
}

// Import the module
import ModalController from './ModalController.js';

/**
 * Test suite
 */
async function runTests() {
    console.log('🧪 Starting Modal Controller Tests\n');

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
    test('Should initialize modal controller correctly', () => {
        const modalController = new ModalController(domManager, eventEmitter);
        assert(!modalController.initialized, 'Should start uninitialized');
        assert(!modalController.isOpen, 'Should start closed');

        modalController.initialize();
        assert(modalController.initialized, 'Should be initialized');
        assert(!modalController.isOpen, 'Should still be closed');
    });

    // Test 2: Modal state management
    test('Should manage modal state correctly', () => {
        const modalController = new ModalController(domManager, eventEmitter).initialize();

        assert(!modalController.isModalOpen(), 'Should start closed');

        modalController.show();
        assert(modalController.isModalOpen(), 'Should be open after show()');

        modalController.close();
        assert(!modalController.isModalOpen(), 'Should be closed after close()');
    });

    // Test 3: Message modal display
    test('Should display message modal with correct data', () => {
        const modalController = new ModalController(domManager, eventEmitter).initialize();

        const testMessage = {
            topic: 'customer1/device1/data',
            payload: 'Test payload',
            timestamp: Date.now() / 1000,
            qos: 1,
            retain: true
        };

        modalController.showMessageModal(testMessage);

        assert(modalController.isModalOpen(), 'Modal should be open');
        assert(domManager.elements.modalCustomer.textContent === 'CUSTOMER1', 'Customer should be extracted correctly');
        assert(domManager.elements.modalTopic.textContent === testMessage.topic, 'Topic should be set correctly');
        assert(domManager.elements.modalPayload.textContent === testMessage.payload, 'Payload should be set correctly');
        assert(domManager.elements.modalQos.textContent === '1', 'QoS should be set correctly');
        assert(domManager.elements.modalRetain.textContent === 'Yes', 'Retain should be set correctly');
    });

    // Test 4: Customer extraction from topic
    test('Should extract customer from topic correctly', () => {
        const modalController = new ModalController(domManager, eventEmitter).initialize();

        assert(modalController.extractCustomerFromTopic('customer1/device1/data') === 'customer1', 'Should extract first part');
        assert(modalController.extractCustomerFromTopic('single_topic') === 'single_topic', 'Should handle single part topic');
        assert(modalController.extractCustomerFromTopic('') === 'unknown', 'Should handle empty topic');
        assert(modalController.extractCustomerFromTopic(null) === 'unknown', 'Should handle null topic');
    });

    // Test 5: Event handling
    test('Should handle events correctly', () => {
        const modalController = new ModalController(domManager, eventEmitter).initialize();

        let eventReceived = false;
        eventEmitter.on('modal_opened', (data) => {
            eventReceived = true;
            assert(data.type === 'message', 'Should emit correct event type');
        });

        const testMessage = {
            topic: 'test/topic',
            payload: 'test',
            timestamp: Date.now() / 1000,
            qos: 0,
            retain: false
        };

        modalController.showMessageModal(testMessage);
        assert(eventReceived, 'Should emit modal_opened event');
    });

    // Test 6: External event requests
    test('Should respond to external event requests', () => {
        const modalController = new ModalController(domManager, eventEmitter).initialize();

        const testMessage = {
            topic: 'external/test',
            payload: 'external test',
            timestamp: Date.now() / 1000,
            qos: 0,
            retain: false
        };

        // Simulate external request
        eventEmitter.emit('modal_show_message', testMessage);
        assert(modalController.isModalOpen(), 'Should respond to external show request');

        // Simulate external close request
        eventEmitter.emit('modal_close_request');
        assert(!modalController.isModalOpen(), 'Should respond to external close request');
    });

    // Test 7: Color provider
    test('Should use color provider when available', () => {
        const modalController = new ModalController(domManager, eventEmitter).initialize();

        const mockColorProvider = (topic) => '#FF5733';
        modalController.setColorProvider(mockColorProvider);

        assert(modalController.getTopicColor, 'Should have color provider set');
        assert(modalController.getTopicColor('test/topic') === '#FF5733', 'Should use color provider');
    });

    // Test 8: Options configuration
    test('Should respect configuration options', () => {
        const customOptions = {
            enableKeyboardNavigation: false,
            enableClickOutsideClose: false,
            enableEscapeClose: false
        };

        const modalController = new ModalController(domManager, eventEmitter, customOptions).initialize();

        assert(modalController.options.enableKeyboardNavigation === false, 'Should use custom keyboard option');
        assert(modalController.options.enableClickOutsideClose === false, 'Should use custom click outside option');
        assert(modalController.options.enableEscapeClose === false, 'Should use custom escape option');
    });

    // Test 9: State information
    test('Should provide comprehensive state information', () => {
        const modalController = new ModalController(domManager, eventEmitter).initialize();

        const state = modalController.getState();

        assert(typeof state.isOpen === 'boolean', 'Should include open state');
        assert(typeof state.initialized === 'boolean', 'Should include initialization state');
        assert(Array.isArray(state.elements), 'Should include elements array');
        assert(typeof state.options === 'object', 'Should include options object');
    });

    // Test 10: Browser compatibility
    test('Should handle browser compatibility correctly', () => {
        const modalController = new ModalController(domManager, eventEmitter);

        assert(typeof modalController.supportsPassiveListeners === 'boolean', 'Should check passive listener support');

        // Test keyboard event handling with different key formats
        const mockEvent1 = { key: 'Escape' };
        const mockEvent2 = { keyCode: 27 };
        const mockEvent3 = { which: 27 };

        modalController.initialize();
        modalController.show();

        // Should not throw errors with different event formats
        modalController.handleKeydown(mockEvent1);
        modalController.handleKeydown(mockEvent2);
        modalController.handleKeydown(mockEvent3);

        assert(!modalController.isModalOpen(), 'Should handle keyboard events correctly');
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