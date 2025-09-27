/**
 * Clusters Animation
 *
 * D3 Force-based clustered bubbles visualization that groups messages by customer
 * and visualizes them as clustered bubbles with physics-based movement.
 * Includes automatic cleanup, fade-out effects, and dynamic cluster positioning.
 */
class ClustersAnimation {
    constructor(containerGroup, layoutCalculator, elementSystem, options = {}) {
        this.containerGroup = containerGroup;
        this.layoutCalculator = layoutCalculator;
        this.elementSystem = elementSystem;

        // Default options for clusters visualization
        this.options = {
            maxNodes: 200,            // Maximum number of nodes to display
            clusterStrength: 0.8,     // Increased strength for better clustering
            collisionPadding: 2,      // Padding within same cluster
            interClusterPadding: 6,   // Padding between different clusters
            velocityDecay: 0.8,       // Moderate damping for responsive movement
            alphaDecay: 0.02,         // Faster settling
            alphaMin: 0.005,          // Higher minimum for more active simulation
            nodeRadius: {
                min: 8,
                max: 25,
                scale: 1.2             // Scaling factor based on message count
            },
            ...options
        };

        // Cluster state
        this.nodes = [];
        this.clusters = new Map();        // customer -> cluster info
        this.customerNodes = new Map();   // customer -> nodes array
        this.simulation = null;
        this.nodeGroups = null;

        // Color mapping
        this.colorScale = d3.scaleOrdinal(d3.schemeCategory10);
    }

    /**
     * Initialize the clusters simulation
     */
    initialize() {
        console.log('ClustersAnimation: Initializing clustered bubbles simulation');

        // Create custom forces
        const forceCluster = this.createClusterForce();
        const forceCollide = this.createCollisionForce();

        // Create D3 force simulation optimized for clusters
        this.simulation = d3.forceSimulation(this.nodes)
            .velocityDecay(this.options.velocityDecay)
            .alphaDecay(this.options.alphaDecay)
            .alphaMin(this.options.alphaMin)
            .force('cluster', forceCluster)
            .force('collide', forceCollide)
            .force('center', d3.forceCenter(0, 0).strength(0.05)) // Weaker center force
            .on('tick', () => this.onTick());

        // Get screen dimensions and set up coordinate system
        const dimensions = this.layoutCalculator.getEffectiveDimensions();
        this.screenCenterX = dimensions.width / 2;
        this.screenCenterY = dimensions.height / 2;

        console.log('ClustersAnimation: Screen center set to', { centerX: this.screenCenterX, centerY: this.screenCenterY });

        // Update center force to use actual screen center
        this.simulation.force('center', d3.forceCenter(this.screenCenterX, this.screenCenterY).strength(0.05));

        // Create SVG group for nodes
        this.nodeGroups = this.containerGroup.append('g').attr('class', 'cluster-nodes');

        console.log('ClustersAnimation: Simulation initialized');
    }

    /**
     * Create custom cluster force - attracts nodes to their cluster center
     * @returns {Function} Cluster force function
     */
    createClusterForce() {
        return () => {
            const alpha = this.simulation ? this.simulation.alpha() : 0;
            const strength = this.options.clusterStrength * alpha;

            this.nodes.forEach(node => {
                if (!node.cluster) return;

                const cluster = this.clusters.get(node.cluster);
                if (!cluster) {
                    console.log('No cluster found for node:', node.cluster);
                    return;
                }

                // Use cluster target position instead of calculated centroid for stronger clustering
                const targetX = cluster.targetX || 0;
                const targetY = cluster.targetY || 0;

                // Apply force towards cluster center
                const dx = targetX - node.x;
                const dy = targetY - node.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    const force = strength * (node.radius || 10);
                    node.vx += (dx / distance) * force;
                    node.vy += (dy / distance) * force;
                }
            });
        };
    }

    /**
     * Create custom collision force with different padding for same vs different clusters
     * @returns {Object} D3 collision force
     */
    createCollisionForce() {
        return d3.forceCollide()
            .radius(node => {
                const baseRadius = node.radius || 10;
                // Add padding based on cluster relationship
                return baseRadius + this.options.collisionPadding;
            })
            .strength(0.7)
            .iterations(2);
    }

    /**
     * Calculate weighted centroid for a cluster
     * @param {string} clusterId - Cluster identifier
     * @returns {Object|null} Centroid coordinates or null if no nodes
     */
    calculateClusterCentroid(clusterId) {
        const clusterNodes = this.nodes.filter(n => n.cluster === clusterId);
        if (clusterNodes.length === 0) return null;

        let totalWeight = 0;
        let weightedX = 0;
        let weightedY = 0;

        clusterNodes.forEach(node => {
            const weight = Math.pow(node.radius || 10, 2); // Weight by area
            totalWeight += weight;
            weightedX += node.x * weight;
            weightedY += node.y * weight;
        });

        return {
            x: weightedX / totalWeight,
            y: weightedY / totalWeight
        };
    }

    /**
     * Process incoming message and create individual message circles
     * @param {Object} messageData - Message data
     * @param {string} customerColor - Customer color
     * @param {string} topicColor - Topic color
     * @returns {Object|null} Created message node or null
     */
    processMessage(messageData, customerColor, topicColor) {
        console.log('ClustersAnimation processMessage called with:', { messageData, customerColor, topicColor });

        const customer = this.extractCustomerFromTopic(messageData.topic);
        const deviceId = this.extractDeviceFromTopic(messageData.topic);

        console.log('Creating message circle for customer:', customer, 'deviceId:', deviceId);

        // Ensure cluster exists for this customer
        this.ensureClusterExists(customer, customerColor);

        // Get cluster target position
        const cluster = this.clusters.get(customer);
        if (!cluster) {
            console.warn('Cluster not found for customer:', customer);
            return null;
        }

        // Create individual message circle (like radial mode)
        const messageId = `${customer}-${deviceId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Calculate position within cluster area (small random offset from cluster center)
        const offsetRadius = 40; // Small radius around cluster center
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * offsetRadius;

        const messageNode = {
            id: messageId,
            customer: customer,
            device: deviceId,
            cluster: customer,
            radius: 32, // Fixed radius for individual message circles
            color: customerColor,
            messageData: messageData,
            createdAt: Date.now(),
            // Position near cluster center with small random offset
            x: cluster.targetX + Math.cos(angle) * distance,
            y: cluster.targetY + Math.sin(angle) * distance,
            vx: 0,
            vy: 0
        };

        console.log('Creating message circle node:', messageNode);

        // Add to nodes array for simulation
        this.nodes.push(messageNode);

        // Schedule removal after timeout (like radial burst mode)
        this.scheduleMessageRemoval(messageNode);

        // Update simulation
        this.updateSimulation();

        return messageNode;
    }

    /**
     * Schedule removal of message circle after timeout with fade out
     * @param {Object} messageNode - Message node to remove
     */
    scheduleMessageRemoval(messageNode) {
        const displayTime = 10000; // 10 seconds display time
        const fadeTime = 3000; // 3 seconds fade time

        // Start fade after display time
        setTimeout(() => {
            // Find the DOM element and start fading
            const nodeElement = this.nodeGroups.select(`[data-node-id="${messageNode.id}"]`);
            if (nodeElement.node()) {
                nodeElement.transition()
                    .duration(fadeTime)
                    .style('opacity', 0)
                    .on('end', () => {
                        // Remove from nodes array after fade completes
                        const nodeIndex = this.nodes.findIndex(n => n.id === messageNode.id);
                        if (nodeIndex !== -1) {
                            console.log('Removing faded message circle:', messageNode.id);
                            this.nodes.splice(nodeIndex, 1);
                            // Update simulation
                            this.updateSimulation();
                        }
                    });
            }
        }, displayTime);
    }

    /**
     * Calculate node radius based on message count
     * @param {number} messageCount - Number of messages
     * @returns {number} Calculated radius
     */
    calculateNodeRadius(messageCount) {
        const { min, max, scale } = this.options.nodeRadius;
        const scaledSize = min + (messageCount - 1) * scale;
        return Math.min(max, scaledSize);
    }

    /**
     * Ensure cluster exists in the clusters map
     * @param {string} customer - Customer identifier
     * @param {string} color - Customer color
     */
    ensureClusterExists(customer, color) {
        if (!this.clusters.has(customer)) {
            // Position clusters in a rough circle around screen center
            const clusterCount = this.clusters.size;
            const angle = (clusterCount * 137.5) * (Math.PI / 180); // Golden angle
            const distance = 150 + clusterCount * 50; // Larger separation between clusters

            // Position relative to screen center
            const cluster = {
                id: customer,
                color: color,
                targetX: (this.screenCenterX || 0) + Math.cos(angle) * distance,
                targetY: (this.screenCenterY || 0) + Math.sin(angle) * distance,
                nodeCount: 0
            };

            console.log(`Creating cluster for ${customer} at position (${cluster.targetX.toFixed(1)}, ${cluster.targetY.toFixed(1)}) relative to center (${this.screenCenterX}, ${this.screenCenterY})`);

            this.clusters.set(customer, cluster);
        }
    }

    /**
     * Update cluster information
     * @param {string} customer - Customer identifier
     * @param {string} color - Customer color
     */
    updateCluster(customer, color) {
        const cluster = this.clusters.get(customer);
        if (cluster) {
            cluster.color = color;
            cluster.nodeCount = this.nodes.filter(n => n.cluster === customer).length;
        }
    }

    /**
     * Remove oldest node when exceeding maximum
     */
    removeOldestNode() {
        let oldestNode = null;
        let oldestTime = Date.now();

        this.nodes.forEach(node => {
            if (node.lastActivity < oldestTime) {
                oldestTime = node.lastActivity;
                oldestNode = node;
            }
        });

        if (oldestNode) {
            const index = this.nodes.indexOf(oldestNode);
            this.nodes.splice(index, 1);
        }
    }

    /**
     * Update simulation with new data
     */
    updateSimulation() {
        if (!this.simulation) return;

        this.simulation.nodes(this.nodes);
        this.simulation.alpha(0.3).restart();

        // Update visual representation
        this.updateVisuals();
    }

    /**
     * Update visual representation
     */
    updateVisuals() {
        if (!this.nodeGroups) return;

        console.log(`ClustersAnimation: Updating visuals for ${this.nodes.length} nodes`);

        // Bind data to nodes
        const nodeSelection = this.nodeGroups.selectAll('g.cluster-node')
            .data(this.nodes, d => d.id);

        console.log('Node selection size:', nodeSelection.size());

        // Remove exiting nodes
        nodeSelection.exit()
            .transition()
            .duration(300)
            .style('opacity', 0)
            .attr('transform', d => `translate(${d.x}, ${d.y}) scale(0)`)
            .remove();

        // Add entering nodes
        const nodeEnter = nodeSelection.enter()
            .append('g')
            .attr('class', 'cluster-node')
            .attr('data-node-id', d => d.id)
            .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`)
            .style('opacity', 0);

        // Add circle to each node - use customer color for consistency within cluster
        nodeEnter.append('circle')
            .attr('r', d => d.radius)
            .attr('fill', d => d.color) // This should be the customer color
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer');

        // Add label to each node - always show device ID
        nodeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.3em')
            .attr('fill', '#fff')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .text(d => d.device.length > 8 ? d.device.substring(0, 8) : d.device);

        // Animate entering nodes
        nodeEnter.transition()
            .duration(500)
            .delay((d, i) => i * 20)
            .style('opacity', 1)
            .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0}) scale(1)`);

        // Update existing nodes
        const mergedNodes = nodeSelection.merge(nodeEnter);

        mergedNodes
            .select('circle')
            .transition()
            .duration(200)
            .attr('r', d => d.radius)
            .attr('fill', d => d.color);

        // Update labels - always show device ID
        mergedNodes
            .select('text')
            .text(d => d.device.length > 8 ? d.device.substring(0, 8) : d.device);
    }

    /**
     * Animation tick handler
     */
    onTick() {
        if (!this.nodeGroups) return;

        // Update node positions
        this.nodeGroups.selectAll('g.cluster-node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
    }

    /**
     * Update dimensions when layout changes
     */
    updateDimensions() {
        if (!this.simulation || !this.layoutCalculator) return;

        const dimensions = this.layoutCalculator.getEffectiveDimensions();
        this.screenCenterX = dimensions.width / 2;
        this.screenCenterY = dimensions.height / 2;

        console.log('ClustersAnimation: Updating dimensions to', { centerX: this.screenCenterX, centerY: this.screenCenterY, dimensions });

        // Update center force
        this.simulation.force('center', d3.forceCenter(this.screenCenterX, this.screenCenterY).strength(0.05));
    }

    /**
     * Utility function to extract customer from topic
     * @param {string} topic - MQTT topic
     * @returns {string} Customer identifier
     */
    extractCustomerFromTopic(topic) {
        if (!topic) return 'unknown';
        const parts = topic.split('/');
        return parts[0] || 'unknown';
    }

    /**
     * Utility function to extract device from topic
     * @param {string} topic - MQTT topic
     * @returns {string} Device identifier
     */
    extractDeviceFromTopic(topic) {
        if (!topic) return 'device';
        const parts = topic.split('/');

        // For topics like "customer/device/sensor" or "customer-deviceID"
        if (parts.length > 1) {
            // Use the second part as device ID
            return parts[1];
        } else {
            // For single-part topics, look for device ID after dash
            const lastPart = parts[0] || 'device';
            const deviceMatch = lastPart.match(/-([^-]+)$/);
            const deviceId = deviceMatch ? deviceMatch[1] : lastPart.substring(0, 8);
            console.log(`Extracted device ID "${deviceId}" from topic "${topic}"`);
            return deviceId;
        }
    }

    /**
     * Stop and cleanup
     */
    stop() {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }

        if (this.nodeGroups) {
            this.nodeGroups.remove();
            this.nodeGroups = null;
        }

        // Clear data
        this.nodes = [];
        this.clusters.clear();
        this.customerNodes.clear();

        console.log('ClustersAnimation: Stopped and cleaned up');
    }
}

export default ClustersAnimation;