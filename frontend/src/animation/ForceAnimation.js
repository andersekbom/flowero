/**
 * Force Animation
 *
 * Handles D3 force-based simulations for network graph visualizations.
 * Provides boundary enforcement, collision detection, and smooth physics-based
 * movement for nodes and links in a force-directed layout.
 */
class ForceAnimation {
    constructor(container, nodes, links, options = {}) {
        this.container = container;
        this.nodes = nodes;
        this.links = links;

        // Default options based on existing implementation
        this.options = {
            width: 800,
            height: 600,
            velocityDecay: 0.75,
            alphaDecay: 0.01,
            alphaMin: 0.001,
            // Force configurations
            linkDistance: 250,
            linkStrength: 0.2,
            chargeStrength: -800,
            chargeDistanceMax: 400,
            centerStrength: 0.05,
            collisionRadius: 25,
            collisionStrength: 0.3,
            boundaryPadding: 30,
            ...options
        };

        this.simulation = null;
        this.onTick = null;
    }

    /**
     * Create boundary force that keeps nodes within viewport
     * @param {number} width - Container width
     * @param {number} height - Container height
     * @returns {Function} Boundary force function
     */
    createBoundaryForce(width, height) {
        return (alpha) => {
            this.nodes.forEach(node => {
                // Skip fixed nodes (like broker)
                if (node.type === 'broker' || node.fx !== undefined) return;

                const nodeRadius = node.radius || 20;
                const padding = nodeRadius + this.options.boundaryPadding;

                // Apply exponential force that gets stronger near boundaries
                if (node.x < padding) {
                    const penetration = padding - node.x;
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vx += forceStrength * alpha * 2;
                }
                if (node.x > width - padding) {
                    const penetration = node.x - (width - padding);
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vx -= forceStrength * alpha * 2;
                }
                if (node.y < padding) {
                    const penetration = padding - node.y;
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vy += forceStrength * alpha * 2;
                }
                if (node.y > height - padding) {
                    const penetration = node.y - (height - padding);
                    const forceStrength = Math.min(0.8, 0.1 + (penetration / padding) * 0.7);
                    node.vy -= forceStrength * alpha * 2;
                }
            });
        };
    }

    /**
     * Handle simulation tick with boundary enforcement
     */
    handleTick() {
        // Enforce hard boundary constraints before updating visuals
        this.nodes.forEach(node => {
            if (node.type === 'broker' || node.fx !== undefined) return; // Skip fixed nodes

            const nodeRadius = node.radius || 20;
            const padding = nodeRadius + this.options.boundaryPadding;

            // Hard boundary enforcement - never allow nodes to go off screen
            node.x = Math.max(padding, Math.min(this.options.width - padding, node.x));
            node.y = Math.max(padding, Math.min(this.options.height - padding, node.y));
        });

        // Call custom tick handler if provided
        if (this.onTick) {
            this.onTick(this.nodes, this.links);
        }
    }

    /**
     * Initialize the force simulation
     * @param {Function} onTick - Tick callback function
     * @returns {Object} D3 force simulation instance
     */
    initialize(onTick = null) {
        this.onTick = onTick;

        // Create D3 force simulation with smoother movement
        this.simulation = d3.forceSimulation(this.nodes)
            .velocityDecay(this.options.velocityDecay)
            .alphaDecay(this.options.alphaDecay)
            .alphaMin(this.options.alphaMin)
            .force('link', d3.forceLink(this.links)
                .id(d => d.id)
                .distance(d => d.distance || this.options.linkDistance)
                .strength(this.options.linkStrength))
            .force('charge', d3.forceManyBody()
                .strength(this.options.chargeStrength)
                .distanceMax(this.options.chargeDistanceMax))
            .force('center', d3.forceCenter(this.options.width / 2, this.options.height / 2)
                .strength(this.options.centerStrength))
            .force('collision', d3.forceCollide()
                .radius(d => (d.radius || 20) + this.options.collisionRadius)
                .strength(this.options.collisionStrength))
            .force('boundary', this.createBoundaryForce(this.options.width, this.options.height))
            .on('tick', () => this.handleTick());

        return this.simulation;
    }

    /**
     * Update simulation dimensions
     * @param {number} width - New width
     * @param {number} height - New height
     */
    updateDimensions(width, height) {
        this.options.width = width;
        this.options.height = height;

        if (this.simulation) {
            // Update center force
            this.simulation.force('center', d3.forceCenter(width / 2, height / 2)
                .strength(this.options.centerStrength));

            // Update boundary force
            this.simulation.force('boundary', this.createBoundaryForce(width, height));

            // Update broker node position if it exists
            const brokerNode = this.nodes.find(n => n.id === 'broker');
            if (brokerNode) {
                brokerNode.fx = width / 2;
                brokerNode.fy = height / 2;
            }

            // Restart simulation with moderate alpha
            this.simulation.alpha(0.3).restart();
        }
    }

    /**
     * Add nodes and links to simulation
     * @param {Array} nodes - Array of node objects
     * @param {Array} links - Array of link objects
     */
    update(nodes, links) {
        this.nodes = nodes;
        this.links = links;

        if (this.simulation) {
            this.simulation.nodes(nodes);
            this.simulation.force('link').links(links);
            this.simulation.alpha(0.3).restart();
        }
    }

    /**
     * Stop the simulation
     */
    stop() {
        if (this.simulation) {
            this.simulation.stop();
        }
    }

    /**
     * Restart the simulation
     * @param {number} alpha - Alpha value for simulation energy
     */
    restart(alpha = 0.3) {
        if (this.simulation) {
            this.simulation.alpha(alpha).restart();
        }
    }
}

export default ForceAnimation;