import WebSocketHandler from './WebSocketHandler.js';

/**
 * MQTT Connection Manager
 *
 * Handles MQTT connection lifecycle, WebSocket communication, and connection state management.
 * Provides robust error handling and automatic reconnection capabilities.
 */
class MQTTConnectionManager {
    constructor(domElements, eventEmitter) {
        this.domElements = domElements;
        this.eventEmitter = eventEmitter;

        // Connection state
        this.isConnected = false;
        this.connectionConfig = null;

        // Backend API endpoint
        this.baseUrl = window.location.hostname === 'localhost' ?
            'http://localhost:8000' :
            `${window.location.protocol}//${window.location.host}`;

        // Reconnection settings
        this.shouldReconnect = false;
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 30000;
        this.maxReconnectAttempts = 10;

        // WebSocket handler
        const wsUrl = this.baseUrl.replace(/^http/, 'ws') + '/ws';
        this.webSocketHandler = new WebSocketHandler(wsUrl, this.eventEmitter);

        this.setupEventHandlers();
    }

    setupEventHandlers() {
        // Listen to WebSocket events
        this.eventEmitter.on('websocket_connected', () => {
            console.log('WebSocket connected, MQTT ready');
        });

        this.eventEmitter.on('websocket_disconnected', () => {
            console.log('WebSocket disconnected');
            if (this.isConnected) {
                this.handleConnectionLoss();
            }
        });

        this.eventEmitter.on('websocket_message', (data) => {
            this.handleWebSocketMessage(data);
        });

        this.eventEmitter.on('websocket_reconnecting', ({ attempt, delay }) => {
            this.updateConnectionStatus('reconnecting', `Reconnecting in ${Math.ceil(delay / 1000)}s...`);
        });

        this.eventEmitter.on('websocket_reconnect_failed', () => {
            console.error('WebSocket reconnection failed completely');
            this.eventEmitter.emit('connection_failed', 'WebSocket reconnection failed');
        });

        // Handle page visibility changes for connection management
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });

        // Handle beforeunload to clean up connections
        window.addEventListener('beforeunload', () => {
            this.shouldReconnect = false;
            this.cleanupConnection();
        });
    }

    /**
     * Toggle connection state
     */
    async toggleConnection() {
        console.log('=== MQTTConnectionManager.toggleConnection called ===');
        console.log('Current connection state:', this.isConnected ? 'Connected' : 'Disconnected');

        try {
            if (this.isConnected) {
                console.log('🔌 Disconnecting from MQTT...');
                await this.disconnect();
                console.log('✅ Disconnected successfully');
            } else {
                console.log('🔌 Connecting to MQTT...');
                await this.connect();
                console.log('✅ Connected successfully');
            }
        } catch (error) {
            console.error('❌ Toggle connection error:', error);
            throw error;
        }
    }

    /**
     * Connect to MQTT broker
     */
    async connect() {
        this.connectionConfig = this.getConnectionConfig();

        // Validate connection configuration
        this.validateConnectionConfig(this.connectionConfig);

        try {
            this.shouldReconnect = true;
            this.reconnectAttempts = 0;

            // Update UI to show connecting state
            this.updateConnectionStatus('connecting');

            // Connect WebSocket first
            await this.webSocketHandler.connect();

            // Then connect to MQTT broker
            await this.apiCall('/api/connect', 'POST', this.connectionConfig);

            console.log('MQTT connection initiated successfully');

        } catch (error) {
            console.error('Connection failed:', error);
            this.handleConnectionError(error);
            throw error;
        }
    }

    /**
     * Validate connection configuration
     */
    validateConnectionConfig(config) {
        if (!config.host) {
            throw new Error('Please enter a broker host');
        }

        if (config.port < 1 || config.port > 65535) {
            throw new Error('Port must be between 1 and 65535');
        }

        if (config.ssl) {
            // SSL/TLS specific validations
            if (config.port === 1883) {
                console.warn('Using standard MQTT port (1883) with SSL enabled. Consider using port 8883 for MQTTS.');
            }

            if (config.tls) {
                // Validate certificate format if provided
                if (config.tls.ca && !this.isValidPEM(config.tls.ca)) {
                    throw new Error('Invalid CA certificate format. Please provide a valid PEM certificate.');
                }

                if (config.tls.cert && !this.isValidPEM(config.tls.cert)) {
                    throw new Error('Invalid client certificate format. Please provide a valid PEM certificate.');
                }

                if (config.tls.key && !this.isValidPEM(config.tls.key)) {
                    throw new Error('Invalid client key format. Please provide a valid PEM key.');
                }

                // Check if cert and key are both provided or both omitted
                if ((config.tls.cert && !config.tls.key) || (!config.tls.cert && config.tls.key)) {
                    throw new Error('Both client certificate and key must be provided for mutual TLS authentication.');
                }
            }
        }
    }

    /**
     * Basic PEM format validation
     */
    isValidPEM(pemString) {
        if (!pemString) return false;

        const trimmed = pemString.trim();
        return (
            (trimmed.startsWith('-----BEGIN CERTIFICATE-----') && trimmed.endsWith('-----END CERTIFICATE-----')) ||
            (trimmed.startsWith('-----BEGIN PRIVATE KEY-----') && trimmed.endsWith('-----END PRIVATE KEY-----')) ||
            (trimmed.startsWith('-----BEGIN RSA PRIVATE KEY-----') && trimmed.endsWith('-----END RSA PRIVATE KEY-----')) ||
            (trimmed.startsWith('-----BEGIN EC PRIVATE KEY-----') && trimmed.endsWith('-----END EC PRIVATE KEY-----'))
        );
    }

    /**
     * Disconnect from MQTT broker
     */
    async disconnect() {
        try {
            this.shouldReconnect = false;
            this.clearReconnectTimer();

            // Update UI to show disconnecting state
            this.updateConnectionStatus('disconnecting');

            // Call backend disconnect
            await this.apiCall('/api/disconnect', 'POST');

            // Give time for status updates to propagate
            await new Promise(resolve => setTimeout(resolve, 200));

            // Close WebSocket connection
            this.webSocketHandler.disconnect();
            this.cleanupConnection();

            // Reset client state
            this.resetClientState();

        } catch (error) {
            console.error('Disconnect failed:', error);
            // Still cleanup even if API call fails
            this.cleanupConnection();
            this.resetClientState();
        }
    }


    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'status':
                this.handleStatusUpdate(data.data);
                break;
            case 'mqtt_message':
                this.eventEmitter.emit('mqtt_message', data.data);
                break;
            case 'connection_error':
                this.handleConnectionError(new Error(data.message || 'Connection error'));
                break;
            case 'ping':
                // Respond to ping for connection health monitoring
                this.sendWebSocketMessage({ type: 'pong' });
                break;
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    /**
     * Send message via WebSocket
     */
    sendWebSocketMessage(message) {
        this.webSocketHandler.send(message);
    }

    /**
     * Handle MQTT broker status updates
     */
    handleStatusUpdate(status) {
        console.log('MQTT Status:', status);

        const wasConnected = this.isConnected;
        // Convert backend status string to boolean
        this.isConnected = status.status === 'Connected';

        if (this.isConnected && !wasConnected) {
            // Just connected
            this.updateConnectionStatus('connected');
            this.eventEmitter.emit('connection_established');
        } else if (!this.isConnected && wasConnected) {
            // Just disconnected
            this.handleConnectionLoss();
        }

        // Update broker info
        if (status.connection_info) {
            this.eventEmitter.emit('broker_info', status.connection_info);
        }
    }

    /**
     * Handle connection loss and attempt reconnection
     */
    handleConnectionLoss() {
        this.isConnected = false;
        this.updateConnectionStatus('disconnected');
        this.eventEmitter.emit('connection_lost');

        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnection attempts reached');
            this.eventEmitter.emit('connection_failed', 'Max reconnection attempts reached');
        }
    }

    /**
     * Schedule automatic reconnection with exponential backoff
     */
    scheduleReconnect() {
        this.clearReconnectTimer();

        this.reconnectAttempts++;
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );

        console.log(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
        this.updateConnectionStatus('reconnecting', `Reconnecting in ${Math.ceil(delay / 1000)}s...`);

        this.reconnectTimer = setTimeout(async () => {
            if (this.shouldReconnect) {
                try {
                    await this.connect();
                } catch (error) {
                    console.error('Reconnection failed:', error);
                    this.handleConnectionLoss();
                }
            }
        }, delay);
    }

    /**
     * Clear reconnection timer
     */
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * Handle connection errors
     */
    handleConnectionError(error) {
        console.error('Connection error:', error);

        // Enhanced error handling for SSL/TLS issues
        let userFriendlyMessage = error.message;

        if (error.message.includes('CERT_') || error.message.includes('certificate')) {
            userFriendlyMessage = 'SSL Certificate error. Please check your certificates and CA configuration.';
        } else if (error.message.includes('ECONNREFUSED')) {
            userFriendlyMessage = 'Connection refused. Please check if the MQTT broker is running and the host/port are correct.';
        } else if (error.message.includes('EHOSTUNREACH') || error.message.includes('ENOTFOUND')) {
            userFriendlyMessage = 'Host not reachable. Please check the broker hostname and your network connection.';
        } else if (error.message.includes('ETIMEDOUT')) {
            userFriendlyMessage = 'Connection timeout. Please check your network connection and firewall settings.';
        } else if (error.message.includes('SSL') || error.message.includes('TLS')) {
            userFriendlyMessage = 'SSL/TLS connection failed. Please verify SSL settings and certificates.';
        } else if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
            userFriendlyMessage = 'Authentication failed. Please check your username and password.';
        }

        this.updateConnectionStatus('disconnected');
        this.eventEmitter.emit('connection_error', {
            original: error,
            userFriendly: userFriendlyMessage
        });
    }

    /**
     * Handle page becoming hidden
     */
    handlePageHidden() {
        // Don't attempt reconnections while page is hidden
        this.clearReconnectTimer();
    }

    /**
     * Handle page becoming visible
     */
    handlePageVisible() {
        // Check connection health when page becomes visible
        if (this.shouldReconnect && !this.isConnected) {
            this.scheduleReconnect();
        }
    }

    /**
     * Subscribe to MQTT topic
     */
    async subscribeToTopic(topic) {
        if (!topic) {
            throw new Error('Please enter a topic to subscribe to');
        }

        if (!this.isConnected) {
            throw new Error('Please connect to MQTT broker first');
        }

        try {
            await this.apiCall('/api/subscribe', 'POST', { topic });
            console.log('Subscribed to topic:', topic);
            this.eventEmitter.emit('topic_subscribed', topic);
        } catch (error) {
            console.error('Subscription failed:', error);
            throw error;
        }
    }

    /**
     * Unsubscribe from MQTT topic
     */
    async unsubscribeFromTopic(topic) {
        if (!this.isConnected) {
            throw new Error('Not connected to MQTT broker');
        }

        try {
            await this.apiCall(`/api/unsubscribe/${encodeURIComponent(topic)}`, 'POST');
            console.log('Unsubscribed from topic:', topic);
            this.eventEmitter.emit('topic_unsubscribed', topic);
        } catch (error) {
            console.error('Unsubscription failed:', error);
            throw error;
        }
    }

    /**
     * Get current connection configuration
     */
    getConnectionConfig() {
        const sslEnabled = this.domElements.ssl ? this.domElements.ssl.checked : false;
        const port = parseInt(this.domElements.port.value) || (sslEnabled ? 8883 : 1883);

        return {
            host: this.domElements.host.value.trim(),
            port: port,
            username: this.domElements.username.value.trim() || null,
            password: this.domElements.password.value.trim() || null,
            ssl: sslEnabled,
            // SSL/TLS specific options
            tls: sslEnabled ? {
                rejectUnauthorized: this.domElements.tlsVerify ? this.domElements.tlsVerify.checked : true,
                ca: this.domElements.caCert ? this.domElements.caCert.value.trim() || null : null,
                cert: this.domElements.clientCert ? this.domElements.clientCert.value.trim() || null : null,
                key: this.domElements.clientKey ? this.domElements.clientKey.value.trim() || null : null
            } : null
        };
    }

    /**
     * Update connection status in UI
     */
    updateConnectionStatus(status, customMessage = null) {
        const configs = {
            connecting: {
                statusText: '🟡 Connecting...',
                connectionText: 'Connecting',
                buttonText: 'Cancel',
                buttonColor: '#ff9800',
                buttonDisabled: false
            },
            connected: {
                statusText: '🟢 Connected',
                connectionText: 'Online',
                buttonText: 'Disconnect',
                buttonColor: '#f44336',
                buttonDisabled: false
            },
            disconnecting: {
                statusText: '🟡 Disconnecting...',
                connectionText: 'Disconnecting',
                buttonText: 'Disconnect',
                buttonColor: '#4CAF50',
                buttonDisabled: true
            },
            reconnecting: {
                statusText: '🟡 Reconnecting...',
                connectionText: customMessage || 'Reconnecting',
                buttonText: 'Cancel',
                buttonColor: '#ff9800',
                buttonDisabled: false
            },
            disconnected: {
                statusText: '🔴 Disconnected',
                connectionText: 'Offline',
                buttonText: 'Connect',
                buttonColor: '#4CAF50',
                buttonDisabled: false
            }
        };

        const config = configs[status] || configs.disconnected;

        // Update DOM elements
        if (this.domElements.status) {
            this.domElements.status.textContent = config.statusText;
        }
        if (this.domElements.connectionStatus) {
            this.domElements.connectionStatus.textContent = config.connectionText;
        }
        if (this.domElements.connectBtn) {
            this.domElements.connectBtn.textContent = config.buttonText;
            this.domElements.connectBtn.style.backgroundColor = config.buttonColor;
            this.domElements.connectBtn.disabled = config.buttonDisabled;
        }

        // Update live indicator
        if (this.domElements.liveIndicator) {
            this.domElements.liveIndicator.className = `live-indicator ${status}`;
        }

        this.eventEmitter.emit('connection_status_changed', { status, config });
    }

    /**
     * Reset client state after disconnection
     */
    resetClientState() {
        this.isConnected = false;
        this.connectionConfig = null;
        this.updateConnectionStatus('disconnected');
        this.eventEmitter.emit('client_reset');
    }

    /**
     * Clean up connection resources
     */
    cleanupConnection() {
        this.clearReconnectTimer();
    }

    /**
     * Make API call to backend
     */
    async apiCall(endpoint, method = 'GET', data = null) {
        const url = `${this.baseUrl}${endpoint}`;
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Return JSON if response has content
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }

        return null;
    }

    /**
     * Get connection state
     */
    getConnectionState() {
        const wsState = this.webSocketHandler.getConnectionState();
        return {
            isConnected: this.isConnected,
            config: this.connectionConfig,
            reconnectAttempts: this.reconnectAttempts,
            shouldReconnect: this.shouldReconnect,
            websocket: wsState
        };
    }

    /**
     * Destroy the connection manager
     */
    destroy() {
        this.shouldReconnect = false;
        this.webSocketHandler.destroy();
        this.cleanupConnection();

        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handlePageVisible);
        window.removeEventListener('beforeunload', this.cleanupConnection);
    }
}

export default MQTTConnectionManager;