/**
 * Clustered Bubbles Visualization
 *
 * D3 Force-based clustered bubbles visualization that groups messages by customer
 * and visualizes them as clustered bubbles with physics-based movement.
 * Includes automatic cleanup, fade-out effects, and dynamic cluster positioning.
 */

import { BaseVisualization } from './BaseVisualization.js';

class ClusteredBubbles extends BaseVisualization {
    constructor(domManager, eventEmitter, themeManager, colorLegend, options = {}) {
        super(domManager, eventEmitter, themeManager, options);

        this.colorLegend = colorLegend;
        this.options = {
            ...this.options,
            maxNodes: 200,              // Maximum number of nodes to display
            clusterStrength: 0.8,       // Force strength for clustering
            collisionPadding: 2,        // Padding within same cluster
            interClusterPadding: 15,    // Padding between different clusters
            velocityDecay: 0.8,         // Damping for movement
            alphaDecay: 0.02,           // Force simulation decay rate
            alphaMin: 0.005,            // Minimum alpha before stopping
            nodeRadius: 25,             // Fixed radius for message nodes
            clusterRadius: 150,         // Distance from center for cluster positioning
            messageLifetime: 10000,     // How long messages stay (10 seconds)
            fadeTime: 3000,             // How long fade out takes (3 seconds)
            ...options
        };

        // D3 components
        this.svg = null;
        this.simulation = null;
        this.nodesGroup = null;

        // Data structures
        this.nodes = [];
        this.clusters = new Map();      // customer -> cluster info
        this.nodeIdCounter = 0;

        // Animation state
        this.isRunning = false;
    }

    /**
     * Initialize the clustered bubbles visualization
     */
    initialize() {
        console.log('🚀 ClusteredBubbles: Starting initialization...');
        super.initialize();

        if (!this.container) {
            console.error('❌ ClusteredBubbles: No container found after base initialization!');
            return this;
        }

        this.setupD3Container();
        this.setupSimulation();
        this.setupResizeHandler();
        console.log('ClusteredBubbles: Initialized successfully');
        return this;
    }

    /**
     * Setup D3 SVG container
     */
    setupD3Container() {
        if (!this.container) {
            console.error('ClusteredBubbles: Container not found');
            return;
        }

        // Remove any existing SVG
        const existingSvg = this.container.querySelector('svg.clustered-bubbles');
        if (existingSvg) {
            existingSvg.remove();
        }

        // Get container dimensions
        const rect = this.container.getBoundingClientRect();

        // Create SVG with D3
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('class', 'clustered-bubbles')
            .attr('width', rect.width)
            .attr('height', rect.height)
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('pointer-events', 'auto')
            .style('z-index', '10');

        // Create group for nodes
        this.nodesGroup = this.svg.append('g')
            .attr('class', 'cluster-nodes');

        console.log('ClusteredBubbles: D3 container setup complete');
    }

    /**
     * Setup D3 force simulation
     */
    setupSimulation() {
        // Create custom forces
        const forceCluster = this.createClusterForce();
        const forceCollide = d3.forceCollide()
            .radius(d => d.radius + this.options.collisionPadding)
            .strength(0.7)
            .iterations(2);

        const containerRect = this.container.getBoundingClientRect();
        const centerX = containerRect.width / 2;
        const centerY = containerRect.height / 2;

        // Create D3 force simulation
        this.simulation = d3.forceSimulation(this.nodes)
            .velocityDecay(this.options.velocityDecay)
            .alphaDecay(this.options.alphaDecay)
            .alphaMin(this.options.alphaMin)
            .force('cluster', forceCluster)
            .force('collide', forceCollide)
            .force('center', d3.forceCenter(centerX, centerY).strength(0.05))
            .on('tick', () => this.onTick());

        console.log('ClusteredBubbles: Force simulation initialized');
    }

    /**
     * Create custom cluster force that attracts nodes to their cluster center
     */
    createClusterForce() {
        return () => {
            if (!this.simulation) return;

            const alpha = this.simulation.alpha();
            const strength = this.options.clusterStrength * alpha;

            this.nodes.forEach(node => {
                if (!node.cluster) return;

                const cluster = this.clusters.get(node.cluster);
                if (!cluster) return;

                // Apply force towards cluster center
                const dx = cluster.x - node.x;
                const dy = cluster.y - node.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 0) {
                    const force = strength * node.radius;
                    node.vx += (dx / distance) * force;
                    node.vy += (dy / distance) * force;
                }
            });
        };
    }

    /**
     * Setup window resize handler
     */
    setupResizeHandler() {
        const resizeHandler = () => {
            const rect = this.container.getBoundingClientRect();

            if (this.svg) {
                this.svg
                    .attr('width', rect.width)
                    .attr('height', rect.height);
            }

            // Update simulation center
            if (this.simulation) {
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                this.simulation.force('center', d3.forceCenter(centerX, centerY).strength(0.05));

                // Update cluster positions
                this.updateClusterPositions(centerX, centerY);
            }
        };

        window.addEventListener('resize', resizeHandler);
        this.resizeHandler = resizeHandler;
    }

    /**
     * Update cluster positions when container size changes
     */
    updateClusterPositions(centerX, centerY) {
        let clusterIndex = 0;
        this.clusters.forEach((cluster, customer) => {
            const angle = (clusterIndex * 137.5) * (Math.PI / 180); // Golden angle distribution
            const distance = this.options.clusterRadius + clusterIndex * 30;

            cluster.x = centerX + Math.cos(angle) * distance;
            cluster.y = centerY + Math.sin(angle) * distance;
            clusterIndex++;
        });

        if (this.simulation) {
            this.simulation.alpha(0.3).restart();
        }
    }

    /**
     * Activate the clustered bubbles visualization
     */
    activate() {
        super.activate();
        this.isRunning = true;
        console.log('ClusteredBubbles: Activated');
    }

    /**
     * Deactivate the clustered bubbles visualization
     */
    deactivate() {
        super.deactivate();
        this.isRunning = false;
        this.cleanup();
        console.log('ClusteredBubbles: Deactivated');
    }

    /**
     * Add a new message to the clustering visualization
     */
    addMessage(messageData) {
        if (!this.isRunning || !this.svg) return;

        // Process message with base class
        const processedMessage = this.processMessage(messageData);
        if (!processedMessage) return;

        // Get customer and color
        const customer = this.extractCustomerFromTopic(processedMessage.topic);
        const deviceId = this.extractDeviceFromTopic(processedMessage.topic);
        const color = this.colorLegend.getCustomerColor(customer);

        // Ensure cluster exists for this customer
        this.ensureClusterExists(customer, color);

        // Create node data
        const nodeId = `cluster-node-${this.nodeIdCounter++}`;
        const cluster = this.clusters.get(customer);

        // Add small random offset from cluster center
        const offsetRadius = 40;
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * offsetRadius;

        const node = {
            id: nodeId,
            customer: customer,
            device: deviceId,
            cluster: customer,
            radius: this.options.nodeRadius,
            color: color,
            message: processedMessage,
            createdAt: Date.now(),
            // Start near cluster center with small random offset
            x: cluster.x + Math.cos(angle) * distance,
            y: cluster.y + Math.sin(angle) * distance,
            vx: 0,
            vy: 0
        };

        // Add to nodes array
        this.nodes.push(node);

        // Update simulation
        this.updateSimulation();

        // Schedule removal
        this.scheduleNodeRemoval(node);

        // Limit number of active nodes
        if (this.nodes.length > this.options.maxNodes) {
            this.removeOldestNode();
        }

        // Track performance
        this.performanceMetrics.elementsCreated++;

        console.log(`ClusteredBubbles: Added node for ${customer}/${deviceId}, total nodes: ${this.nodes.length}`);
    }

    /**
     * Ensure cluster exists for the given customer
     */
    ensureClusterExists(customer, color) {
        if (!this.clusters.has(customer)) {
            const containerRect = this.container.getBoundingClientRect();
            const centerX = containerRect.width / 2;
            const centerY = containerRect.height / 2;

            // Position clusters in a circle around the center using golden angle
            const clusterIndex = this.clusters.size;
            const angle = (clusterIndex * 137.5) * (Math.PI / 180); // Golden angle
            const distance = this.options.clusterRadius + clusterIndex * 30;

            const cluster = {
                id: customer,
                color: color,
                x: centerX + Math.cos(angle) * distance,
                y: centerY + Math.sin(angle) * distance,
                nodeCount: 0
            };

            this.clusters.set(customer, cluster);
            console.log(`ClusteredBubbles: Created cluster for ${customer} at (${cluster.x.toFixed(1)}, ${cluster.y.toFixed(1)})`);
        }
    }

    /**
     * Update the D3 simulation with current nodes
     */
    updateSimulation() {
        if (!this.simulation) return;

        this.simulation.nodes(this.nodes);
        this.simulation.alpha(0.3).restart();

        // Update visual representation
        this.updateVisuals();
    }

    /**
     * Update visual representation using D3 data binding
     */
    updateVisuals() {
        if (!this.nodesGroup) return;

        // Bind data to node groups
        const nodeSelection = this.nodesGroup.selectAll('g.cluster-node')
            .data(this.nodes, d => d.id);

        // Remove exiting nodes with animation
        nodeSelection.exit()
            .transition()
            .duration(this.options.fadeTime)
            .style('opacity', 0)
            .attr('transform', d => `translate(${d.x}, ${d.y}) scale(0)`)
            .remove();

        // Create entering nodes
        const nodeEnter = nodeSelection.enter()
            .append('g')
            .attr('class', 'cluster-node')
            .attr('data-node-id', d => d.id)
            .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`)
            .style('opacity', 0)
            .style('cursor', 'pointer');

        // Add circle to each node
        nodeEnter.append('circle')
            .attr('r', d => d.radius)
            .attr('fill', d => d.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2)
            .style('filter', 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))');

        // Add device label
        nodeEnter.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', d => d.radius + 15)
            .attr('fill', 'white')
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .style('pointer-events', 'none')
            .style('user-select', 'none')
            .text(d => d.device);

        // Add click handler
        nodeEnter.on('click', (event, d) => {
            this.eventEmitter.emit('cluster_node_clicked', {
                node: d,
                message: d.message
            });
        });

        // Add hover effects
        nodeEnter
            .on('mouseenter', function(event, d) {
                d3.select(this).select('circle')
                    .transition()
                    .duration(150)
                    .attr('r', d.radius * 1.1)
                    .style('filter', 'drop-shadow(4px 4px 8px rgba(0,0,0,0.4))');
            })
            .on('mouseleave', function(event, d) {
                d3.select(this).select('circle')
                    .transition()
                    .duration(150)
                    .attr('r', d.radius)
                    .style('filter', 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))');
            });

        // Animate entering nodes
        nodeEnter.transition()
            .duration(500)
            .delay((d, i) => i * 20)
            .style('opacity', 1)
            .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0}) scale(1)`);

        // Update existing nodes
        nodeSelection.merge(nodeEnter)
            .select('circle')
            .transition()
            .duration(200)
            .attr('fill', d => d.color);
    }

    /**
     * Handle simulation tick events
     */
    onTick() {
        if (!this.nodesGroup) return;

        // Update node positions
        this.nodesGroup.selectAll('g.cluster-node')
            .attr('transform', d => `translate(${d.x}, ${d.y})`);
    }

    /**
     * Schedule removal of a node after its lifetime
     */
    scheduleNodeRemoval(node) {
        setTimeout(() => {
            this.removeNode(node.id);
        }, this.options.messageLifetime);
    }

    /**
     * Remove a specific node
     */
    removeNode(nodeId) {
        const nodeIndex = this.nodes.findIndex(n => n.id === nodeId);
        if (nodeIndex >= 0) {
            // Start fade animation before removing from data
            const nodeElement = this.nodesGroup.select(`[data-node-id="${nodeId}"]`);
            if (nodeElement.node()) {
                nodeElement.transition()
                    .duration(this.options.fadeTime)
                    .style('opacity', 0)
                    .on('end', () => {
                        // Remove from data array after animation
                        const finalIndex = this.nodes.findIndex(n => n.id === nodeId);
                        if (finalIndex >= 0) {
                            this.nodes.splice(finalIndex, 1);
                            this.updateSimulation();
                            this.performanceMetrics.elementsDestroyed++;
                        }
                    });
            } else {
                // No visual element, just remove from data
                this.nodes.splice(nodeIndex, 1);
                this.updateSimulation();
                this.performanceMetrics.elementsDestroyed++;
            }
        }
    }

    /**
     * Remove the oldest node to maintain performance
     */
    removeOldestNode() {
        let oldestNode = null;
        let oldestTime = Date.now();

        this.nodes.forEach(node => {
            if (node.createdAt < oldestTime) {
                oldestTime = node.createdAt;
                oldestNode = node;
            }
        });

        if (oldestNode) {
            this.removeNode(oldestNode.id);
        }
    }

    /**
     * Clean up all nodes and simulations
     */
    cleanup() {
        if (this.simulation) {
            this.simulation.stop();
        }

        if (this.nodesGroup) {
            this.nodesGroup.selectAll('.cluster-node').remove();
        }

        this.nodes = [];
        this.clusters.clear();
        this.nodeIdCounter = 0;

        console.log('ClusteredBubbles: Cleanup completed');
        super.cleanup();
    }

    /**
     * Handle theme changes
     */
    handleThemeChange(themeData) {
        super.handleThemeChange(themeData);

        // Update existing nodes with new theme colors
        this.nodes.forEach(node => {
            const newColor = this.colorLegend.getCustomerColor(node.customer);
            node.color = newColor;

            // Update cluster color too
            const cluster = this.clusters.get(node.customer);
            if (cluster) {
                cluster.color = newColor;
            }
        });

        // Update visuals
        this.updateVisuals();
    }

    /**
     * Get current state
     */
    getState() {
        return {
            ...super.getState(),
            isRunning: this.isRunning,
            activeNodes: this.nodes.length,
            activeClusters: this.clusters.size,
            simulationAlpha: this.simulation ? this.simulation.alpha() : 0
        };
    }

    /**
     * Destroy the clustered bubbles visualization
     */
    destroy() {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }

        this.cleanup();

        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
        }

        if (this.svg) {
            this.svg.remove();
        }

        super.destroy();
        console.log('ClusteredBubbles: Destroyed');
    }
}

export default ClusteredBubbles;