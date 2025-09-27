// Test script to verify core system modules work correctly
import ContainerSystem from './src/core/ContainerSystem.js';
import ModeManager from './src/modes/ModeManager.js';
import PerformanceManager from './src/core/PerformanceManager.js';

console.log('✅ All core system modules imported successfully');

// Test ContainerSystem
const mockElement = {
    clientWidth: 800,
    clientHeight: 600,
    querySelector: () => null,
    querySelectorAll: () => []
};

const containerSystem = new ContainerSystem(mockElement);
console.log('✅ ContainerSystem instantiated');

const dimensions = containerSystem.getDimensions();
console.log('✅ ContainerSystem.getDimensions() returns:', dimensions);

// Test PerformanceManager
const performanceManager = new PerformanceManager();
console.log('✅ PerformanceManager instantiated');

const metrics = performanceManager.getMetrics();
console.log('✅ PerformanceManager.getMetrics() returns:', metrics);

const summary = performanceManager.getSummary();
console.log('✅ PerformanceManager.getSummary() returns:', summary);

// Test ModeManager (requires a mock visualizer)
const mockVisualizer = {
    domElements: { messageFlow: { classList: { remove: () => {}, add: () => {} } } },
    sidebarController: { updateVisualizationButtons: () => {} },
    resetVisualizationState: () => {},
    cleanupManager: { reset: () => {} },
    elementTracker: { reset: () => {}, getCounts: () => ({ total: 0 }) },
    layoutCalculator: null,
    unifiedContainer: null,
    visualizationMode: null,
    clustersAnimation: null,
    brightnessInterval: null,
    d3Simulation: null
};

const modeManager = new ModeManager(mockVisualizer);
console.log('✅ ModeManager instantiated');

const state = modeManager.getState();
console.log('✅ ModeManager.getState() returns:', state);

console.log('🎉 All core system tests passed!');