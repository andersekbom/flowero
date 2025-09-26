/**
 * WebSocket Handler
 *
 * Manages WebSocket connections with automatic reconnection, health monitoring,
 * and message routing for MQTT communication.
 */
class WebSocketHandler {
    constructor(url, eventEmitter, options = {}) {
        this.url = url;
        this.eventEmitter = eventEmitter;
        this.options = {
            connectionTimeout: 10000, // 10 seconds
            pingInterval: 30000, // 30 seconds
            maxReconnectAttempts: 10,
            reconnectDelay: 1000, // Start with 1 second
            maxReconnectDelay: 30000, // Max 30 seconds
            ...options
        };

        // Connection state
        this.websocket = null;
        this.isConnected = false;
        this.shouldReconnect = false;

        // Reconnection management
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;

        // Health monitoring
        this.pingTimer = null;
        this.lastPongTime = null;
        this.connectionStartTime = null;

        // Message queuing for when disconnected
        this.messageQueue = [];
        this.maxQueueSize = 100;

        this.setupEventHandlers();
    }

    /**
     * Setup global event handlers
     */
    setupEventHandlers() {
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handlePageHidden();
            } else {
                this.handlePageVisible();
            }
        });

        // Handle beforeunload
        window.addEventListener('beforeunload', () => {
            this.shouldReconnect = false;
            this.disconnect();
        });
    }

    /**
     * Connect to WebSocket
     */
    async connect() {
        return new Promise((resolve, reject) => {
            if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
                resolve();
                return;
            }

            this.shouldReconnect = true;
            this.connectionStartTime = Date.now();

            try {
                console.log('WebSocketHandler: Connecting to', this.url);
                this.websocket = new WebSocket(this.url);

                // Set connection timeout
                const timeout = setTimeout(() => {
                    if (this.websocket && this.websocket.readyState !== WebSocket.OPEN) {
                        this.websocket.close();
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, this.options.connectionTimeout);

                this.websocket.onopen = () => {
                    clearTimeout(timeout);
                    console.log('WebSocketHandler: Connected successfully');

                    this.isConnected = true;
                    this.reconnectAttempts = 0;

                    this.startHealthMonitoring();
                    this.processMessageQueue();

                    this.eventEmitter.emit('websocket_connected');
                    resolve();
                };

                this.websocket.onmessage = (event) => {
                    this.handleMessage(event);
                };

                this.websocket.onclose = (event) => {
                    clearTimeout(timeout);
                    this.handleDisconnection(event);
                };

                this.websocket.onerror = (error) => {
                    clearTimeout(timeout);
                    console.error('WebSocketHandler: Connection error', error);
                    reject(new Error('WebSocket connection failed'));
                };

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Disconnect from WebSocket
     */
    disconnect() {
        this.shouldReconnect = false;
        this.stopHealthMonitoring();
        this.clearReconnectTimer();

        if (this.websocket) {
            console.log('WebSocketHandler: Disconnecting');
            this.websocket.close(1000, 'Normal closure');
            this.websocket = null;
        }

        this.isConnected = false;
        this.eventEmitter.emit('websocket_disconnected');
    }

    /**
     * Send message via WebSocket
     */
    send(message) {
        const messageStr = JSON.stringify(message);

        if (this.isConnected && this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            try {
                this.websocket.send(messageStr);
                return true;
            } catch (error) {
                console.error('WebSocketHandler: Send failed', error);
                this.queueMessage(message);
                return false;
            }
        } else {
            console.warn('WebSocketHandler: Not connected, queuing message');
            this.queueMessage(message);
            return false;
        }
    }

    /**
     * Queue message for later sending
     */
    queueMessage(message) {
        if (this.messageQueue.length >= this.maxQueueSize) {
            // Remove oldest message if queue is full
            this.messageQueue.shift();
            console.warn('WebSocketHandler: Message queue full, dropped oldest message');
        }

        this.messageQueue.push({
            message,
            timestamp: Date.now()
        });
    }

    /**
     * Process queued messages
     */
    processMessageQueue() {
        if (this.messageQueue.length === 0) return;

        console.log(`WebSocketHandler: Processing ${this.messageQueue.length} queued messages`);

        const messages = [...this.messageQueue];
        this.messageQueue = [];

        messages.forEach(({ message, timestamp }) => {
            // Only send messages that are less than 5 minutes old
            if (Date.now() - timestamp < 300000) {
                this.send(message);
            }
        });
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleMessage(event) {
        try {
            const data = JSON.parse(event.data);

            // Handle health monitoring messages
            if (data.type === 'ping') {
                this.send({ type: 'pong', timestamp: Date.now() });
                return;
            }

            if (data.type === 'pong') {
                this.lastPongTime = Date.now();
                return;
            }

            // Emit message to listeners
            this.eventEmitter.emit('websocket_message', data);

        } catch (error) {
            console.error('WebSocketHandler: Failed to parse message', error);
            this.eventEmitter.emit('websocket_error', error);
        }
    }

    /**
     * Handle WebSocket disconnection
     */
    handleDisconnection(event) {
        console.log('WebSocketHandler: Disconnected', event.code, event.reason);

        this.isConnected = false;
        this.websocket = null;
        this.stopHealthMonitoring();

        this.eventEmitter.emit('websocket_disconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean
        });

        // Attempt reconnection if appropriate
        if (this.shouldReconnect && this.reconnectAttempts < this.options.maxReconnectAttempts) {
            this.scheduleReconnect();
        } else if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            console.error('WebSocketHandler: Max reconnection attempts reached');
            this.eventEmitter.emit('websocket_reconnect_failed');
        }
    }

    /**
     * Schedule automatic reconnection with exponential backoff
     */
    scheduleReconnect() {
        this.clearReconnectTimer();

        this.reconnectAttempts++;
        const delay = Math.min(
            this.options.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            this.options.maxReconnectDelay
        );

        console.log(`WebSocketHandler: Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);

        this.eventEmitter.emit('websocket_reconnecting', {
            attempt: this.reconnectAttempts,
            delay: delay,
            maxAttempts: this.options.maxReconnectAttempts
        });

        this.reconnectTimer = setTimeout(async () => {
            if (this.shouldReconnect) {
                try {
                    await this.connect();
                } catch (error) {
                    console.error('WebSocketHandler: Reconnection failed', error);
                    // handleDisconnection will be called by the error handler
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
     * Start health monitoring with ping/pong
     */
    startHealthMonitoring() {
        this.stopHealthMonitoring();

        this.pingTimer = setInterval(() => {
            if (this.isConnected) {
                const now = Date.now();

                // Check if we've received a pong recently
                if (this.lastPongTime && (now - this.lastPongTime) > this.options.pingInterval * 2) {
                    console.warn('WebSocketHandler: Connection appears unhealthy, no pong received');
                    this.websocket.close(1002, 'Connection timeout');
                    return;
                }

                // Send ping
                this.send({ type: 'ping', timestamp: now });
            }
        }, this.options.pingInterval);
    }

    /**
     * Stop health monitoring
     */
    stopHealthMonitoring() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        this.lastPongTime = null;
    }

    /**
     * Handle page becoming hidden
     */
    handlePageHidden() {
        // Pause reconnection attempts while page is hidden
        this.clearReconnectTimer();
        this.stopHealthMonitoring();
    }

    /**
     * Handle page becoming visible
     */
    handlePageVisible() {
        // Resume connection monitoring when page becomes visible
        if (this.shouldReconnect && !this.isConnected) {
            this.scheduleReconnect();
        } else if (this.isConnected) {
            this.startHealthMonitoring();
        }
    }

    /**
     * Get connection state and statistics
     */
    getConnectionState() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            shouldReconnect: this.shouldReconnect,
            queuedMessages: this.messageQueue.length,
            connectionDuration: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0,
            lastPongTime: this.lastPongTime,
            readyState: this.websocket ? this.websocket.readyState : WebSocket.CLOSED
        };
    }

    /**
     * Force immediate reconnection attempt
     */
    async forceReconnect() {
        this.clearReconnectTimer();
        this.reconnectAttempts = 0; // Reset attempts for manual reconnection

        if (this.websocket) {
            this.websocket.close();
        }

        try {
            await this.connect();
        } catch (error) {
            console.error('WebSocketHandler: Force reconnect failed', error);
            throw error;
        }
    }

    /**
     * Update connection URL
     */
    updateUrl(newUrl) {
        const wasConnected = this.isConnected;
        this.url = newUrl;

        if (wasConnected) {
            // Reconnect with new URL
            this.disconnect();
            setTimeout(() => this.connect(), 100);
        }
    }

    /**
     * Destroy the WebSocket handler
     */
    destroy() {
        this.shouldReconnect = false;
        this.disconnect();
        this.clearReconnectTimer();

        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handlePageVisible);
        window.removeEventListener('beforeunload', this.disconnect);

        // Clear message queue
        this.messageQueue = [];
    }
}

export default WebSocketHandler;