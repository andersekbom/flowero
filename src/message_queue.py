"""
Message queue manager for MQTT message handling
"""

import threading
import time
from queue import Queue, Empty
from collections import deque
from dataclasses import dataclass
from typing import Optional, Callable, List, Dict, Any
import logging

@dataclass
class MQTTMessage:
    """Data class for MQTT messages"""
    topic: str
    payload: str
    timestamp: float
    qos: int
    retain: bool
    mid: Optional[int] = None

class MessageQueueManager:
    """
    Thread-safe message queue manager for MQTT messages
    Handles message buffering, rate limiting, and background processing
    """
    
    def __init__(self, max_queue_size: int = 10000, max_history: int = 1000):
        """
        Initialize message queue manager
        
        Args:
            max_queue_size: Maximum size of the incoming message queue
            max_history: Maximum number of messages to keep in history
        """
        self.max_queue_size = max_queue_size
        self.max_history = max_history
        
        # Thread-safe queues and collections
        self.incoming_queue = Queue(maxsize=max_queue_size)
        self.message_history = deque(maxlen=max_history)
        self.topic_stats = {}  # topic -> message count
        
        # Threading
        self.processing_thread: Optional[threading.Thread] = None
        self.shutdown_event = threading.Event()
        self.queue_lock = threading.Lock()
        
        # Statistics
        self.total_messages = 0
        self.messages_per_second = 0.0
        self.last_message_time = None
        self.rate_calculation_window = 60  # seconds
        self.rate_history = deque(maxlen=self.rate_calculation_window)
        
        # Callbacks
        self.on_message_processed: Optional[Callable[[MQTTMessage], None]] = None
        self.on_queue_full: Optional[Callable[[int], None]] = None
        self.on_error: Optional[Callable[[str], None]] = None
        
        # Setup logging
        self.logger = logging.getLogger(__name__)
    
    def start_processing(self):
        """Start the background message processing thread"""
        if self.processing_thread and self.processing_thread.is_alive():
            self.logger.warning("Message processing thread already running")
            return
        
        self.shutdown_event.clear()
        self.processing_thread = threading.Thread(
            target=self._process_messages,
            name="MessageQueueProcessor",
            daemon=True
        )
        self.processing_thread.start()
        self.logger.info("Message processing thread started")
    
    def stop_processing(self, timeout: float = 5.0):
        """
        Stop the background message processing thread
        
        Args:
            timeout: Maximum time to wait for thread shutdown
        """
        if not self.processing_thread or not self.processing_thread.is_alive():
            return
        
        self.logger.info("Stopping message processing thread...")
        self.shutdown_event.set()
        
        self.processing_thread.join(timeout=timeout)
        
        if self.processing_thread.is_alive():
            self.logger.warning("Message processing thread did not shut down gracefully")
        else:
            self.logger.info("Message processing thread stopped")
    
    def add_message(self, topic: str, payload: str, msg_info: Dict[str, Any]) -> bool:
        """
        Add a new message to the processing queue
        
        Args:
            topic: MQTT topic
            payload: Message payload
            msg_info: Message metadata (timestamp, qos, retain, etc.)
            
        Returns:
            True if message was added successfully
        """
        try:
            message = MQTTMessage(
                topic=topic,
                payload=payload,
                timestamp=msg_info.get('timestamp', time.time()),
                qos=msg_info.get('qos', 0),
                retain=msg_info.get('retain', False),
                mid=msg_info.get('mid')
            )
            
            # Try to add to queue (non-blocking)
            try:
                self.incoming_queue.put_nowait(message)
                return True
            except:
                # Queue is full
                if self.on_queue_full:
                    self.on_queue_full(self.incoming_queue.qsize())
                
                # Try to make space by removing old messages
                try:
                    self.incoming_queue.get_nowait()
                    self.incoming_queue.put_nowait(message)
                    return True
                except:
                    self.logger.warning("Message queue is full, dropping message")
                    return False
                    
        except Exception as e:
            error_msg = f"Error adding message to queue: {str(e)}"
            self.logger.error(error_msg)
            if self.on_error:
                self.on_error(error_msg)
            return False
    
    def _process_messages(self):
        """Background thread method to process messages from the queue"""
        self.logger.info("Message processing loop started")
        
        while not self.shutdown_event.is_set():
            try:
                # Get message from queue with timeout
                try:
                    message = self.incoming_queue.get(timeout=0.5)
                except Empty:
                    continue
                
                # Process the message
                self._handle_message(message)
                
                # Mark task as done
                self.incoming_queue.task_done()
                
            except Exception as e:
                error_msg = f"Error in message processing loop: {str(e)}"
                self.logger.error(error_msg)
                if self.on_error:
                    self.on_error(error_msg)
        
        self.logger.info("Message processing loop ended")
    
    def _handle_message(self, message: MQTTMessage):
        """
        Handle a single message (update statistics, history, call callbacks)
        
        Args:
            message: The MQTT message to handle
        """
        try:
            with self.queue_lock:
                # Update statistics
                self.total_messages += 1
                self.last_message_time = message.timestamp
                
                # Update topic statistics
                if message.topic not in self.topic_stats:
                    self.topic_stats[message.topic] = 0
                self.topic_stats[message.topic] += 1
                
                # Update message rate calculation
                self.rate_history.append(message.timestamp)
                self._update_message_rate()
                
                # Add to history
                self.message_history.append(message)
            
            # Call user callback
            if self.on_message_processed:
                self.on_message_processed(message)
                
        except Exception as e:
            error_msg = f"Error handling message: {str(e)}"
            self.logger.error(error_msg)
            if self.on_error:
                self.on_error(error_msg)
    
    def _update_message_rate(self):
        """Update messages per second calculation"""
        now = time.time()
        
        # Remove messages older than the calculation window
        cutoff_time = now - self.rate_calculation_window
        while self.rate_history and self.rate_history[0] < cutoff_time:
            self.rate_history.popleft()
        
        # Calculate rate
        if len(self.rate_history) > 1:
            time_span = now - self.rate_history[0]
            if time_span > 0:
                self.messages_per_second = len(self.rate_history) / time_span
            else:
                self.messages_per_second = 0.0
        else:
            self.messages_per_second = 0.0
    
    def get_recent_messages(self, count: int = None) -> List[MQTTMessage]:
        """
        Get recent messages from history
        
        Args:
            count: Number of recent messages to return (None for all)
            
        Returns:
            List of recent messages
        """
        with self.queue_lock:
            if count is None:
                return list(self.message_history)
            else:
                return list(self.message_history)[-count:]
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get message processing statistics"""
        with self.queue_lock:
            return {
                'total_messages': self.total_messages,
                'messages_per_second': round(self.messages_per_second, 2),
                'queue_size': self.incoming_queue.qsize(),
                'history_size': len(self.message_history),
                'active_topics': len(self.topic_stats),
                'topic_stats': self.topic_stats.copy(),
                'last_message_time': self.last_message_time,
                'is_processing': self.processing_thread and self.processing_thread.is_alive()
            }
    
    def clear_history(self):
        """Clear message history"""
        with self.queue_lock:
            self.message_history.clear()
            self.logger.info("Message history cleared")
    
    def clear_statistics(self):
        """Reset all statistics"""
        with self.queue_lock:
            self.total_messages = 0
            self.messages_per_second = 0.0
            self.last_message_time = None
            self.topic_stats.clear()
            self.rate_history.clear()
            self.logger.info("Statistics cleared")
    
    def is_running(self) -> bool:
        """Check if the message processing thread is running"""
        return self.processing_thread and self.processing_thread.is_alive()