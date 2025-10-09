/**
 * Mode Manager
 *
 * Manages clean transitions between visualization modes with proper cleanup
 * and initialization. Ensures no conflicts between different visualization modes.
 */
import ContainerSystem from '../core/ContainerSystem.js';
import ClustersAnimation from '../animation/ClustersAnimation.js';

class ModeManager {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.currentMode = null;
        this.isTransitioning = false;
        this.transitionTimeout = null;
    }

    /**
     * Clean switch to new mode with proper cleanup
     * @param {string} newMode - Target visualization mode
     * @returns {boolean} True if mode switch was successful
     */
    switchMode(newMode) {
        if (this.isTransitioning) {
            console.log('ModeManager: Mode switch already in progress, ignoring request');
            return false;
        }

        if (this.currentMode === newMode) {
            console.log(`ModeManager: Already in ${newMode} mode`);
            return true;
        }

        console.log(`ModeManager: Switching from ${this.currentMode || 'none'} to ${newMode}`);

        this.isTransitioning = true;

        // Step 1: Clean up current mode
        this.cleanupCurrentMode();

        // Step 2: Update UI states
        this.updateModeButtons(newMode);

        // Step 3: Initialize new mode
        this.initializeNewMode(newMode);

        // Step 4: Complete transition
        this.completeTransition(newMode);

        return true;
    }

    /**
     * Clean up all elements and state from current mode
     */
    cleanupCurrentMode() {
        if (!this.currentMode) return;

        console.log(`ModeManager: Cleaning up ${this.currentMode} mode`);

        // Clear all active animations and elements
        if (this.visualizer.unifiedContainer) {
            this.visualizer.unifiedContainer.cleanup();
        }

        // Reset cleanup manager
        if (this.visualizer.cleanupManager) {
            this.visualizer.cleanupManager.reset();
        }

        // Clear element tracker
        if (this.visualizer.elementTracker) {
            this.visualizer.elementTracker.reset();
        }

        // Clear color legend and visualization state
        this.visualizer.resetVisualizationState();

        // Stop ClustersAnimation if it exists
        if (this.visualizer.clustersAnimation) {
            this.visualizer.clustersAnimation.stop();
            this.visualizer.clustersAnimation = null;
        }

        // Remove mode-specific CSS classes
        this.visualizer.domElements.messageFlow.classList.remove(
            'starfield-mode', 'radial-mode', 'network-mode', 'bubbles-mode', 'clusters-mode', 'map-mode'
        );

        // Clear any mode-specific timers or intervals
        this.clearModeTimers();
    }

    /**
     * Update button states to reflect new mode
     * @param {string} newMode - Target mode
     */
    updateModeButtons(newMode) {
        // Use sidebar controller to update visualization buttons
        this.visualizer.sidebarController.updateVisualizationButtons(newMode);
    }

    /**
     * Initialize the new visualization mode
     * @param {string} newMode - Target mode
     */
    initializeNewMode(newMode) {
        console.log(`ModeManager: Initializing ${newMode} mode`);

        // Set the new mode
        this.visualizer.visualizationMode = newMode;

        // Add mode-specific CSS class
        this.visualizer.domElements.messageFlow.classList.add(`${newMode}-mode`);

        // Initialize unified container for unified modes
        if (['bubbles', 'starfield'].includes(newMode)) {
            this.initializeUnifiedMode(newMode);
        } else if (newMode === 'network') {
            this.initializeNetworkMode();
        } else if (newMode === 'map') {
            this.initializeMapMode();
        } else if (newMode === 'clusters') {
            this.initializeClustersMode();
        }

        // Update layout for new mode
        if (this.visualizer.layoutCalculator && this.visualizer.unifiedContainer) {
            this.visualizer.unifiedContainer.updateDimensions(this.visualizer.layoutCalculator);
        }
    }

    /**
     * Initialize unified container modes (bubbles, starfield)
     * @param {string} mode - Mode being initialized
     */
    initializeUnifiedMode(mode) {
        // Initialize unified container if not exists
        if (!this.visualizer.unifiedContainer) {
            this.visualizer.unifiedContainer = new ContainerSystem(this.visualizer.domElements.messageFlow);
        }

        // Initialize with layout calculator
        this.visualizer.unifiedContainer.initialize(this.visualizer.layoutCalculator);

        console.log(`ModeManager: Unified mode ${mode} initialized`);
    }

    /**
     * Network mode initialization is handled by NetworkGraph component
     */
    initializeNetworkMode() {
        console.log('ModeManager: Network mode initialization delegated to NetworkGraph component');
    }

    /**
     * Map mode initialization is handled by MapVisualization component
     */
    initializeMapMode() {
        console.log('ModeManager: Map mode initialization delegated to MapVisualization component');
    }

    /**
     * Initialize clusters mode using ClustersAnimation
     */
    initializeClustersMode() {
        console.log('ModeManager: Initializing clusters mode');

        // Initialize unified container for clusters mode
        if (!this.visualizer.unifiedContainer) {
            this.visualizer.unifiedContainer = new ContainerSystem(this.visualizer.domElements.messageFlow);
            console.log('Created new unified container for clusters');
        }

        // Initialize container with layout calculator
        this.visualizer.unifiedContainer.initialize(this.visualizer.layoutCalculator);
        console.log('Initialized unified container with layout calculator');

        // Create ClustersAnimation instance
        const containerGroup = this.visualizer.unifiedContainer.getContainer();
        console.log('Got container group:', containerGroup);

        this.visualizer.clustersAnimation = new ClustersAnimation(
            containerGroup,
            this.visualizer.layoutCalculator,
            this.visualizer.elementSystem
        );
        console.log('Created ClustersAnimation instance:', this.visualizer.clustersAnimation);

        // Initialize the clusters simulation
        this.visualizer.clustersAnimation.initialize();

        console.log('ModeManager: Clusters mode initialized successfully');
    }

    /**
     * Complete the mode transition
     * @param {string} newMode - Mode that was switched to
     */
    completeTransition(newMode) {
        this.currentMode = newMode;
        this.isTransitioning = false;

        // Clear any pending transition timeout
        if (this.transitionTimeout) {
            clearTimeout(this.transitionTimeout);
            this.transitionTimeout = null;
        }

        console.log(`ModeManager: Transition to ${newMode} complete`);

        // Trigger any mode-specific post-initialization
        this.postModeInitialization(newMode);
    }

    /**
     * Mode-specific post-initialization tasks
     * @param {string} mode - Mode that was initialized
     */
    postModeInitialization(mode) {
        switch (mode) {
            case 'network':
                // Network mode might need additional setup
                break;
            case 'starfield':
                // Starfield mode might need background setup
                break;
            default:
                // Other modes are ready immediately
                break;
        }
    }

    /**
     * Clear any mode-specific timers or intervals
     */
    clearModeTimers() {
        // Clear any network mode intervals
        if (this.visualizer.brightnessInterval) {
            clearInterval(this.visualizer.brightnessInterval);
            this.visualizer.brightnessInterval = null;
        }

        // Stop any D3 simulations
        if (this.visualizer.d3Simulation) {
            this.visualizer.d3Simulation.stop();
            this.visualizer.d3Simulation = null;
        }
    }

    /**
     * Get current transition state
     * @returns {Object} Current state information
     */
    getState() {
        return {
            currentMode: this.currentMode,
            isTransitioning: this.isTransitioning,
            hasActiveElements: this.visualizer.elementTracker ?
                             this.visualizer.elementTracker.getCounts().total > 0 : false
        };
    }

    /**
     * Force complete any pending transition (emergency cleanup)
     */
    forceCompleteTransition() {
        if (this.isTransitioning) {
            console.warn('ModeManager: Force completing transition');
            this.isTransitioning = false;
            if (this.transitionTimeout) {
                clearTimeout(this.transitionTimeout);
                this.transitionTimeout = null;
            }
        }
    }

    /**
     * Get current mode
     * @returns {string|null} Current visualization mode
     */
    getCurrentMode() {
        return this.currentMode;
    }

    /**
     * Check if currently transitioning between modes
     * @returns {boolean} True if transition is in progress
     */
    isTransitionInProgress() {
        return this.isTransitioning;
    }
}

export default ModeManager;