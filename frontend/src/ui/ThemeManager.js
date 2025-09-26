/**
 * Theme Manager
 *
 * Manages theme switching, persistence, and color schemes.
 * Supports system theme detection and custom theme configurations.
 */
class ThemeManager {
    constructor(domManager, eventEmitter, options = {}) {
        this.domManager = domManager;
        this.eventEmitter = eventEmitter;
        this.options = {
            storageKey: 'flowero-theme',
            defaultTheme: 'default',
            enableSystemDetection: true,
            enableTransitions: true,
            ...options
        };

        this.currentTheme = this.options.defaultTheme;
        this.systemTheme = null;
        this.initialized = false;

        // Color palettes for different themes
        this.colorPalettes = {
            dark: [
                '#00FF41', '#00FFFF', '#FF1493', '#FF4500', '#FFFF00',
                '#FF69B4', '#00FA9A', '#FF6347', '#7FFF00', '#00BFFF'
            ],
            spring: [
                '#8BC34A', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7',
                '#C8E6C9', '#E8F5E8', '#FFEB3B', '#FFF176', '#FFECB3'
            ],
            summer: [
                '#FF9800', '#FFB74D', '#FFCC02', '#FFC107', '#FF8F00',
                '#FF6F00', '#E65100', '#FF5722', '#FF7043', '#FFAB40'
            ],
            autumn: [
                '#D2691E', '#CD853F', '#DEB887', '#F4A460', '#DAA520',
                '#B8860B', '#A0522D', '#8B4513', '#FF8C00', '#FF7F50'
            ],
            winter: [
                '#4682B4', '#5F9EA0', '#6495ED', '#87CEEB', '#B0C4DE',
                '#B0E0E6', '#ADD8E6', '#E0F6FF', '#F0F8FF', '#DCDCDC'
            ],
            default: [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
                '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
            ]
        };

        // Theme selector element
        this.themeSelector = null;
    }

    /**
     * Initialize the theme manager
     */
    initialize() {
        this.cacheElements();
        this.setupSystemThemeDetection();
        this.loadSavedTheme();
        this.setupEventListeners();

        this.initialized = true;
        console.log(`ThemeManager: Initialized with theme '${this.currentTheme}'`);
        return this;
    }

    /**
     * Cache required DOM elements
     */
    cacheElements() {
        this.themeSelector = this.domManager.get('themeMode');

        if (!this.themeSelector) {
            console.warn('ThemeManager: Theme selector element not found');
        }
    }

    /**
     * Setup system theme detection
     */
    setupSystemThemeDetection() {
        if (!this.options.enableSystemDetection || !window.matchMedia) {
            return;
        }

        // Detect initial system theme
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
        this.systemTheme = prefersDark.matches ? 'dark' : 'default';

        // Listen for system theme changes
        prefersDark.addEventListener('change', (e) => {
            const newSystemTheme = e.matches ? 'dark' : 'default';
            this.systemTheme = newSystemTheme;

            this.eventEmitter.emit('system_theme_changed', {
                theme: newSystemTheme,
                matches: e.matches
            });

            // Auto-apply system theme if user hasn't set a preference
            const savedTheme = this.getSavedTheme();
            if (!savedTheme || savedTheme === 'system') {
                this.applyTheme(newSystemTheme);
            }
        });

        console.log(`ThemeManager: System theme detected as '${this.systemTheme}'`);
    }

    /**
     * Load saved theme from localStorage
     */
    loadSavedTheme() {
        const savedTheme = this.getSavedTheme();

        if (savedTheme) {
            if (savedTheme === 'system' && this.systemTheme) {
                this.applyTheme(this.systemTheme);
            } else {
                this.applyTheme(savedTheme);
            }
        } else {
            // Use system theme if available, otherwise default
            const initialTheme = this.systemTheme || this.options.defaultTheme;
            this.applyTheme(initialTheme);
        }

        // Update theme selector to match
        this.updateThemeSelector();
    }

    /**
     * Get saved theme from localStorage
     */
    getSavedTheme() {
        try {
            return localStorage.getItem(this.options.storageKey);
        } catch (error) {
            console.warn('ThemeManager: Failed to load saved theme:', error);
            return null;
        }
    }

    /**
     * Save theme to localStorage
     */
    saveTheme(theme) {
        try {
            localStorage.setItem(this.options.storageKey, theme);
            console.log(`ThemeManager: Theme '${theme}' saved to localStorage`);
        } catch (error) {
            console.warn('ThemeManager: Failed to save theme:', error);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Theme selector change handler
        if (this.themeSelector) {
            this.themeSelector.addEventListener('change', (e) => {
                this.switchTheme(e.target.value);
            });
        }

        // Listen for external theme change requests
        this.eventEmitter.on('theme_change_request', (theme) => {
            this.switchTheme(theme);
        });

        // Listen for theme refresh requests
        this.eventEmitter.on('theme_refresh_request', () => {
            this.refreshTheme();
        });
    }

    /**
     * Switch to a new theme
     */
    switchTheme(theme) {
        if (!theme || theme === this.currentTheme) {
            return;
        }

        const oldTheme = this.currentTheme;

        // Handle 'system' theme
        if (theme === 'system') {
            const actualTheme = this.systemTheme || this.options.defaultTheme;
            this.applyTheme(actualTheme);
            this.currentTheme = theme; // Keep track that user selected 'system'
        } else {
            this.applyTheme(theme);
        }

        this.saveTheme(theme);
        this.updateThemeSelector();

        console.log(`ThemeManager: Theme switched from '${oldTheme}' to '${theme}'`);

        // Emit theme change event
        this.eventEmitter.emit('theme_changed', {
            oldTheme,
            newTheme: theme,
            actualTheme: this.getActualTheme()
        });
    }

    /**
     * Apply theme to the document
     */
    applyTheme(theme) {
        if (!theme) {
            return;
        }

        const body = document.body;

        // Remove existing theme attributes
        body.removeAttribute('data-theme');

        // Apply new theme
        if (theme !== 'default') {
            body.setAttribute('data-theme', theme);
        }

        // Add transition class if enabled
        if (this.options.enableTransitions) {
            body.classList.add('theme-transition');
            setTimeout(() => {
                body.classList.remove('theme-transition');
            }, 300);
        }

        this.currentTheme = theme;

        // Emit theme applied event
        this.eventEmitter.emit('theme_applied', {
            theme,
            colors: this.getThemeColors(theme)
        });

        console.log(`ThemeManager: Applied theme '${theme}'`);
    }

    /**
     * Refresh current theme (useful after dynamic changes)
     */
    refreshTheme() {
        const currentTheme = this.getActualTheme();
        this.eventEmitter.emit('theme_refresh', {
            theme: currentTheme,
            colors: this.getThemeColors(currentTheme)
        });

        console.log(`ThemeManager: Refreshed theme '${currentTheme}'`);
    }

    /**
     * Update theme selector to match current theme
     */
    updateThemeSelector() {
        if (this.themeSelector) {
            this.themeSelector.value = this.currentTheme;
        }
    }

    /**
     * Get colors for a specific theme
     */
    getThemeColors(theme = null) {
        const targetTheme = theme || this.getActualTheme();
        return this.colorPalettes[targetTheme] || this.colorPalettes.default;
    }

    /**
     * Get current theme colors
     */
    getCurrentColors() {
        return this.getThemeColors();
    }

    /**
     * Get the actual applied theme (resolves 'system' to actual theme)
     */
    getActualTheme() {
        if (this.currentTheme === 'system') {
            return this.systemTheme || this.options.defaultTheme;
        }
        return this.currentTheme;
    }

    /**
     * Get current theme name
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Get available themes
     */
    getAvailableThemes() {
        const themes = Object.keys(this.colorPalettes);

        // Add 'system' option if system detection is enabled
        if (this.options.enableSystemDetection && window.matchMedia) {
            themes.unshift('system');
        }

        return themes;
    }

    /**
     * Check if a theme exists
     */
    hasTheme(theme) {
        return theme === 'system' || this.colorPalettes.hasOwnProperty(theme);
    }

    /**
     * Add a custom theme
     */
    addTheme(name, colors) {
        if (!name || !Array.isArray(colors) || colors.length === 0) {
            throw new Error('ThemeManager: Invalid theme name or colors');
        }

        this.colorPalettes[name] = [...colors];
        console.log(`ThemeManager: Added custom theme '${name}' with ${colors.length} colors`);

        this.eventEmitter.emit('theme_added', {
            name,
            colors: [...colors]
        });
    }

    /**
     * Remove a custom theme
     */
    removeTheme(name) {
        if (name === 'default' || name === 'system') {
            throw new Error('ThemeManager: Cannot remove built-in themes');
        }

        if (this.colorPalettes.hasOwnProperty(name)) {
            delete this.colorPalettes[name];
            console.log(`ThemeManager: Removed theme '${name}'`);

            // Switch to default if current theme was removed
            if (this.currentTheme === name) {
                this.switchTheme(this.options.defaultTheme);
            }

            this.eventEmitter.emit('theme_removed', { name });
        }
    }

    /**
     * Get theme state for debugging
     */
    getState() {
        return {
            currentTheme: this.currentTheme,
            actualTheme: this.getActualTheme(),
            systemTheme: this.systemTheme,
            availableThemes: this.getAvailableThemes(),
            currentColors: this.getCurrentColors(),
            initialized: this.initialized
        };
    }

    /**
     * Destroy the theme manager
     */
    destroy() {
        // Remove event listeners
        if (this.themeSelector) {
            this.themeSelector.removeEventListener('change', this.switchTheme);
        }

        // Remove event emitter listeners
        this.eventEmitter.off('theme_change_request');
        this.eventEmitter.off('theme_refresh_request');

        this.initialized = false;
        console.log('ThemeManager: Destroyed');
    }
}

export default ThemeManager;