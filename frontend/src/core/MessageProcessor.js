/**
 * Message Processor
 *
 * Processes raw MQTT messages into standardized format for visualization.
 * Handles topic parsing, color assignment, and metadata generation.
 */
class MessageProcessor {
    /**
     * @param {Function} colorProvider - Function that takes a topic and returns a color
     */
    constructor(colorProvider) {
        this.colorProvider = colorProvider;
    }

    /**
     * Process raw MQTT message into standardized format
     * @param {Object} messageData - Raw MQTT message data
     * @returns {Object} Standardized message object
     */
    processMessage(messageData) {
        // Extract topic components
        const topicParts = messageData.topic.split('/');
        const customer = topicParts[0] || messageData.topic;
        const deviceId = topicParts.length > 1 ? topicParts[1] : 'N/A';

        // Get color using provided color function
        const color = this.colorProvider(messageData.topic);

        // Create standardized message object
        return {
            // Core identification
            customer: customer,
            deviceId: deviceId,
            topic: messageData.topic,

            // Visual properties
            color: color,

            // Message content
            timestamp: messageData.timestamp,
            payload: messageData.payload,
            qos: messageData.qos || 0,
            retain: messageData.retain || false,

            // Processing metadata
            id: `${customer}-${deviceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            processedAt: Date.now()
        };
    }

    /**
     * Extract just the device ID for labeling
     * @param {Object} processedMessage - Processed message object
     * @returns {string} Device ID
     */
    getDeviceLabel(processedMessage) {
        return processedMessage.deviceId;
    }

    /**
     * Get customer name for grouping
     * @param {Object} processedMessage - Processed message object
     * @returns {string} Customer name
     */
    getCustomerName(processedMessage) {
        return processedMessage.customer;
    }

    /**
     * Create formatted time string
     * @param {Object} processedMessage - Processed message object
     * @returns {string} Formatted timestamp
     */
    formatTimestamp(processedMessage) {
        return new Date(processedMessage.timestamp * 1000).toLocaleString();
    }
}

export default MessageProcessor;