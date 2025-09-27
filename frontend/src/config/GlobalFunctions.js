/**
 * Global Functions
 *
 * HTML onclick handlers and global utility functions for the MQTT Visualizer.
 * These functions need to be available globally for HTML event handling.
 */

/**
 * Setup global functions on the window object
 * @param {Object} visualizer - The main visualizer instance
 */
export function setupGlobalFunctions(visualizer) {
    console.log('Setting up global functions...');

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
        console.log('Not in browser environment, skipping global functions setup');
        return false;
    }

    // Global toggle connection function for HTML onclick handlers
    window.toggleConnection = function() {
        console.log('=== BUTTON CLICKED: toggleConnection called ===');
        console.log('Visualizer object:', visualizer);
        if (visualizer) {
            console.log('✅ Visualizer found, proceeding with connection...');
            console.log('MQTT Connection Manager:', visualizer.mqttConnectionManager);

            try {
                visualizer.toggleConnection();
                console.log('✅ toggleConnection method called successfully');
            } catch (error) {
                console.error('❌ Error calling visualizer.toggleConnection:', error);
            }
        } else {
            console.error('❌ Visualizer not initialized! Current state:', typeof visualizer);
            console.error('Please wait for page to fully load or check for initialization errors.');
        }
    };

    // Global subscribe to topic function
    window.subscribeToTopic = function() {
        console.log('subscribeToTopic called, visualizer:', visualizer);
        if (visualizer) {
            visualizer.subscribeToTopic();
        } else {
            console.error('Visualizer not initialized for subscribeToTopic!');
        }
    };

    // Global theme switching function
    window.switchTheme = function() {
        if (visualizer) {
            visualizer.switchTheme();
        } else {
            console.error('Visualizer not initialized for switchTheme!');
        }
    };

    // Global SSL options toggle function
    window.toggleSSLOptions = function() {
        const sslCheckbox = document.getElementById('ssl');
        const sslOptions = document.getElementById('sslOptions');
        const portInput = document.getElementById('port');

        if (sslCheckbox && sslOptions && portInput) {
            if (sslCheckbox.checked) {
                sslOptions.style.display = 'block';
                // Auto-update port to MQTTS default if still using standard MQTT port
                if (portInput.value === '1883') {
                    portInput.value = '8883';
                }
            } else {
                sslOptions.style.display = 'none';
                // Auto-update port to MQTT default if still using MQTTS port
                if (portInput.value === '8883') {
                    portInput.value = '1883';
                }
            }
        } else {
            console.error('SSL options DOM elements not found');
        }
    };

    console.log('Global functions defined. toggleConnection:', typeof window.toggleConnection);
    console.log('🎯 Global functions setup complete!');
    return true;
}

/**
 * Legacy global functions for backward compatibility
 */
export function setupLegacyGlobalFunctions(visualizer) {
    // These functions are defined globally for older HTML onclick handlers
    if (typeof window !== 'undefined') {
        // Ensure backwards compatibility with existing HTML
        window.toggleConnection = window.toggleConnection || function() {
            console.warn('toggleConnection called before setup - please call setupGlobalFunctions first');
        };

        window.subscribeToTopic = window.subscribeToTopic || function() {
            console.warn('subscribeToTopic called before setup - please call setupGlobalFunctions first');
        };

        window.switchTheme = window.switchTheme || function() {
            console.warn('switchTheme called before setup - please call setupGlobalFunctions first');
        };

        window.toggleSSLOptions = window.toggleSSLOptions || function() {
            console.warn('toggleSSLOptions called before setup - please call setupGlobalFunctions first');
        };
    }
}

/**
 * Utility function to check if all global functions are properly set up
 * @returns {boolean} True if all global functions are available
 */
export function validateGlobalFunctions() {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
        console.log('Not in browser environment, skipping validation');
        return true; // Consider valid in non-browser environments
    }

    const requiredFunctions = ['toggleConnection', 'subscribeToTopic', 'switchTheme', 'toggleSSLOptions'];
    const missing = [];

    for (const funcName of requiredFunctions) {
        if (typeof window[funcName] !== 'function') {
            missing.push(funcName);
        }
    }

    if (missing.length > 0) {
        console.error('Missing global functions:', missing);
        return false;
    }

    console.log('✅ All global functions are properly set up');
    return true;
}

export default { setupGlobalFunctions, setupLegacyGlobalFunctions, validateGlobalFunctions };