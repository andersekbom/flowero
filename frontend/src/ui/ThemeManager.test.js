/**
 * Test file for Theme Manager
 * Run with: node ThemeManager.test.js
 */

// Mock DOM and localStorage
global.document = {
    body: {
        removeAttribute: (attr) => console.log(`Removed attribute: ${attr}`),
        setAttribute: (attr, value) => console.log(`Set attribute: ${attr}=${value}`),
        classList: {
            add: (className) => console.log(`Added body class: ${className}`),
            remove: (className) => console.log(`Removed body class: ${className}`)
        }
    }
};

global.window = {
    matchMedia: (query) => ({
        matches: query.includes('dark') ? false : true, // Simulate light theme preference
        addEventListener: (event, handler) => {
            console.log(`Added matchMedia listener for: ${query}`);
        },
        removeEventListener: (event, handler) => {
            console.log(`Removed matchMedia listener for: ${query}`);
        }
    })
};

global.localStorage = {
    getItem: (key) => {
        const storage = { 'flowero-theme': 'dark' };
        return storage[key] || null;
    },
    setItem: (key, value) => {
        console.log(`localStorage.setItem(${key}, ${value})`);
    }
};

// Mock DOM Manager
class MockDOMManager {
    constructor() {
        this.elements = {
            themeMode: {
                value: 'default',
                addEventListener: (event, handler) => {
                    console.log(`Added event listener to themeMode: ${event}`);
                }
            }
        };
    }

    get(elementId) {
        return this.elements[elementId] || null;
    }
}

// Mock Event Emitter
class MockEventEmitter {
    constructor() {
        this.listeners = new Map();
    }

    on(event, handler) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(handler);
    }

    off(event, handler) {
        if (this.listeners.has(event)) {
            const handlers = this.listeners.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(handler => handler(data));
        }
    }
}

// Import the module
import ThemeManager from './ThemeManager.js';

/**
 * Test suite
 */
async function runTests() {
    console.log('🧪 Starting Theme Manager Tests\n');

    let testsPassed = 0;
    let testsTotal = 0;

    function test(name, testFn) {
        testsTotal++;
        try {
            console.log(`Testing: ${name}`);
            testFn();
            console.log('✅ PASSED\n');
            testsPassed++;
        } catch (error) {
            console.log('❌ FAILED:', error.message, '\n');
        }
    }

    function assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }

    // Create test instances
    const domManager = new MockDOMManager();
    const eventEmitter = new MockEventEmitter();

    // Test 1: Initialization
    test('Should initialize theme manager correctly', () => {
        const themeManager = new ThemeManager(domManager, eventEmitter);
        assert(!themeManager.initialized, 'Should start uninitialized');

        themeManager.initialize();
        assert(themeManager.initialized, 'Should be initialized');
    });

    // Test 2: Theme switching
    test('Should switch themes correctly', () => {
        const themeManager = new ThemeManager(domManager, eventEmitter).initialize();

        const initialTheme = themeManager.getCurrentTheme();
        themeManager.switchTheme('summer');

        assert(themeManager.getCurrentTheme() === 'summer', 'Should switch to summer theme');
        assert(themeManager.getCurrentTheme() !== initialTheme, 'Theme should have changed');
    });

    // Test 3: Color palettes
    test('Should provide correct color palettes', () => {
        const themeManager = new ThemeManager(domManager, eventEmitter).initialize();

        const defaultColors = themeManager.getThemeColors('default');
        const darkColors = themeManager.getThemeColors('dark');

        assert(Array.isArray(defaultColors), 'Should return array of colors');
        assert(defaultColors.length > 0, 'Should have colors in default palette');
        assert(Array.isArray(darkColors), 'Should return array for dark theme');
        assert(darkColors !== defaultColors, 'Different themes should have different colors');
    });

    // Test 4: Current colors
    test('Should get current theme colors correctly', () => {
        const themeManager = new ThemeManager(domManager, eventEmitter).initialize();

        themeManager.switchTheme('spring');
        const currentColors = themeManager.getCurrentColors();
        const springColors = themeManager.getThemeColors('spring');

        assert(JSON.stringify(currentColors) === JSON.stringify(springColors),
               'Current colors should match spring theme colors');
    });

    // Test 5: Available themes
    test('Should list available themes correctly', () => {
        const themeManager = new ThemeManager(domManager, eventEmitter).initialize();

        const availableThemes = themeManager.getAvailableThemes();

        assert(Array.isArray(availableThemes), 'Should return array of themes');
        assert(availableThemes.includes('default'), 'Should include default theme');
        assert(availableThemes.includes('dark'), 'Should include dark theme');
        assert(availableThemes.includes('system'), 'Should include system theme');
    });

    // Test 6: Theme existence check
    test('Should check theme existence correctly', () => {
        const themeManager = new ThemeManager(domManager, eventEmitter).initialize();

        assert(themeManager.hasTheme('default'), 'Should recognize default theme');
        assert(themeManager.hasTheme('dark'), 'Should recognize dark theme');
        assert(themeManager.hasTheme('system'), 'Should recognize system theme');
        assert(!themeManager.hasTheme('nonexistent'), 'Should not recognize invalid theme');
    });

    // Test 7: Custom themes
    test('Should handle custom themes correctly', () => {
        const themeManager = new ThemeManager(domManager, eventEmitter).initialize();

        const customColors = ['#FF0000', '#00FF00', '#0000FF'];
        themeManager.addTheme('custom', customColors);

        assert(themeManager.hasTheme('custom'), 'Should recognize added custom theme');

        const retrievedColors = themeManager.getThemeColors('custom');
        assert(JSON.stringify(retrievedColors) === JSON.stringify(customColors),
               'Should return correct custom colors');

        themeManager.removeTheme('custom');
        assert(!themeManager.hasTheme('custom'), 'Should not recognize removed theme');
    });

    // Test 8: Event emission
    test('Should emit events on theme changes', () => {
        const themeManager = new ThemeManager(domManager, eventEmitter).initialize();

        let eventReceived = false;
        eventEmitter.on('theme_changed', (data) => {
            eventReceived = true;
            assert(typeof data.oldTheme === 'string', 'Event should include old theme');
            assert(typeof data.newTheme === 'string', 'Event should include new theme');
        });

        themeManager.switchTheme('autumn');
        assert(eventReceived, 'Should emit theme change event');
    });

    // Test 9: State information
    test('Should provide comprehensive state information', () => {
        const themeManager = new ThemeManager(domManager, eventEmitter).initialize();

        const state = themeManager.getState();

        assert(typeof state.currentTheme === 'string', 'Should include current theme');
        assert(typeof state.actualTheme === 'string', 'Should include actual theme');
        assert(Array.isArray(state.availableThemes), 'Should include available themes');
        assert(Array.isArray(state.currentColors), 'Should include current colors');
        assert(typeof state.initialized === 'boolean', 'Should include initialization state');
    });

    // Test 10: System theme handling
    test('Should handle system theme correctly', () => {
        const themeManager = new ThemeManager(domManager, eventEmitter).initialize();

        themeManager.switchTheme('system');
        const actualTheme = themeManager.getActualTheme();

        assert(themeManager.getCurrentTheme() === 'system', 'Should set current theme to system');
        assert(actualTheme !== 'system', 'Actual theme should resolve to real theme');
        assert(themeManager.hasTheme(actualTheme), 'Actual theme should be valid');
    });

    // Print results
    console.log(`\n📊 Test Results: ${testsPassed}/${testsTotal} tests passed`);

    if (testsPassed === testsTotal) {
        console.log('🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('💥 Some tests failed!');
        process.exit(1);
    }
}

// Run tests
runTests().catch(console.error);