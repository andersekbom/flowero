"""
MQTT Client wrapper for the MQTT Message Visualizer
"""

import paho.mqtt.client as mqtt
import time
import threading
from enum import Enum
from typing import Optional, Callable, Dict, Any
import logging
from message_queue import MessageQueueManager

class ConnectionStatus(Enum):
    DISCONNECTED = "Disconnected"
    CONNECTING = "Connecting"
    CONNECTED = "Connected"
    CONNECTION_FAILED = "Connection Failed"
    CONNECTION_LOST = "Connection Lost"

class MQTTClientWrapper:
    """
    Wrapper around paho-mqtt client with connection management and error handling
    """
    
    def __init__(self, client_id: str = None):
        """Initialize MQTT client wrapper"""
        self.client_id = client_id or f"mqtt_visualizer_{int(time.time())}"
        self.client = mqtt.Client(client_id=self.client_id, protocol=mqtt.MQTTv311)
        
        # Connection state
        self.status = ConnectionStatus.DISCONNECTED
        self.host = None
        self.port = None
        self.username = None
        self.password = None
        
        # Callbacks
        self.on_status_change: Optional[Callable[[ConnectionStatus], None]] = None
        self.on_message_received: Optional[Callable[[str, str, dict], None]] = None
        self.on_error: Optional[Callable[[str], None]] = None
        self.on_connected: Optional[Callable[[], None]] = None
        
        # Connection tracking
        self.connection_attempts = 0
        self.max_connection_attempts = 3
        self.last_error = None
        self.connection_lock = threading.Lock()
        
        # Auto-reconnection settings
        self.auto_reconnect = True
        self.reconnect_delay_base = 1.0  # Base delay in seconds
        self.reconnect_delay_max = 60.0  # Maximum delay in seconds
        self.reconnect_timer = None
        self.reconnect_attempts = 0
        
        # Topic subscription tracking
        self.subscribed_topics = {}  # topic -> qos
        self.subscription_lock = threading.Lock()
        self.pending_subscriptions = []  # Topics to subscribe when connected
        
        # Message queue for background processing
        self.message_queue = MessageQueueManager()
        
        # Setup MQTT client callbacks
        self._setup_callbacks()
        
        # Configure logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
    
    def _setup_callbacks(self):
        """Setup MQTT client event callbacks"""
        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.client.on_connect_fail = self._on_connect_fail
        self.client.on_log = self._on_log
    
    def _on_connect(self, client, userdata, flags, rc):
        """Callback for successful connection"""
        if rc == 0:
            self._set_status(ConnectionStatus.CONNECTED)
            self.connection_attempts = 0
            self.reconnect_attempts = 0
            self.last_error = None
            self._cancel_reconnect_timer()
            self.logger.info(f"Connected to MQTT broker {self.host}:{self.port}")
            
            # Subscribe to any pending topics
            if self.pending_subscriptions:
                self.logger.info(f"Subscribing to {len(self.pending_subscriptions)} pending topics")
                for topic in self.pending_subscriptions[:]:  # Copy list to avoid modification during iteration
                    if self.subscribe_to_topic(topic):
                        self.pending_subscriptions.remove(topic)
            
            # Call connected callback
            if self.on_connected:
                self.on_connected()
        else:
            error_msg = f"Connection failed with code {rc}: {mqtt.connack_string(rc)}"
            self.last_error = error_msg
            self._set_status(ConnectionStatus.CONNECTION_FAILED)
            self.logger.error(error_msg)
            self._schedule_reconnect()
    
    def _on_disconnect(self, client, userdata, rc):
        """Callback for disconnection"""
        if rc != 0:
            self._set_status(ConnectionStatus.CONNECTION_LOST)
            self.logger.warning(f"Unexpected disconnection from MQTT broker (code: {rc})")
            self._schedule_reconnect()
        else:
            self._set_status(ConnectionStatus.DISCONNECTED)
            self.logger.info("Disconnected from MQTT broker")
            self._cancel_reconnect_timer()
    
    def _on_message(self, client, userdata, msg):
        """Callback for received messages"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8', errors='replace')
            
            # Create message metadata
            msg_info = {
                'timestamp': time.time(),
                'qos': msg.qos,
                'retain': msg.retain,
                'mid': getattr(msg, 'mid', None)
            }
            
            # Add to message queue for background processing
            self.message_queue.add_message(topic, payload, msg_info)
            
            # Call user callback if set (legacy support)
            if self.on_message_received:
                self.on_message_received(topic, payload, msg_info)
                
        except Exception as e:
            error_msg = f"Error processing message: {str(e)}"
            self.logger.error(error_msg)
            if self.on_error:
                self.on_error(error_msg)
    
    def _on_connect_fail(self, client, userdata):
        """Callback for connection failure"""
        self.last_error = "Failed to establish connection to MQTT broker"
        self._set_status(ConnectionStatus.CONNECTION_FAILED)
        self.logger.error(self.last_error)
        self._schedule_reconnect()
    
    def _on_log(self, client, userdata, level, buf):
        """Callback for MQTT client logging"""
        if level == mqtt.MQTT_LOG_ERR:
            self.logger.error(f"MQTT Error: {buf}")
        elif level == mqtt.MQTT_LOG_WARNING:
            self.logger.warning(f"MQTT Warning: {buf}")
        else:
            self.logger.debug(f"MQTT Log: {buf}")
    
    def _set_status(self, new_status: ConnectionStatus):
        """Update connection status and notify callback"""
        if self.status != new_status:
            self.status = new_status
            if self.on_status_change:
                self.on_status_change(new_status)
    
    def _cancel_reconnect_timer(self):
        """Cancel any pending reconnection timer"""
        if self.reconnect_timer:
            self.reconnect_timer.cancel()
            self.reconnect_timer = None
    
    def _schedule_reconnect(self):
        """Schedule automatic reconnection with exponential backoff"""
        if not self.auto_reconnect or not self.host:
            return
        
        # Cancel any existing timer
        self._cancel_reconnect_timer()
        
        # Calculate delay with exponential backoff
        delay = min(self.reconnect_delay_base * (2 ** self.reconnect_attempts), self.reconnect_delay_max)
        self.reconnect_attempts += 1
        
        self.logger.info(f"Scheduling reconnection attempt {self.reconnect_attempts} in {delay:.1f} seconds")
        
        # Schedule the reconnection
        self.reconnect_timer = threading.Timer(delay, self._attempt_reconnect)
        self.reconnect_timer.start()
    
    def _attempt_reconnect(self):
        """Attempt to reconnect using last connection settings"""
        if self.status == ConnectionStatus.CONNECTED:
            return  # Already connected
        
        if not self.host:
            self.logger.error("Cannot reconnect: no previous connection settings available")
            return
        
        self.logger.info(f"Attempting automatic reconnection to {self.host}:{self.port}")
        
        # Attempt reconnection
        success = self.connect(self.host, self.port, self.username, self.password)
        
        if not success:
            # If connection failed, schedule another attempt
            self._schedule_reconnect()
    
    def connect(self, host: str, port: int = 1883, username: str = None, password: str = None, keepalive: int = 60) -> bool:
        """
        Connect to MQTT broker
        
        Args:
            host: MQTT broker hostname or IP
            port: MQTT broker port (default: 1883)
            username: Optional username for authentication
            password: Optional password for authentication
            keepalive: Connection keepalive interval in seconds
            
        Returns:
            True if connection attempt was initiated successfully
        """
        with self.connection_lock:
            if self.status in [ConnectionStatus.CONNECTED, ConnectionStatus.CONNECTING]:
                return False
            
            try:
                self.host = host
                self.port = port
                self.username = username
                self.password = password
                
                # Set credentials if provided
                if username:
                    self.client.username_pw_set(username, password)
                
                # Set status to connecting
                self._set_status(ConnectionStatus.CONNECTING)
                
                # Attempt connection
                self.connection_attempts += 1
                self.logger.info(f"Attempting to connect to {host}:{port} (attempt {self.connection_attempts})")
                
                result = self.client.connect(host, port, keepalive)
                
                if result == mqtt.MQTT_ERR_SUCCESS:
                    # Start network loop
                    self.client.loop_start()
                    # Start message queue processing
                    self.message_queue.start_processing()
                    return True
                else:
                    error_msg = f"Connection failed: {mqtt.error_string(result)}"
                    self.last_error = error_msg
                    self._set_status(ConnectionStatus.CONNECTION_FAILED)
                    return False
                    
            except Exception as e:
                error_msg = f"Connection error: {str(e)}"
                self.last_error = error_msg
                self._set_status(ConnectionStatus.CONNECTION_FAILED)
                self.logger.error(error_msg)
                return False
    
    def disconnect(self) -> bool:
        """
        Disconnect from MQTT broker
        
        Returns:
            True if disconnect was successful
        """
        with self.connection_lock:
            try:
                # Cancel any pending reconnection attempts
                self._cancel_reconnect_timer()
                
                if self.status in [ConnectionStatus.CONNECTED, ConnectionStatus.CONNECTING]:
                    # Stop message queue processing
                    self.message_queue.stop_processing()
                    # Stop network loop
                    self.client.loop_stop()
                    result = self.client.disconnect()
                    
                    if result == mqtt.MQTT_ERR_SUCCESS:
                        self._set_status(ConnectionStatus.DISCONNECTED)
                        self.logger.info("Disconnect initiated")
                        return True
                    else:
                        error_msg = f"Disconnect failed: {mqtt.error_string(result)}"
                        self.logger.error(error_msg)
                        return False
                else:
                    # Ensure message queue is stopped
                    self.message_queue.stop_processing()
                    self._set_status(ConnectionStatus.DISCONNECTED)
                    return True
                    
            except Exception as e:
                error_msg = f"Disconnect error: {str(e)}"
                self.logger.error(error_msg)
                if self.on_error:
                    self.on_error(error_msg)
                return False
    
    def is_connected(self) -> bool:
        """Check if client is currently connected"""
        return self.status == ConnectionStatus.CONNECTED
    
    def get_status(self) -> ConnectionStatus:
        """Get current connection status"""
        return self.status
    
    def get_last_error(self) -> Optional[str]:
        """Get last error message"""
        return self.last_error
    
    def queue_subscription(self, topic: str, qos: int = 0) -> bool:
        """
        Queue a topic subscription for when connection is established
        
        Args:
            topic: MQTT topic to subscribe to
            qos: Quality of Service level (0, 1, or 2)
            
        Returns:
            True if topic was queued successfully
        """
        if topic not in self.pending_subscriptions:
            self.pending_subscriptions.append(topic)
            self.logger.info(f"Queued topic subscription: {topic}")
            return True
        return False
    
    def subscribe_to_topic(self, topic: str, qos: int = 0) -> bool:
        """
        Subscribe to a single MQTT topic
        
        Args:
            topic: MQTT topic to subscribe to (wildcards + and # supported)
            qos: Quality of Service level (0, 1, or 2)
            
        Returns:
            True if subscription was successful or queued
        """
        if not self.is_connected():
            # Queue subscription for when we connect
            return self.queue_subscription(topic, qos)
        
        try:
            with self.subscription_lock:
                result, mid = self.client.subscribe(topic, qos)
                
                if result == mqtt.MQTT_ERR_SUCCESS:
                    self.subscribed_topics[topic] = qos
                    self.logger.info(f"Subscribed to topic: {topic} (QoS: {qos})")
                    return True
                else:
                    error_msg = f"Failed to subscribe to {topic}: {mqtt.error_string(result)}"
                    self.logger.error(error_msg)
                    if self.on_error:
                        self.on_error(error_msg)
                    return False
                    
        except Exception as e:
            error_msg = f"Subscription error for {topic}: {str(e)}"
            self.logger.error(error_msg)
            if self.on_error:
                self.on_error(error_msg)
            return False
    
    def subscribe_to_topics(self, topics: list, qos: int = 0) -> Dict[str, bool]:
        """
        Subscribe to multiple MQTT topics
        
        Args:
            topics: List of MQTT topics to subscribe to
            qos: Quality of Service level (0, 1, or 2)
            
        Returns:
            Dictionary mapping topic to success status
        """
        results = {}
        
        for topic in topics:
            if isinstance(topic, tuple):
                # Topic with individual QoS: (topic, qos)
                topic_name, topic_qos = topic
                results[topic_name] = self.subscribe_to_topic(topic_name, topic_qos)
            else:
                # Topic with default QoS
                results[topic] = self.subscribe_to_topic(topic, qos)
        
        return results
    
    def unsubscribe_from_topic(self, topic: str) -> bool:
        """
        Unsubscribe from a single MQTT topic
        
        Args:
            topic: MQTT topic to unsubscribe from
            
        Returns:
            True if unsubscription was successful
        """
        if not self.is_connected():
            self.logger.error("Cannot unsubscribe: not connected to broker")
            return False
        
        try:
            with self.subscription_lock:
                result, mid = self.client.unsubscribe(topic)
                
                if result == mqtt.MQTT_ERR_SUCCESS:
                    self.subscribed_topics.pop(topic, None)
                    self.logger.info(f"Unsubscribed from topic: {topic}")
                    return True
                else:
                    error_msg = f"Failed to unsubscribe from {topic}: {mqtt.error_string(result)}"
                    self.logger.error(error_msg)
                    if self.on_error:
                        self.on_error(error_msg)
                    return False
                    
        except Exception as e:
            error_msg = f"Unsubscription error for {topic}: {str(e)}"
            self.logger.error(error_msg)
            if self.on_error:
                self.on_error(error_msg)
            return False
    
    def unsubscribe_from_all(self) -> bool:
        """
        Unsubscribe from all currently subscribed topics
        
        Returns:
            True if all unsubscriptions were successful
        """
        with self.subscription_lock:
            topics = list(self.subscribed_topics.keys())
        
        all_success = True
        for topic in topics:
            if not self.unsubscribe_from_topic(topic):
                all_success = False
        
        return all_success
    
    def get_subscribed_topics(self) -> Dict[str, int]:
        """Get currently subscribed topics with their QoS levels"""
        with self.subscription_lock:
            return self.subscribed_topics.copy()
    
    def is_subscribed_to(self, topic: str) -> bool:
        """Check if subscribed to a specific topic"""
        with self.subscription_lock:
            return topic in self.subscribed_topics

    def get_recent_messages(self, count: int = None):
        """Get recent messages from the message queue"""
        return self.message_queue.get_recent_messages(count)
    
    def get_message_statistics(self) -> Dict[str, Any]:
        """Get message processing statistics"""
        return self.message_queue.get_statistics()
    
    def set_message_callback(self, callback: Callable):
        """Set callback for processed messages"""
        self.message_queue.on_message_processed = callback
    
    def clear_message_history(self):
        """Clear message history"""
        self.message_queue.clear_history()
    
    def clear_message_statistics(self):
        """Clear message statistics"""
        self.message_queue.clear_statistics()

    def set_auto_reconnect(self, enabled: bool):
        """Enable or disable automatic reconnection"""
        self.auto_reconnect = enabled
        if not enabled:
            self._cancel_reconnect_timer()
        self.logger.info(f"Auto-reconnect {'enabled' if enabled else 'disabled'}")
    
    def is_auto_reconnect_enabled(self) -> bool:
        """Check if auto-reconnect is enabled"""
        return self.auto_reconnect
    
    def get_reconnect_attempts(self) -> int:
        """Get number of reconnection attempts since last disconnect"""
        return self.reconnect_attempts

    def get_connection_info(self) -> Dict[str, Any]:
        """Get connection information"""
        msg_stats = self.get_message_statistics()
        return {
            'host': self.host,
            'port': self.port,
            'username': self.username,
            'status': self.status.value,
            'client_id': self.client_id,
            'connection_attempts': self.connection_attempts,
            'reconnect_attempts': self.reconnect_attempts,
            'auto_reconnect': self.auto_reconnect,
            'last_error': self.last_error,
            'subscribed_topics': self.get_subscribed_topics(),
            'total_messages': msg_stats.get('total_messages', 0),
            'messages_per_second': msg_stats.get('messages_per_second', 0),
            'active_topics': msg_stats.get('active_topics', 0)
        }