/**
 * D3 Network Graph Visualization
 *
 * Clean D3.js implementation of force-directed network visualization.
 * Features:
 * - Central MQTT broker node with customer and topic connections
 * - Force-directed positioning with boundary constraints
 * - Pulse animations for message flow
 * - Brightness decay system for activity visualization
 * - Responsive design with resize handling
 */

import { BaseVisualization } from './BaseVisualization.js';

class NetworkGraph extends BaseVisualization {
    constructor(domManager, eventEmitter, themeManager, colorLegend, options = {}) {
        super(domManager, eventEmitter, themeManager, options);

        this.colorLegend = colorLegend;
        this.options = {
            ...this.options,
            // Force simulation parameters
            velocityDecay: 0.8,
            alphaDecay: 0.01,
            alphaMin: 0.001,
            linkDistance: 150,
            chargeStrength: -800, // Increased repulsion for better separation
            centerStrength: 0.05,
            collideRadius: 60, // Increased collision radius
            // Visual parameters
            brokerRadius: 30,
            customerRadius: 20,
            topicRadius: 15,
            pulseRadius: 8,
            pulseDuration: 1500,
            // Brightness decay
            brightnessDecayRate: 0.995,
            minBrightness: 0.3,
            // Size decay
            sizeDecayRate: 0.995, // Same rate as brightness for consistency
            minSizeScale: 0.66, // Shrink to 66% of original size
            ...options
        };

        // D3 components
        this.svg = null;
        this.simulation = null;
        this.linkGroups = null;
        this.nodeGroups = null;
        this.pulseGroups = null;

        // Network data
        this.nodes = [];
        this.links = [];
        this.customerNodes = new Map();
        this.topicNodes = new Map();
        this.brokerNode = null;

        // Brightness decay system
        this.brightnessInterval = null;

        // Animation state
        this.isRunning = false;
    }

    /**
     * Initialize the network graph system
     */
    initialize() {
        super.initialize();

        if (!this.container) {
            console.error('NetworkGraph: No container found after base initialization!');
            return this;
        }

        this.setupResizeHandler();
        console.log('NetworkGraph: Initialized successfully');
        return this;
    }

    /**
     * Setup D3 SVG container
     */
    setupD3Container() {
        // Remove any existing SVG
        const existingSvg = this.container.querySelector('svg.network-graph');
        if (existingSvg) {
            existingSvg.remove();
        }

        // Get container dimensions - fix zero dimensions issue
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;

        // Create SVG with D3
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('class', 'network-graph')
            .attr('width', width)
            .attr('height', height)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('pointer-events', 'auto')
            .style('z-index', '10');

        // Create groups for organization
        this.linkGroups = this.svg.append('g').attr('class', 'links');
        this.nodeGroups = this.svg.append('g').attr('class', 'nodes');
        this.pulseGroups = this.svg.append('g').attr('class', 'pulses');

        console.log('NetworkGraph: SVG container created');
    }

    /**
     * Create central broker node
     */
    createBrokerNode() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;
        const centerX = width / 2;
        const centerY = height / 2;

        this.brokerNode = {
            id: 'broker',
            type: 'broker',
            label: '',
            x: centerX,
            y: centerY,
            fx: centerX, // Fixed position
            fy: centerY,
            radius: this.options.brokerRadius,
            baseRadius: this.options.brokerRadius, // Store original radius
            color: '#ff7300ff',
            brightness: 1.0,
            sizeScale: 1.0, // Size scaling factor
            lastActivity: Date.now()
        };

        this.nodes = [this.brokerNode];
    }

    /**
     * Initialize D3 force simulation
     */
    initializeSimulation() {
        const rect = this.container.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;

        this.simulation = d3.forceSimulation(this.nodes)
            .velocityDecay(this.options.velocityDecay)
            .alphaDecay(this.options.alphaDecay)
            .alphaMin(this.options.alphaMin)
            .force('link', d3.forceLink(this.links)
                .id(d => d.id)
                .distance(d => {
                    // Closer distance for customer-topic links
                    if (d.type === 'customer-topic') {
                        return this.options.linkDistance * 0.6; // 40% closer
                    }
                    return this.options.linkDistance;
                })
                .strength(d => {
                    // Stronger attraction for customer-topic links
                    if (d.type === 'customer-topic') {
                        return 1.25; // 25% stronger attraction
                    }
                    // Stronger attraction for broker-customer links
                    if (d.type === 'broker-customer') {
                        return 1.5; // 50% stronger attraction to central node
                    }
                    return 1.0; // Default strength
                }))
            .force('charge', d3.forceManyBody()
                .strength(this.options.chargeStrength))
            .force('center', d3.forceCenter(width / 2, height / 2)
                .strength(this.options.centerStrength))
            .force('collide', d3.forceCollide()
                .radius(this.options.collideRadius))
            .force('customerSeparation', this.createCustomerSeparationForce())
            .force('brokerRepulsion', this.createBrokerRepulsionForce())
            .force('topicCustomerAlignment', this.createTopicCustomerAlignmentForce())
            .force('boundary', this.createBoundaryForce(width, height))
            .on('tick', () => this.onTick());

    }

    /**
     * Create custom force for better customer node separation
     */
    createCustomerSeparationForce() {
        const minDistance = 200; // Minimum distance between customer nodes
        const forceStrength = 0.3;

        return (alpha) => {
            const customerNodes = this.nodes.filter(node => node.type === 'customer');

            for (let i = 0; i < customerNodes.length; i++) {
                for (let j = i + 1; j < customerNodes.length; j++) {
                    const nodeA = customerNodes[i];
                    const nodeB = customerNodes[j];

                    const dx = nodeB.x - nodeA.x;
                    const dy = nodeB.y - nodeA.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);

                    if (distance < minDistance && distance > 0) {
                        const force = (minDistance - distance) / distance * alpha * forceStrength;
                        const fx = dx * force;
                        const fy = dy * force;

                        nodeA.vx -= fx;
                        nodeA.vy -= fy;
                        nodeB.vx += fx;
                        nodeB.vy += fy;
                    }
                }
            }
        };
    }

    /**
     * Create custom broker repulsion force
     * Creates a minimum exclusion zone around the central broker node
     */
    createBrokerRepulsionForce() {
        const minDistance = 120; // Minimum distance all nodes must maintain from broker
        const repulsionRadius = 200; // Extended influence radius
        const forceStrength = 1.5; // Strong repulsion force

        return (alpha) => {
            if (!this.brokerNode) return;

            this.nodes.forEach(node => {
                if (node.id === 'broker') return; // Skip broker itself

                const dx = node.x - this.brokerNode.x;
                const dy = node.y - this.brokerNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                // Apply very strong force within minimum distance
                if (distance < minDistance && distance > 0) {
                    const force = (minDistance - distance) / distance * alpha * forceStrength * 3;
                    const fx = dx * force;
                    const fy = dy * force;

                    node.vx += fx;
                    node.vy += fy;

                    // Hard constraint: don't allow nodes closer than minimum distance
                    const ratio = minDistance / distance;
                    node.x = this.brokerNode.x + dx * ratio;
                    node.y = this.brokerNode.y + dy * ratio;
                }
                // Apply gradual repulsion in extended radius
                else if (distance < repulsionRadius && distance > 0) {
                    const force = (repulsionRadius - distance) / distance * alpha * forceStrength;
                    const fx = dx * force;
                    const fy = dy * force;

                    node.vx += fx;
                    node.vy += fy;
                }
            });
        };
    }

    /**
     * Create force to align topic nodes with their customer nodes
     * Pushes topic nodes to the same side of broker as their customer
     */
    createTopicCustomerAlignmentForce() {
        const alignmentStrength = 0.3;

        return (alpha) => {
            if (!this.brokerNode) return;

            this.nodes.forEach(node => {
                if (node.type !== 'topic') return;

                // Find the customer node for this topic
                const customerNode = this.customerNodes.get(node.customer);
                if (!customerNode) return;

                // Calculate vectors from broker to customer and broker to topic
                const customerDx = customerNode.x - this.brokerNode.x;
                const customerDy = customerNode.y - this.brokerNode.y;
                const topicDx = node.x - this.brokerNode.x;
                const topicDy = node.y - this.brokerNode.y;

                // Calculate dot product to determine alignment
                const customerDistance = Math.sqrt(customerDx * customerDx + customerDy * customerDy);
                const topicDistance = Math.sqrt(topicDx * topicDx + topicDy * topicDy);

                if (customerDistance > 0 && topicDistance > 0) {
                    // Normalize vectors
                    const customerUx = customerDx / customerDistance;
                    const customerUy = customerDy / customerDistance;

                    // Push topic in the same direction as customer (away from broker)
                    const force = alpha * alignmentStrength;
                    node.vx += customerUx * force;
                    node.vy += customerUy * force;
                }
            });
        };
    }

    /**
     * Create boundary force to keep nodes within container
     */
    createBoundaryForce(width, height) {
        return () => {
            const padding = 50;
            this.nodes.forEach(node => {
                if (node.id === 'broker') return; // Skip fixed broker node

                const nodeRadius = node.radius || 20;

                // Apply boundary forces
                if (node.x < padding + nodeRadius) {
                    node.vx += (padding + nodeRadius - node.x) * 0.1;
                    node.x = Math.max(node.x, padding + nodeRadius);
                }
                if (node.x > width - nodeRadius - padding) {
                    node.vx += (width - nodeRadius - padding - node.x) * 0.1;
                    node.x = Math.min(node.x, width - nodeRadius - padding);
                }
                if (node.y < padding + nodeRadius) {
                    node.vy += (padding + nodeRadius - node.y) * 0.1;
                    node.y = Math.max(node.y, padding + nodeRadius);
                }
                if (node.y > height - nodeRadius - padding) {
                    node.vy += (height - nodeRadius - padding - node.y) * 0.1;
                    node.y = Math.min(node.y, height - nodeRadius - padding);
                }
            });
        };
    }

    /**
     * Create drag behavior for the broker node with rubber band snap-back
     */
    createBrokerDragBehavior() {
        const rect = this.container.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        return d3.drag()
            .on('start', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0.3).restart();
                // Store original center position
                d.centerX = centerX;
                d.centerY = centerY;
                // Unfix the broker position to allow dragging
                d.fx = d.x;
                d.fy = d.y;
            })
            .on('drag', (event, d) => {
                // Update broker position as it's dragged
                d.fx = event.x;
                d.fy = event.y;
            })
            .on('end', (event, d) => {
                if (!event.active) this.simulation.alphaTarget(0);

                // Animate broker node back to center with rubber band effect
                const snapDuration = 800;

                // Use D3 transition for smooth snap-back
                d3.transition()
                    .duration(snapDuration)
                    .ease(d3.easeElastic.period(0.3))
                    .tween('snap-back', () => {
                        const startX = d.x;
                        const startY = d.y;
                        return (t) => {
                            d.fx = startX + (centerX - startX) * t;
                            d.fy = startY + (centerY - startY) * t;
                            this.simulation.alpha(Math.max(0.1, 0.3 * (1 - t)));
                        };
                    })
                    .on('end', () => {
                        // Fix broker back to center after animation
                        d.fx = centerX;
                        d.fy = centerY;
                        this.simulation.alpha(0.3).restart();
                    });
            });
    }

    /**
     * Handle simulation tick
     */
    onTick() {
        // Update link positions
        this.linkGroups.selectAll('line')
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        // Update node positions
        this.nodeGroups.selectAll('.node-group')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);

    }

    /**
     * Activate the network graph
     */
    activate() {
        super.activate();
        this.isRunning = true;

        // Always reinitialize when switching to network mode to ensure proper setup
        console.log('NetworkGraph: Reinitializing for activation...');
        this.setupD3Container();
        this.createBrokerNode();
        this.initializeSimulation();

        this.startBrightnessDecay();
        console.log('NetworkGraph: Activated and ready');
    }

    /**
     * Deactivate the network graph
     */
    deactivate() {
        super.deactivate();
        this.isRunning = false;
        this.stopBrightnessDecay();
        this.cleanup();
    }

    /**
     * Process new MQTT message
     */
    addMessage(messageData) {
        if (!this.isRunning || !this.svg) return;

        const processedMessage = this.processMessage(messageData);
        if (!processedMessage) return;

        const customer = processedMessage.customer;
        const topic = processedMessage.topic;
        const customerColor = this.colorLegend.getCustomerColor(customer);

        // Get or create customer node
        const customerNode = this.getOrCreateCustomerNode(customer, customerColor);

        // Get or create topic node
        const topicNode = this.getOrCreateTopicNode(topic, customer, customerColor);

        // Create sequential pulse animation
        this.createSequentialPulse(this.brokerNode, customerNode, topicNode, customerColor);

        // Update activity timestamps
        customerNode.lastActivity = Date.now();
        topicNode.lastActivity = Date.now();
        this.brokerNode.lastActivity = Date.now();

        // Track performance
        this.performanceMetrics.elementsCreated++;
    }

    /**
     * Get or create customer node
     */
    getOrCreateCustomerNode(customer, color) {
        if (this.customerNodes.has(customer)) {
            const node = this.customerNodes.get(customer);
            node.brightness = 1.0; // Reset brightness on activity
            node.sizeScale = 1.0; // Reset size on activity
            return node;
        }

        // Create new customer node
        const customerNode = {
            id: customer,
            type: 'customer',
            label: customer,
            radius: this.options.customerRadius,
            baseRadius: this.options.customerRadius, // Store original radius
            color: color,
            brightness: 1.0,
            sizeScale: 1.0, // Size scaling factor
            lastActivity: Date.now(),
            messageCount: 1
        };

        // Position randomly around broker
        const angle = Math.random() * 2 * Math.PI;
        const distance = this.options.linkDistance * (0.8 + Math.random() * 0.4);
        customerNode.x = this.brokerNode.x + Math.cos(angle) * distance;
        customerNode.y = this.brokerNode.y + Math.sin(angle) * distance;

        this.nodes.push(customerNode);
        this.customerNodes.set(customer, customerNode);

        // Create link to broker
        this.links.push({
            source: this.brokerNode,
            target: customerNode,
            type: 'broker-customer'
        });

        this.updateVisualization();
        return customerNode;
    }

    /**
     * Get or create topic node (represents devices, ignoring sensor/event/signal parts)
     */
    getOrCreateTopicNode(topic, customer, color) {
        // Extract device ID from topic (customer/device/sensor/event/signal -> device)
        const deviceId = this.extractDeviceFromTopic(topic);
        const nodeId = `${customer}/${deviceId}`; // Use customer/device as unique ID

        if (this.topicNodes.has(nodeId)) {
            const node = this.topicNodes.get(nodeId);
            node.brightness = 1.0; // Reset brightness on activity
            node.sizeScale = 1.0; // Reset size on activity
            node.lastActivity = Date.now();
            node.messageCount++;
            return node;
        }

        const customerNode = this.customerNodes.get(customer);
        if (!customerNode) return null;

        // Create new topic node
        const topicNode = {
            id: nodeId,
            type: 'topic',
            label: deviceId,
            radius: this.options.topicRadius,
            baseRadius: this.options.topicRadius, // Store original radius
            color: color,
            brightness: 1.0,
            sizeScale: 1.0, // Size scaling factor
            lastActivity: Date.now(),
            messageCount: 1,
            deviceId: deviceId,
            customer: customer
        };

        // Position randomly around customer
        const angle = Math.random() * 2 * Math.PI;
        const distance = this.options.linkDistance * 0.7;
        topicNode.x = customerNode.x + Math.cos(angle) * distance;
        topicNode.y = customerNode.y + Math.sin(angle) * distance;

        this.nodes.push(topicNode);
        this.topicNodes.set(nodeId, topicNode);

        // Create link to customer
        this.links.push({
            source: customerNode,
            target: topicNode,
            type: 'customer-topic'
        });

        this.updateVisualization();
        return topicNode;
    }


    /**
     * Get the number of topic nodes connected to a customer
     */
    getCustomerTopicCount(customerId) {
        let count = 0;
        this.topicNodes.forEach((node) => {
            if (node.customer === customerId) {
                count++;
            }
        });
        return count;
    }

    /**
     * Extract device ID from topic for node grouping
     * All messages from the same device use the same node, regardless of message type
     * Examples:
     * - customer/device123/json -> device123 (same node)
     * - customer/device123/event -> device123 (same node)
     * - customer/device123/signal -> device123 (same node)
     * - customer/device456/sensor/temperature -> device456 (same node)
     */
    extractDeviceFromTopic(topic) {
        if (!topic) return 'device';
        const parts = topic.split('/');

        // For network mode, group all messages by device (second part)
        // This ensures customer/device/json, customer/device/event, customer/device/signal
        // all update the same device node
        if (parts.length >= 2) {
            return parts[1]; // Return the device ID for grouping
        }

        return parts[0] || 'device';
    }

    /**
     * Update D3 visualization
     */
    updateVisualization() {
        // Update simulation data
        this.simulation.nodes(this.nodes);
        this.simulation.force('link').links(this.links);

        // Update links
        const linkSelection = this.linkGroups.selectAll('line')
            .data(this.links, d => `${d.source.id}-${d.target.id}`);

        linkSelection.enter()
            .append('line')
            .attr('stroke', '#666')
            .attr('stroke-width', 2)
            .attr('opacity', 0.6);

        linkSelection.exit().remove();

        // Update nodes
        const nodeSelection = this.nodeGroups.selectAll('.node-group')
            .data(this.nodes, d => d.id);

        const nodeEnter = nodeSelection.enter()
            .append('g')
            .attr('class', 'node-group')
            .style('cursor', 'pointer');

        // Add circles
        nodeEnter.append('circle')
            .attr('r', d => d.radius)
            .attr('fill', d => d.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

        // Add main labels
        nodeEnter.append('text')
            .attr('class', 'node-label')
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.radius + 15)
            .attr('fill', 'white')
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .style('pointer-events', 'none')
            .text(d => d.label);

        // Add device count numbers in center of customer nodes
        nodeEnter.filter(d => d.type === 'customer')
            .append('text')
            .attr('class', 'device-count')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('fill', 'white')
            .attr('font-size', '18px')
            .attr('font-weight', 'bolder')
            .style('pointer-events', 'none')
            .style('text-shadow', '1px 1px 2px rgba(0,0,0,0.8)')
            .text(d => {
                const count = this.getCustomerTopicCount(d.id);
                return count.toString();
            });


        // Add drag behavior to broker node
        nodeEnter.filter(d => d.type === 'broker')
            .call(this.createBrokerDragBehavior());

        // Add click handlers
        nodeEnter.on('click', (event, d) => {
            this.eventEmitter.emit('node_clicked', {
                node: d,
                event: event
            });
        });

        // Update existing device count numbers
        nodeSelection.selectAll('.device-count')
            .text(d => {
                if (d.type !== 'customer') return '';
                const count = this.getCustomerTopicCount(d.id);
                return count.toString();
            });

        nodeSelection.exit().remove();

        // Restart simulation
        this.simulation.alpha(0.3).restart();
    }

    /**
     * Create sequential pulse animation: Topic → Customer → Broker
     * Visualizes messages flowing inward from devices to the MQTT broker
     */
    createSequentialPulse(brokerNode, customerNode, topicNode, color) {
        if (!brokerNode || !customerNode || !topicNode) return;

        const phaseDuration = 750; // 750ms per phase (faster than original 1500ms)

        // Phase 1: Topic → Customer (from device towards customer node)
        const pulse1 = this.createPulseElement(topicNode, color);
        pulse1.transition()
            .duration(phaseDuration)
            .ease(d3.easeQuadIn)
            .attr('cx', customerNode.x)
            .attr('cy', customerNode.y)
            .on('end', () => {
                // Phase 2: Customer → Broker (from customer to central broker)
                const pulse2 = this.createPulseElement(customerNode, color);
                pulse2.transition()
                    .duration(phaseDuration)
                    .ease(d3.easeQuadIn)
                    .attr('cx', brokerNode.x)
                    .attr('cy', brokerNode.y)
                    .style('opacity', 0)
                    .on('end', () => pulse2.remove());

                // Clean up first pulse
                pulse1.remove();
            });
    }

    /**
     * Create pulse animation between nodes (legacy method for compatibility)
     */
    createPulse(fromNode, toNode) {
        if (!fromNode || !toNode) return;

        const pulse = this.createPulseElement(fromNode, fromNode.color);
        pulse.transition()
            .duration(this.options.pulseDuration)
            .ease(d3.easeQuadOut)
            .attr('cx', toNode.x)
            .attr('cy', toNode.y)
            .style('opacity', 0)
            .on('end', () => pulse.remove());
    }

    /**
     * Create a pulse element with consistent styling
     */
    createPulseElement(fromNode, color) {
        return this.pulseGroups.append('circle')
            .attr('r', this.options.pulseRadius * 0.7) // 30% smaller
            .attr('cx', fromNode.x)
            .attr('cy', fromNode.y)
            .attr('fill', color)
            .attr('opacity', 0.4) // 50% more transparent (0.8 * 0.5 = 0.4)
            .style('filter', 'drop-shadow(0 0 4px rgba(255,255,255,0.5))'); // Subtle glow
    }

    /**
     * Start brightness decay system
     */
    startBrightnessDecay() {
        if (this.brightnessInterval) {
            clearInterval(this.brightnessInterval);
        }

        this.brightnessInterval = setInterval(() => {
            this.nodes.forEach(node => {
                if (node.id === 'broker') return;

                // Decay brightness over time
                const timeSinceActivity = Date.now() - node.lastActivity;
                const decayFactor = Math.pow(this.options.brightnessDecayRate, timeSinceActivity / 1000);
                node.brightness = Math.max(this.options.minBrightness, decayFactor);

                // Decay size over time (using same decay rate for consistency)
                const sizeDecayFactor = Math.pow(this.options.sizeDecayRate, timeSinceActivity / 1000);
                node.sizeScale = Math.max(this.options.minSizeScale, sizeDecayFactor);

                // Update actual radius based on scale
                node.radius = node.baseRadius * node.sizeScale;
            });

            // Update visual brightness and size
            this.nodeGroups.selectAll('circle')
                .attr('opacity', d => d.brightness)
                .attr('r', d => d.radius);

            this.nodeGroups.selectAll('.node-label')
                .attr('opacity', d => d.brightness);

            this.nodeGroups.selectAll('.device-count')
                .attr('opacity', d => d.brightness * 0.7); // Slightly dimmer than main labels

            this.linkGroups.selectAll('line')
                .attr('opacity', d => Math.min(d.source.brightness, d.target.brightness) * 0.6);

        }, 100); // Update every 100ms
    }

    /**
     * Stop brightness decay system
     */
    stopBrightnessDecay() {
        if (this.brightnessInterval) {
            clearInterval(this.brightnessInterval);
            this.brightnessInterval = null;
        }
    }

    /**
     * Setup window resize handler
     */
    setupResizeHandler() {
        const resizeHandler = () => {
            this.updateViewport();
        };

        // Listen for window resize
        window.addEventListener('resize', resizeHandler);
        this.resizeHandler = resizeHandler;

        // Also listen for sidebar toggle events (if available)
        if (this.eventEmitter) {
            this.eventEmitter.on('sidebar_toggled', () => {
                // Small delay to allow DOM to update
                setTimeout(() => {
                    this.updateViewport();
                }, 100);
            });
        }

        // Periodically check for container size changes (fallback)
        this.containerCheckInterval = setInterval(() => {
            const rect = this.container.getBoundingClientRect();
            if (this.lastWidth !== rect.width || this.lastHeight !== rect.height) {
                console.log('NetworkGraph: Container size changed, updating viewport');
                this.updateViewport();
            }
        }, 1000); // Check every second
    }

    /**
     * Update viewport and force simulation for current container dimensions
     */
    updateViewport() {
        const rect = this.container.getBoundingClientRect();
        console.log('NetworkGraph: Updating viewport to', rect.width, 'x', rect.height);

        // Store dimensions for change detection
        this.lastWidth = rect.width;
        this.lastHeight = rect.height;

        if (this.svg) {
            this.svg
                .attr('width', rect.width)
                .attr('height', rect.height);
        }

        if (this.simulation && this.brokerNode) {
            // Update broker position to new center
            this.brokerNode.fx = rect.width / 2;
            this.brokerNode.fy = rect.height / 2;

            // Update forces with new dimensions
            this.simulation
                .force('center', d3.forceCenter(rect.width / 2, rect.height / 2))
                .force('brokerRepulsion', this.createBrokerRepulsionForce())
                .force('topicCustomerAlignment', this.createTopicCustomerAlignmentForce())
                .force('boundary', this.createBoundaryForce(rect.width, rect.height))
                .alpha(0.5) // Higher alpha for more aggressive repositioning
                .restart();
        }
    }

    /**
     * Handle theme changes
     */
    handleThemeChange(themeData) {
        super.handleThemeChange(themeData);

        // Update existing nodes with new theme colors
        this.customerNodes.forEach((node, customer) => {
            const newColor = this.colorLegend.getCustomerColor(customer);
            node.color = newColor;
        });

        this.topicNodes.forEach((node, topic) => {
            const customer = this.extractCustomerFromTopic(topic);
            const newColor = this.colorLegend.getCustomerColor(customer);
            node.color = newColor;
        });

        // Update visual colors
        if (this.nodeGroups) {
            this.nodeGroups.selectAll('circle')
                .transition()
                .duration(300)
                .attr('fill', d => d.color);
        }
    }

    /**
     * Clean up all network elements
     */
    cleanup() {
        this.stopBrightnessDecay();

        if (this.simulation) {
            this.simulation.stop();
        }

        if (this.svg) {
            this.svg.selectAll('*').remove();
        }

        // Clear data structures
        this.nodes = [this.brokerNode].filter(Boolean);
        this.links = [];
        this.customerNodes.clear();
        this.topicNodes.clear();

        super.cleanup();
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...super.getState(),
            isRunning: this.isRunning,
            activeNodes: this.nodes.length,
            activeLinks: this.links.length,
            customerCount: this.customerNodes.size,
            topicCount: this.topicNodes.size
        };
    }

    /**
     * Debug method to force re-initialization and show detailed info
     */
    debugReinitialize() {
        console.log('🔧 NetworkGraph: Force re-initialization for debugging...');
        this.cleanup();
        this.setupD3Container();
        this.createBrokerNode();
        this.initializeSimulation();
        console.log('🔧 NetworkGraph: Re-initialization complete');
    }

    /**
     * Destroy the network graph
     */
    destroy() {
        this.cleanup();

        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }

        if (this.containerCheckInterval) {
            clearInterval(this.containerCheckInterval);
        }

        if (this.svg) {
            this.svg.remove();
        }

        super.destroy();
    }
}

export default NetworkGraph;