/**
 * Sidebar Controller
 *
 * Manages sidebar state, toggle functionality, and responsive behavior.
 * Handles state persistence and provides hooks for layout updates.
 */
class SidebarController {
    constructor(domManager, eventEmitter, options = {}) {
        this.domManager = domManager;
        this.eventEmitter = eventEmitter;
        this.options = {
            transitionDelay: 50, // Delay to wait for CSS transitions
            persistState: true, // Save sidebar state to localStorage
            storageKey: 'flowero-sidebar-collapsed',
            ...options
        };

        this.isCollapsed = false;
        this.initialized = false;

        // Toggle button element
        this.toggleButton = null;
        this.sidebar = null;
    }

    /**
     * Initialize the sidebar controller
     */
    initialize() {
        this.cacheElements();
        this.loadSavedState();
        this.setupEventListeners();
        this.setupResizeHandler();

        this.initialized = true;
        console.log('SidebarController: Initialized successfully');
        return this;
    }

    /**
     * Cache required DOM elements
     */
    cacheElements() {
        this.toggleButton = this.domManager.get('sidebarToggle');
        this.sidebar = this.domManager.get('sidebar');

        console.log('SidebarController: Elements cached - toggleButton:', this.toggleButton, 'sidebar:', this.sidebar);

        if (!this.sidebar) {
            console.warn('SidebarController: Sidebar element not found');
        }

        if (!this.toggleButton) {
            console.warn('SidebarController: Toggle button not found');
        }
    }

    /**
     * Load saved sidebar state from localStorage
     */
    loadSavedState() {
        if (!this.options.persistState) {
            return;
        }

        try {
            const saved = localStorage.getItem(this.options.storageKey);
            if (saved !== null) {
                this.isCollapsed = JSON.parse(saved);
                this.applySidebarState(false); // Don't emit events on load
                console.log(`SidebarController: Restored state - collapsed: ${this.isCollapsed}`);
            }
        } catch (error) {
            console.warn('SidebarController: Failed to load saved state:', error);
        }
    }

    /**
     * Save sidebar state to localStorage
     */
    saveState() {
        if (!this.options.persistState) {
            return;
        }

        try {
            localStorage.setItem(this.options.storageKey, JSON.stringify(this.isCollapsed));
        } catch (error) {
            console.warn('SidebarController: Failed to save state:', error);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        if (this.toggleButton) {
            console.log('SidebarController: Adding click listener to toggle button');
            this.toggleButton.addEventListener('click', () => {
                console.log('SidebarController: Toggle button clicked!');
                this.toggle();
            });
        } else {
            console.error('SidebarController: No toggle button found, cannot add event listener');
        }

        // Listen for keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Toggle sidebar with Ctrl+B or Cmd+B
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.toggle();
            }
        });

        // Listen for external toggle requests
        this.eventEmitter.on('sidebar_toggle_request', () => {
            this.toggle();
        });

        this.eventEmitter.on('sidebar_collapse_request', () => {
            this.collapse();
        });

        this.eventEmitter.on('sidebar_expand_request', () => {
            this.expand();
        });
    }

    /**
     * Setup window resize handler
     */
    setupResizeHandler() {
        let resizeTimeout;

        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 100);
        });
    }

    /**
     * Handle window resize events
     */
    handleResize() {
        // Auto-collapse sidebar on small screens
        const minWidthForExpanded = 1024;

        if (window.innerWidth < minWidthForExpanded && !this.isCollapsed) {
            this.collapse();
            this.eventEmitter.emit('sidebar_auto_collapsed', { reason: 'screen_size' });
        }

        // Emit resize event for other components
        this.eventEmitter.emit('sidebar_resize', {
            width: window.innerWidth,
            height: window.innerHeight,
            sidebarCollapsed: this.isCollapsed
        });
    }

    /**
     * Toggle sidebar state
     */
    toggle() {
        console.log('SidebarController: Toggle called, current state - isCollapsed:', this.isCollapsed);
        if (this.isCollapsed) {
            this.expand();
        } else {
            this.collapse();
        }
    }

    /**
     * Collapse the sidebar
     */
    collapse() {
        if (this.isCollapsed || !this.sidebar) {
            return;
        }

        this.isCollapsed = true;
        this.applySidebarState();
        this.saveState();

        console.log('SidebarController: Sidebar collapsed');
    }

    /**
     * Expand the sidebar
     */
    expand() {
        if (!this.isCollapsed || !this.sidebar) {
            return;
        }

        this.isCollapsed = false;
        this.applySidebarState();
        this.saveState();

        console.log('SidebarController: Sidebar expanded');
    }

    /**
     * Apply sidebar state to DOM and emit events
     */
    applySidebarState(emitEvents = true) {
        if (!this.sidebar) {
            return;
        }

        if (this.isCollapsed) {
            this.sidebar.classList.add('collapsed');
        } else {
            this.sidebar.classList.remove('collapsed');
        }

        if (emitEvents) {
            // Emit immediate event
            this.eventEmitter.emit('sidebar_state_changed', {
                collapsed: this.isCollapsed,
                width: this.getSidebarWidth()
            });

            // Emit delayed event after CSS transition
            setTimeout(() => {
                this.eventEmitter.emit('sidebar_transition_complete', {
                    collapsed: this.isCollapsed,
                    width: this.getSidebarWidth()
                });
            }, this.options.transitionDelay);
        }
    }

    /**
     * Get current sidebar state
     */
    getState() {
        return {
            collapsed: this.isCollapsed,
            width: this.getSidebarWidth(),
            element: this.sidebar,
            toggleButton: this.toggleButton
        };
    }

    /**
     * Get sidebar width based on current state
     */
    getSidebarWidth() {
        if (!this.sidebar) {
            return 0;
        }

        // These should match the CSS values
        return this.isCollapsed ? 60 : 300;
    }

    /**
     * Check if sidebar is collapsed
     */
    isCollapsed() {
        return this.isCollapsed;
    }

    /**
     * Check if sidebar is expanded
     */
    isExpanded() {
        return !this.isCollapsed;
    }

    /**
     * Get effective container dimensions (excluding sidebar)
     */
    getEffectiveContainerDimensions(containerElement) {
        if (!containerElement) {
            return { width: 0, height: 0, sidebarWidth: 0 };
        }

        const containerRect = containerElement.getBoundingClientRect();
        const sidebarWidth = this.getSidebarWidth();

        return {
            width: containerRect.width - sidebarWidth,
            height: containerRect.height,
            sidebarWidth: sidebarWidth,
            collapsed: this.isCollapsed
        };
    }

    /**
     * Get position offset for elements (to account for sidebar)
     */
    getPositionOffset() {
        return {
            x: this.getSidebarWidth(),
            y: 0
        };
    }

    /**
     * Update button states based on current mode
     */
    updateVisualizationButtons(activeMode) {
        try {
            // Update collapsed sidebar icon buttons
            const vizIconButtons = this.domManager.get('vizIconButtons');
            if (vizIconButtons) {
                vizIconButtons.forEach(btn => {
                    if (btn.dataset.mode === activeMode) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }

            // Update expanded sidebar buttons
            const vizModeButtons = this.domManager.get('vizModeButtons');
            if (vizModeButtons) {
                vizModeButtons.forEach(btn => {
                    if (btn.dataset.mode === activeMode) {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
            }
        } catch (error) {
            console.warn('SidebarController: Error updating visualization buttons:', error);
        }
    }

    /**
     * Add click handlers for visualization buttons
     */
    setupVisualizationButtons(clickHandler) {
        if (typeof clickHandler !== 'function') {
            console.warn('SidebarController: Invalid click handler provided');
            return;
        }

        try {
            // Setup collapsed sidebar icon buttons
            const vizIconButtons = this.domManager.get('vizIconButtons');
            if (vizIconButtons) {
                vizIconButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const mode = btn.dataset.mode;
                        if (mode) {
                            clickHandler(mode);
                        }
                    });
                });
            }

            // Setup expanded sidebar buttons
            const vizModeButtons = this.domManager.get('vizModeButtons');
            if (vizModeButtons) {
                vizModeButtons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const mode = btn.dataset.mode;
                        if (mode) {
                            clickHandler(mode);
                        }
                    });
                });
            }

            console.log('SidebarController: Visualization buttons setup complete');
        } catch (error) {
            console.error('SidebarController: Error setting up visualization buttons:', error);
        }
    }

    /**
     * Destroy the sidebar controller
     */
    destroy() {
        // Remove event listeners
        if (this.toggleButton) {
            this.toggleButton.removeEventListener('click', this.toggle);
        }

        // Remove event emitter listeners
        this.eventEmitter.off('sidebar_toggle_request');
        this.eventEmitter.off('sidebar_collapse_request');
        this.eventEmitter.off('sidebar_expand_request');

        this.initialized = false;
        console.log('SidebarController: Destroyed');
    }
}

export default SidebarController;