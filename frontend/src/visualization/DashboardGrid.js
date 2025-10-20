/**
 * Dashboard Grid Visualization
 *
 * Responsive grid layout showing customer cards with device activity overview.
 * Provides visual indicators for device count, message volume, and recent activity.
 */

import { BaseVisualization } from './BaseVisualization.js';

class DashboardGrid extends BaseVisualization {
    constructor(domManager, eventEmitter, themeManager, colorLegend, options = {}) {
        super(domManager, eventEmitter, themeManager, options);

        this.colorLegend = colorLegend;
        this.options = {
            ...this.options,
            cardMinWidth: 250,
            cardMaxWidth: 350,
            cardPadding: 15,
            deviceRadius: 8,
            deviceSpacing: 4,
            messageLifetime: 30000,      // 30 seconds to show as "active"
            activityFadeTime: 60000,     // 1 minute until considered inactive
            maxMessagesPerDevice: 100,   // Max message count to track
            updateInterval: 1000,        // Update stats every second
            ...options
        };

        // Data structures
        this.customers = new Map();      // customer -> customer data
        this.devices = new Map();        // deviceKey -> device data
        this.deviceMessages = new Map(); // deviceKey -> message array

        // DOM elements
        this.gridContainer = null;
        this.updateTimer = null;

        // Animation state
        this.isRunning = false;
    }

    /**
     * Initialize the dashboard grid visualization
     */
    initialize() {
        console.log('🎛️ DashboardGrid: Starting initialization...');
        super.initialize();

        if (!this.container) {
            console.error('❌ DashboardGrid: No container found after base initialization!');
            return this;
        }

        this.setupGridContainer();
        this.setupStyles();
        console.log('DashboardGrid: Initialized successfully');
        return this;
    }

    /**
     * Setup grid container
     */
    setupGridContainer() {
        if (!this.container) {
            console.error('DashboardGrid: Container not found');
            return;
        }

        // Remove any existing dashboard container
        const existingContainer = this.container.querySelector('.dashboard-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        // Create main dashboard container
        this.dashboardContainer = document.createElement('div');
        this.dashboardContainer.className = 'dashboard-container';
        this.container.appendChild(this.dashboardContainer);

        // Create header for Live indicator, URL, and stats
        this.headerContainer = document.createElement('div');
        this.headerContainer.className = 'dashboard-header';
        this.dashboardContainer.appendChild(this.headerContainer);

        // Create grid container for customer cards
        this.gridContainer = document.createElement('div');
        this.gridContainer.className = 'dashboard-grid';
        this.dashboardContainer.appendChild(this.gridContainer);

        console.log('DashboardGrid: Dashboard container created with header');
    }

    /**
     * Setup CSS styles for the dashboard
     */
    setupStyles() {
        const styleId = 'dashboard-grid-styles';

        // Check if styles already exist
        if (document.getElementById(styleId)) {
            return;
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .dashboard-container {
                display: flex;
                flex-direction: column;
                width: 100%;
                height: 100%;
                background: transparent;
            }

            .dashboard-header {
                display: flex;
                gap: 20px;
                padding: 20px 20px 10px 20px;
                align-items: center;
                background: rgba(0, 0, 0, 0.3);
                border-bottom: 2px solid rgba(255, 255, 255, 0.1);
            }

            .dashboard-header > * {
                position: static !important;
            }

            .dashboard-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(${this.options.cardMinWidth}px, 1fr));
                gap: 20px;
                padding: 20px;
                width: 100%;
                flex: 1;
                overflow-y: auto;
                background: transparent;
            }

            .customer-card {
                background: rgba(30, 30, 40, 0.8);
                border-radius: 12px;
                padding: ${this.options.cardPadding}px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                transition: all 0.3s ease;
                cursor: pointer;
                position: relative;
                overflow: hidden;
                border: 2px solid transparent;
            }

            .customer-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
            }

            .customer-card.active {
                animation: borderGlow 2s ease-in-out infinite;
            }

            @keyframes borderGlow {
                0%, 100% {
                    border-color: currentColor;
                    box-shadow: 0 0 8px currentColor, 0 0 16px currentColor;
                }
                50% {
                    border-color: currentColor;
                    box-shadow: 0 0 16px currentColor, 0 0 32px currentColor;
                }
            }

            .customer-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 2px solid rgba(255, 255, 255, 0.1);
            }

            .customer-name {
                font-size: 18px;
                font-weight: bold;
                color: white;
                text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
            }

            .customer-badge {
                background: rgba(0, 0, 0, 0.3);
                padding: 4px 10px;
                border-radius: 12px;
                font-size: 12px;
                font-weight: bold;
                color: white;
            }

            .customer-stats {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
                margin-bottom: 15px;
            }

            .stat-box {
                background: rgba(0, 0, 0, 0.2);
                padding: 8px;
                border-radius: 8px;
                text-align: center;
            }

            .stat-label {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.6);
                text-transform: uppercase;
                margin-bottom: 4px;
            }

            .stat-value {
                font-size: 20px;
                font-weight: bold;
                color: white;
            }

            .devices-container {
                display: flex;
                flex-wrap: wrap;
                gap: ${this.options.deviceSpacing}px;
                min-height: 80px;
                padding: 10px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
            }

            .device-bubble {
                width: ${this.options.deviceRadius * 2}px;
                height: ${this.options.deviceRadius * 2}px;
                border-radius: 50%;
                position: relative;
                cursor: pointer;
                transition: all 0.3s ease;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
            }

            .device-bubble:hover {
                transform: scale(1.5);
                z-index: 10;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.5);
            }

            .device-bubble.active {
                animation: pulse 2s ease-in-out infinite;
            }

            .device-bubble.inactive {
                opacity: 0.3;
                filter: grayscale(0.8);
            }

            @keyframes pulse {
                0%, 100% {
                    box-shadow: 0 0 0 0 currentColor;
                }
                50% {
                    box-shadow: 0 0 0 8px transparent;
                }
            }

            .device-tooltip {
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.9);
                color: white;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 11px;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s;
                z-index: 1000;
                margin-bottom: 5px;
            }

            .device-bubble:hover .device-tooltip {
                opacity: 1;
            }

            .last-activity {
                margin-top: 10px;
                padding: 6px 8px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 6px;
                font-size: 11px;
                color: rgba(255, 255, 255, 0.7);
                text-align: center;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Activate the dashboard grid visualization
     */
    activate() {
        super.activate();
        this.isRunning = true;
        this.startUpdateTimer();
        this.setupHeaderElements();
        console.log('DashboardGrid: Activated');
    }

    /**
     * Setup header elements (Live indicator, broker URL, stats panel)
     */
    setupHeaderElements() {
        if (!this.headerContainer) return;

        // Get the elements from the DOM
        const liveIndicator = document.getElementById('liveIndicator');
        const brokerUrlDisplay = document.getElementById('brokerUrlDisplay');
        const statsPanel = document.getElementById('statsPanel');

        // Move them to the dashboard header and ensure visibility
        if (liveIndicator) {
            this.headerContainer.appendChild(liveIndicator);
            liveIndicator.style.setProperty('display', 'flex', 'important');
        }
        if (brokerUrlDisplay) {
            this.headerContainer.appendChild(brokerUrlDisplay);
            brokerUrlDisplay.style.setProperty('display', 'block', 'important');
        }
        if (statsPanel) {
            this.headerContainer.appendChild(statsPanel);
            statsPanel.style.setProperty('display', 'block', 'important');
        }
    }

    /**
     * Restore header elements to their original position
     */
    restoreHeaderElements() {
        const messageFlow = document.getElementById('messageFlow');
        if (!messageFlow) return;

        const liveIndicator = document.getElementById('liveIndicator');
        const brokerUrlDisplay = document.getElementById('brokerUrlDisplay');
        const statsPanel = document.getElementById('statsPanel');

        // Move them back to message flow container
        if (liveIndicator && liveIndicator.parentNode !== messageFlow) {
            messageFlow.appendChild(liveIndicator);
        }
        if (brokerUrlDisplay && brokerUrlDisplay.parentNode !== messageFlow) {
            messageFlow.appendChild(brokerUrlDisplay);
        }
        if (statsPanel && statsPanel.parentNode !== messageFlow) {
            messageFlow.appendChild(statsPanel);
        }
    }

    /**
     * Deactivate the dashboard grid visualization
     */
    deactivate() {
        super.deactivate();
        this.isRunning = false;
        this.stopUpdateTimer();
        this.restoreHeaderElements();
        this.cleanup();
        console.log('DashboardGrid: Deactivated');
    }

    /**
     * Start periodic update timer
     */
    startUpdateTimer() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }

        this.updateTimer = setInterval(() => {
            this.updateAllCards();
        }, this.options.updateInterval);
    }

    /**
     * Stop update timer
     */
    stopUpdateTimer() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    /**
     * Add a new message to the dashboard
     */
    addMessage(messageData) {
        if (!this.isRunning || !this.gridContainer) return;

        // Process message with base class
        const processedMessage = this.processMessage(messageData);
        if (!processedMessage) return;

        const customer = this.extractCustomerFromTopic(processedMessage.topic);
        const deviceId = this.extractDeviceFromTopic(processedMessage.topic);
        const deviceKey = `${customer}/${deviceId}`;

        // Update or create customer data
        this.updateCustomerData(customer, processedMessage);

        // Update or create device data
        this.updateDeviceData(deviceKey, customer, deviceId, processedMessage);

        // Update visualization
        this.renderGrid();

        // Track performance
        this.performanceMetrics.elementsCreated++;
    }

    /**
     * Update customer data
     */
    updateCustomerData(customer, message) {
        if (!this.customers.has(customer)) {
            this.customers.set(customer, {
                id: customer,
                color: this.colorLegend.getCustomerColor(customer),
                devices: new Set(),
                totalMessages: 0,
                lastActivity: Date.now(),
                firstSeen: Date.now()  // Track when customer first appeared
            });
        }

        const customerData = this.customers.get(customer);
        customerData.totalMessages++;
        customerData.lastActivity = Date.now();
    }

    /**
     * Update device data
     */
    updateDeviceData(deviceKey, customer, deviceId, message) {
        if (!this.devices.has(deviceKey)) {
            this.devices.set(deviceKey, {
                key: deviceKey,
                customer: customer,
                deviceId: deviceId,
                messageCount: 0,
                lastActivity: Date.now(),
                firstSeen: Date.now()
            });

            // Add device to customer's device set
            const customerData = this.customers.get(customer);
            if (customerData) {
                customerData.devices.add(deviceKey);
            }
        }

        const deviceData = this.devices.get(deviceKey);
        deviceData.messageCount++;
        deviceData.lastActivity = Date.now();

        // Track messages for this device
        if (!this.deviceMessages.has(deviceKey)) {
            this.deviceMessages.set(deviceKey, []);
        }
        const messages = this.deviceMessages.get(deviceKey);
        messages.push({
            timestamp: Date.now(),
            data: message
        });

        // Keep only recent messages
        if (messages.length > this.options.maxMessagesPerDevice) {
            messages.shift();
        }
    }

    /**
     * Render the grid of customer cards
     */
    renderGrid() {
        if (!this.gridContainer) return;

        // Clear existing cards
        this.gridContainer.innerHTML = '';

        // Sort customers by first appearance (stable order)
        const sortedCustomers = Array.from(this.customers.values())
            .sort((a, b) => a.firstSeen - b.firstSeen);

        // Create card for each customer
        sortedCustomers.forEach(customerData => {
            const card = this.createCustomerCard(customerData);
            this.gridContainer.appendChild(card);
        });
    }

    /**
     * Create a customer card element
     */
    createCustomerCard(customerData) {
        const card = document.createElement('div');
        card.className = 'customer-card';
        card.style.borderColor = customerData.color;
        card.style.color = customerData.color; // Set color for currentColor in CSS animation

        // Check if customer is active
        const timeSinceActivity = Date.now() - customerData.lastActivity;
        const isActive = timeSinceActivity < this.options.messageLifetime;
        if (isActive) {
            card.classList.add('active');
        }

        // Header with customer name and device count
        const header = document.createElement('div');
        header.className = 'customer-header';
        header.innerHTML = `
            <div class="customer-name" style="color: ${customerData.color}">${customerData.id}</div>
            <div class="customer-badge" style="background: ${customerData.color}">
                ${customerData.devices.size} device${customerData.devices.size !== 1 ? 's' : ''}
            </div>
        `;
        card.appendChild(header);

        // Statistics
        const stats = this.createStatsSection(customerData);
        card.appendChild(stats);

        // Devices visualization
        const devicesContainer = this.createDevicesContainer(customerData);
        card.appendChild(devicesContainer);

        // Last activity timestamp
        const lastActivity = this.createLastActivitySection(customerData);
        card.appendChild(lastActivity);

        // Add click handler
        card.addEventListener('click', () => {
            this.eventEmitter.emit('customer_card_clicked', {
                customer: customerData
            });
        });

        return card;
    }

    /**
     * Create statistics section
     */
    createStatsSection(customerData) {
        const stats = document.createElement('div');
        stats.className = 'customer-stats';

        const activeDevices = Array.from(customerData.devices)
            .filter(deviceKey => {
                const device = this.devices.get(deviceKey);
                return device && (Date.now() - device.lastActivity) < this.options.activityFadeTime;
            }).length;

        stats.innerHTML = `
            <div class="stat-box">
                <div class="stat-label">Active</div>
                <div class="stat-value" style="color: ${customerData.color}">${activeDevices}</div>
            </div>
            <div class="stat-box">
                <div class="stat-label">Messages</div>
                <div class="stat-value" style="color: ${customerData.color}">${customerData.totalMessages}</div>
            </div>
        `;

        return stats;
    }

    /**
     * Create devices container with device bubbles
     */
    createDevicesContainer(customerData) {
        const container = document.createElement('div');
        container.className = 'devices-container';

        // Get devices for this customer, sorted by activity
        const customerDevices = Array.from(customerData.devices)
            .map(deviceKey => this.devices.get(deviceKey))
            .filter(device => device)
            .sort((a, b) => b.lastActivity - a.lastActivity);

        // Create bubble for each device
        customerDevices.forEach(device => {
            const bubble = this.createDeviceBubble(device, customerData.color);
            container.appendChild(bubble);
        });

        return container;
    }

    /**
     * Create a device bubble element
     */
    createDeviceBubble(device, customerColor) {
        const bubble = document.createElement('div');
        bubble.className = 'device-bubble';

        const timeSinceActivity = Date.now() - device.lastActivity;
        const isActive = timeSinceActivity < this.options.messageLifetime;
        const isRecent = timeSinceActivity < this.options.activityFadeTime;

        if (isActive) {
            bubble.classList.add('active');
        } else if (!isRecent) {
            bubble.classList.add('inactive');
        }

        // Size based on message count (normalize to reasonable range)
        const sizeMultiplier = 1 + Math.min(device.messageCount / 50, 1);
        const size = this.options.deviceRadius * sizeMultiplier;
        bubble.style.width = `${size * 2}px`;
        bubble.style.height = `${size * 2}px`;

        // Color with opacity based on activity
        const opacity = isRecent ? 1 : 0.3;
        bubble.style.backgroundColor = customerColor;
        bubble.style.opacity = opacity;
        bubble.style.color = customerColor;

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.className = 'device-tooltip';
        tooltip.innerHTML = `
            <strong>${device.deviceId}</strong><br>
            Messages: ${device.messageCount}<br>
            Last: ${this.formatTimestamp(device.lastActivity)}
        `;
        bubble.appendChild(tooltip);

        return bubble;
    }

    /**
     * Create last activity section
     */
    createLastActivitySection(customerData) {
        const section = document.createElement('div');
        section.className = 'last-activity';
        section.textContent = `Last activity: ${this.formatTimestamp(customerData.lastActivity)}`;
        return section;
    }

    /**
     * Format timestamp as relative time
     */
    formatTimestamp(timestamp) {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);

        if (seconds < 5) return 'just now';
        if (seconds < 60) return `${seconds}s ago`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        return `${Math.floor(seconds / 86400)}d ago`;
    }

    /**
     * Update all cards (called periodically)
     */
    updateAllCards() {
        if (!this.isRunning) return;

        // Re-render grid to update timestamps and activity states
        this.renderGrid();
    }

    /**
     * Clean up all data and DOM elements
     */
    cleanup() {
        this.stopUpdateTimer();

        if (this.gridContainer) {
            this.gridContainer.innerHTML = '';
        }

        this.customers.clear();
        this.devices.clear();
        this.deviceMessages.clear();

        console.log('DashboardGrid: Cleanup completed');
        super.cleanup();
    }

    /**
     * Handle theme changes
     */
    handleThemeChange(themeData) {
        super.handleThemeChange(themeData);

        // Update customer colors
        this.customers.forEach((customerData, customer) => {
            customerData.color = this.colorLegend.getCustomerColor(customer);
        });

        // Re-render grid with new colors
        this.renderGrid();
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...super.getState(),
            isRunning: this.isRunning,
            customerCount: this.customers.size,
            deviceCount: this.devices.size,
            totalMessages: Array.from(this.customers.values())
                .reduce((sum, c) => sum + c.totalMessages, 0)
        };
    }

    /**
     * Destroy the dashboard grid visualization
     */
    destroy() {
        this.cleanup();

        if (this.gridContainer) {
            this.gridContainer.remove();
        }

        super.destroy();
        console.log('DashboardGrid: Destroyed');
    }
}

export default DashboardGrid;
