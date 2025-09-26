/**
 * Modal Controller
 *
 * Manages modal display, keyboard navigation, and message detail viewing.
 * Provides reusable modal system for MQTT message details.
 */
class ModalController {
    constructor(domManager, eventEmitter, options = {}) {
        this.domManager = domManager;
        this.eventEmitter = eventEmitter;
        this.options = {
            enableKeyboardNavigation: true,
            enableClickOutsideClose: true,
            enableEscapeClose: true,
            animationDuration: 300,
            ...options
        };

        this.isOpen = false;
        this.initialized = false;

        // Modal elements - will be cached from DOMManager
        this.elements = null;

        // Browser compatibility
        this.supportsPassiveListeners = this.checkPassiveListenerSupport();
    }

    /**
     * Check browser support for passive event listeners
     */
    checkPassiveListenerSupport() {
        let supportsPassive = false;
        try {
            const opts = Object.defineProperty({}, 'passive', {
                get: function() {
                    supportsPassive = true;
                }
            });
            window.addEventListener('testPassive', null, opts);
            window.removeEventListener('testPassive', null, opts);
        } catch (e) {
            supportsPassive = false;
        }
        return supportsPassive;
    }

    /**
     * Initialize the modal controller
     */
    initialize() {
        this.cacheElements();
        this.setupEventListeners();

        this.initialized = true;
        console.log('ModalController: Initialized successfully');
        return this;
    }

    /**
     * Cache required DOM elements
     */
    cacheElements() {
        this.elements = {
            modal: this.domManager.get('modal'),
            modalClose: this.domManager.get('modalClose'),
            modalCustomer: this.domManager.get('modalCustomer'),
            modalTopic: this.domManager.get('modalTopic'),
            modalTimestamp: this.domManager.get('modalTimestamp'),
            modalPayload: this.domManager.get('modalPayload'),
            modalQos: this.domManager.get('modalQos'),
            modalRetain: this.domManager.get('modalRetain')
        };

        // Check for required elements
        if (!this.elements.modal || !this.elements.modalClose) {
            console.warn('ModalController: Required modal elements not found');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        const passiveOption = this.supportsPassiveListeners ? { passive: true } : false;

        // Close modal when clicking the X button
        if (this.elements.modalClose) {
            this.elements.modalClose.addEventListener('click', () => {
                this.close();
            }, passiveOption);
        }

        // Close modal when clicking outside the modal content
        if (this.elements.modal && this.options.enableClickOutsideClose) {
            this.elements.modal.addEventListener('click', (e) => {
                if (e.target === this.elements.modal) {
                    this.close();
                }
            }, passiveOption);
        }

        // Close modal when pressing Escape key
        if (this.options.enableEscapeClose) {
            document.addEventListener('keydown', (e) => {
                this.handleKeydown(e);
            }, this.supportsPassiveListeners ? { passive: false } : false);
        }

        // Listen for external modal requests
        this.eventEmitter.on('modal_show_message', (messageData) => {
            this.showMessageModal(messageData);
        });

        this.eventEmitter.on('modal_close_request', () => {
            this.close();
        });
    }

    /**
     * Handle keyboard events
     */
    handleKeydown(e) {
        if (!this.isOpen) return;

        const key = e.key || e.which || e.keyCode;

        if (key === 'Escape' || key === 'Esc' || key === 27) {
            e.preventDefault();
            this.close();
        }

        // Additional keyboard navigation can be added here
        if (this.options.enableKeyboardNavigation) {
            // Tab navigation, focus management, etc.
        }
    }

    /**
     * Show modal with message data
     */
    showMessageModal(messageData) {
        if (!this.elements.modal || !messageData) {
            console.warn('ModalController: Cannot show modal - missing elements or data');
            return;
        }

        try {
            // Get modal content element
            const modalContent = this.elements.modal.querySelector('.modal-content');

            if (modalContent) {
                // Extract customer and get color
                const customer = this.extractCustomerFromTopic(messageData.topic);
                const color = this.getTopicColor ? this.getTopicColor(messageData.topic) : '#4ECDC4';

                // Style modal to match the message (solid colors, no transparency)
                modalContent.style.background = `linear-gradient(135deg, ${color}, ${color}E6)`;
                modalContent.style.border = `2px solid ${color}`;
            }

            // Populate modal fields with message details
            this.populateModalFields(messageData);

            // Show modal fields that might be hidden
            this.showAllFields();

            // Display modal
            this.show();

            // Emit event for analytics or other listeners
            this.eventEmitter.emit('modal_opened', {
                type: 'message',
                messageData
            });

        } catch (error) {
            console.error('ModalController: Error showing message modal:', error);
        }
    }

    /**
     * Populate modal fields with message data
     */
    populateModalFields(messageData) {
        const customer = this.extractCustomerFromTopic(messageData.topic);

        // Populate all available fields
        if (this.elements.modalCustomer) {
            this.elements.modalCustomer.textContent = customer.toUpperCase();
        }

        if (this.elements.modalTopic) {
            this.elements.modalTopic.textContent = messageData.topic;
        }

        if (this.elements.modalTimestamp) {
            const timestamp = new Date(messageData.timestamp * 1000).toLocaleString();
            this.elements.modalTimestamp.textContent = timestamp;
        }

        if (this.elements.modalPayload) {
            this.elements.modalPayload.textContent = messageData.payload;
        }

        if (this.elements.modalQos) {
            this.elements.modalQos.textContent = messageData.qos || '0';
        }

        if (this.elements.modalRetain) {
            this.elements.modalRetain.textContent = messageData.retain ? 'Yes' : 'No';
        }
    }

    /**
     * Show all modal fields (unhide any that might be hidden)
     */
    showAllFields() {
        // Show QoS and Retain fields (common fields that might be hidden)
        const qosField = document.querySelector('.modal-field:nth-child(5)');
        const retainField = document.querySelector('.modal-field:nth-child(6)');

        if (qosField) qosField.style.display = 'block';
        if (retainField) retainField.style.display = 'block';
    }

    /**
     * Show the modal
     */
    show() {
        if (!this.elements.modal) {
            console.warn('ModalController: Cannot show modal - element not found');
            return;
        }

        this.elements.modal.style.display = 'block';
        this.isOpen = true;

        // Focus management for accessibility
        this.manageFocus();

        // Emit event
        this.eventEmitter.emit('modal_shown');
    }

    /**
     * Close the modal
     */
    close() {
        if (!this.elements.modal) {
            console.warn('ModalController: Cannot close modal - element not found');
            return;
        }

        this.elements.modal.style.display = 'none';
        this.isOpen = false;

        // Restore focus if needed
        this.restoreFocus();

        // Emit event
        this.eventEmitter.emit('modal_closed');
    }

    /**
     * Manage focus for accessibility
     */
    manageFocus() {
        if (this.options.enableKeyboardNavigation && this.elements.modalClose) {
            // Save currently focused element
            this.previouslyFocusedElement = document.activeElement;

            // Focus the close button
            setTimeout(() => {
                this.elements.modalClose.focus();
            }, 100);
        }
    }

    /**
     * Restore focus after modal closes
     */
    restoreFocus() {
        if (this.previouslyFocusedElement && this.previouslyFocusedElement.focus) {
            try {
                this.previouslyFocusedElement.focus();
                this.previouslyFocusedElement = null;
            } catch (error) {
                // Element might not be focusable anymore
            }
        }
    }

    /**
     * Extract customer name from topic
     */
    extractCustomerFromTopic(topic) {
        if (!topic) return 'unknown';
        const parts = topic.split('/');
        return parts[0] || 'unknown';
    }

    /**
     * Set color provider function
     */
    setColorProvider(getTopicColor) {
        this.getTopicColor = getTopicColor;
    }

    /**
     * Check if modal is currently open
     */
    isModalOpen() {
        return this.isOpen;
    }

    /**
     * Toggle modal visibility
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            // Can't show without data, so just emit request
            this.eventEmitter.emit('modal_toggle_requested');
        }
    }

    /**
     * Get modal state for debugging
     */
    getState() {
        return {
            isOpen: this.isOpen,
            initialized: this.initialized,
            elements: this.elements ? Object.keys(this.elements) : [],
            options: this.options
        };
    }

    /**
     * Destroy the modal controller
     */
    destroy() {
        // Remove event listeners
        if (this.elements.modalClose) {
            // Clone node to remove all event listeners
            const newClose = this.elements.modalClose.cloneNode(true);
            this.elements.modalClose.parentNode.replaceChild(newClose, this.elements.modalClose);
        }

        if (this.elements.modal) {
            // Clone node to remove all event listeners
            const newModal = this.elements.modal.cloneNode(true);
            this.elements.modal.parentNode.replaceChild(newModal, this.elements.modal);
        }

        // Remove event emitter listeners
        this.eventEmitter.off('modal_show_message');
        this.eventEmitter.off('modal_close_request');

        // Close modal if open
        if (this.isOpen) {
            this.close();
        }

        this.initialized = false;
        console.log('ModalController: Destroyed');
    }
}

export default ModalController;