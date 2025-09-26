/**
 * Test file for MQTT Connection Manager
 * Run with: node MQTTConnectionManager.test.js
 */

// Mock DOM elements for testing
const mockDOMElements = {
    host: { value: 'localhost' },
    port: { value: '1883' },
    username: { value: 'testuser' },
    password: { value: 'testpass' },
    status: { textContent: '' },
    connectionStatus: { textContent: '' },
    connectBtn: {
        textContent: '',
        style: { backgroundColor: '' },
        disabled: false
    },
    liveIndicator: { className: '' }
};

// Mock WebSocket
global.WebSocket = class MockWebSocket {
    constructor(url) {
        this.url = url;
        this.readyState = WebSocket.CONNECTING;
        setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            if (this.onopen) this.onopen();
        }, 100);
    }

    static get CONNECTING() { return 0; }
    static get OPEN() { return 1; }
    static get CLOSING() { return 2; }
    static get CLOSED() { return 3; }

    send(data) {
        console.log('WebSocket send:', data);
    }

    close() {
        this.readyState = WebSocket.CLOSED;
        if (this.onclose) this.onclose({ code: 1000, reason: 'Normal closure' });
    }
};

// Mock fetch
global.fetch = async (url, options) => {
    console.log('Fetch call:', url, options);
    return {
        ok: true,
        status: 200,
        headers: {
            get: (header) => header === 'content-type' ? 'application/json' : null
        },
        json: async () => ({ success: true }),
        text: async () => 'OK'
    };
};

// Mock window and document
global.window = {
    location: {
        hostname: 'localhost',
        protocol: 'http:',
        host: 'localhost:8000'
    },
    addEventListener: () => {},
    removeEventListener: () => {}
};

global.document = {
    hidden: false,
    addEventListener: () => {},
    removeEventListener: () => {}
};

// Import modules
import EventEmitter from '../utils/EventEmitter.js';
import MQTTConnectionManager from './MQTTConnectionManager.js';

/**
 * Test suite
 */
async function runTests() {
    console.log('🧪 Starting MQTT Connection Manager Tests\n');

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

    // Create test instance
    const eventEmitter = new EventEmitter();
    const connectionManager = new MQTTConnectionManager(mockDOMElements, eventEmitter);

    // Test 1: Initialization
    test('Should initialize with correct default state', () => {
        const state = connectionManager.getConnectionState();
        assert(!state.isConnected, 'Should start disconnected');
        assert(state.reconnectAttempts === 0, 'Should have zero reconnect attempts');
        assert(state.shouldReconnect === false, 'Should not be set to reconnect initially');
    });

    // Test 2: Connection configuration
    test('Should extract connection config correctly', () => {
        const config = connectionManager.getConnectionConfig();
        assert(config.host === 'localhost', 'Host should be localhost');
        assert(config.port === 1883, 'Port should be 1883');
        assert(config.username === 'testuser', 'Username should be testuser');
        assert(config.password === 'testpass', 'Password should be testpass');
        assert(config.ssl === false, 'SSL should be false by default');
    });

    // Test 3: Event emitting
    test('Should emit events correctly', (done) => {
        let eventReceived = false;

        eventEmitter.on('test_event', (data) => {
            eventReceived = true;
            assert(data.test === true, 'Event data should be correct');
        });

        eventEmitter.emit('test_event', { test: true });
        assert(eventReceived, 'Event should have been received');
    });

    // Test 4: WebSocket connection (simulated)
    test('Should handle WebSocket connection', async () => {
        try {
            await connectionManager.webSocketHandler.connect();
            const wsState = connectionManager.webSocketHandler.getConnectionState();
            assert(wsState.isConnected, 'WebSocket should be connected');
            assert(wsState.readyState === WebSocket.OPEN, 'WebSocket should be open');
        } catch (error) {
            throw new Error('WebSocket connection should succeed');
        }
    });

    // Test 5: Status updates
    test('Should update connection status correctly', () => {
        connectionManager.updateConnectionStatus('connected');
        assert(mockDOMElements.status.textContent === '🟢 Connected', 'Status text should be updated');
        assert(mockDOMElements.connectBtn.textContent === 'Disconnect', 'Button text should change');
    });

    // Test 6: Cleanup
    test('Should cleanup resources correctly', () => {
        connectionManager.webSocketHandler.disconnect();
        connectionManager.cleanupConnection();
        const wsState = connectionManager.webSocketHandler.getConnectionState();
        assert(wsState.readyState === WebSocket.CLOSED, 'WebSocket should be closed');
    });

    // Test 7: EventEmitter functionality
    test('EventEmitter should work correctly', () => {
        const emitter = new EventEmitter();
        let callCount = 0;

        const unsubscribe = emitter.on('test', () => callCount++);
        emitter.emit('test');
        emitter.emit('test');
        assert(callCount === 2, 'Should receive all events');

        unsubscribe();
        emitter.emit('test');
        assert(callCount === 2, 'Should not receive events after unsubscribe');
    });

    // Test 8: Error handling
    test('Should handle connection errors gracefully', () => {
        const error = new Error('Test connection error');
        connectionManager.handleConnectionError(error);

        // Should not throw and should update status
        assert(mockDOMElements.status.textContent.includes('Disconnected'), 'Should show disconnected status');
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