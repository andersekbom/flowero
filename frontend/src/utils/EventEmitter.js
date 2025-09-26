/**
 * Simple EventEmitter implementation for inter-component communication
 */
class EventEmitter {
    constructor() {
        this.events = new Map();
    }

    /**
     * Subscribe to an event
     */
    on(event, callback) {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event).push(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event that fires only once
     */
    once(event, callback) {
        const unsubscribe = this.on(event, (...args) => {
            unsubscribe();
            callback(...args);
        });
        return unsubscribe;
    }

    /**
     * Unsubscribe from an event
     */
    off(event, callback) {
        if (!this.events.has(event)) return;

        const callbacks = this.events.get(event);
        const index = callbacks.indexOf(callback);
        if (index !== -1) {
            callbacks.splice(index, 1);
        }

        // Clean up empty event arrays
        if (callbacks.length === 0) {
            this.events.delete(event);
        }
    }

    /**
     * Emit an event
     */
    emit(event, ...args) {
        if (!this.events.has(event)) return;

        const callbacks = this.events.get(event);
        // Create a copy to avoid issues if callbacks modify the array
        [...callbacks].forEach(callback => {
            try {
                callback(...args);
            } catch (error) {
                console.error(`Error in event callback for '${event}':`, error);
            }
        });
    }

    /**
     * Remove all listeners for an event, or all events if no event specified
     */
    removeAllListeners(event = null) {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
    }

    /**
     * Get list of events with listeners
     */
    eventNames() {
        return Array.from(this.events.keys());
    }

    /**
     * Get number of listeners for an event
     */
    listenerCount(event) {
        return this.events.has(event) ? this.events.get(event).length : 0;
    }
}

export default EventEmitter;