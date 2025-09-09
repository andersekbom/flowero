"""
FastAPI backend for MQTT Message Visualizer
Provides WebSocket endpoints for real-time message streaming
"""

import asyncio
import json
import logging
import time
from typing import Dict, List, Set, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import sys
import os

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
from mqtt_client import MQTTClientWrapper, ConnectionStatus

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MQTT Message Visualizer API", version="2.0.0")

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global state
class AppState:
    def __init__(self):
        self.mqtt_client: MQTTClientWrapper = None
        self.websocket_connections: Set[WebSocket] = set()
        self.message_queue = asyncio.Queue()
        self.is_processing = False
        self.main_loop = None

app_state = AppState()

# Pydantic models for API
class MQTTConnection(BaseModel):
    host: str
    port: int = 1883
    username: Optional[str] = None
    password: Optional[str] = None

class TopicSubscription(BaseModel):
    topic: str
    qos: int = 0

class MessageData(BaseModel):
    topic: str
    payload: str
    timestamp: float
    qos: int
    retain: bool

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        try:
            await websocket.send_text(message)
        except Exception as e:
            logger.error(f"Error sending message to websocket: {e}")
            self.disconnect(websocket)

    async def broadcast(self, message: str):
        disconnected_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Error broadcasting to websocket: {e}")
                disconnected_connections.append(connection)
        
        # Clean up disconnected connections
        for connection in disconnected_connections:
            self.disconnect(connection)

manager = ConnectionManager()

async def broadcast_status_update():
    """Broadcast status update to all connected WebSocket clients"""
    if app_state.mqtt_client:
        status = app_state.mqtt_client.get_status()
        connection_info = app_state.mqtt_client.get_connection_info()
        
        status_data = {
            "type": "status",
            "data": {
                "status": status.value,
                "connection_info": connection_info
            }
        }
        
        await manager.broadcast(json.dumps(status_data))

def initialize_mqtt_client():
    """Initialize MQTT client with message callback"""
    if app_state.mqtt_client is None:
        app_state.mqtt_client = MQTTClientWrapper()
        
        # Set callback to handle incoming messages
        def on_message_received(message):
            # Add message to queue for WebSocket broadcasting
            try:
                if app_state.main_loop:
                    # Use thread-safe method to schedule the coroutine
                    future = asyncio.run_coroutine_threadsafe(
                        app_state.message_queue.put(message), 
                        app_state.main_loop
                    )
                    # Don't wait for the result, just ensure it's scheduled
                else:
                    logger.warning("No main event loop available for message queuing")
            except Exception as e:
                logger.error(f"Error queuing message: {e}")
        
        # Set callback to handle status changes
        def on_status_change(status):
            # Broadcast status update to WebSocket clients
            try:
                if app_state.main_loop:
                    asyncio.run_coroutine_threadsafe(broadcast_status_update(), app_state.main_loop)
                else:
                    logger.warning("No main event loop available for status broadcast")
            except Exception as e:
                logger.error(f"Error broadcasting status update: {e}")
        
        app_state.mqtt_client.set_message_callback(on_message_received)
        app_state.mqtt_client.on_status_change = on_status_change
    
    return app_state.mqtt_client

async def message_processor():
    """Background task to process MQTT messages and broadcast via WebSocket"""
    if app_state.is_processing:
        return
    
    app_state.is_processing = True
    logger.info("Starting message processor")
    
    try:
        while True:
            try:
                # Get message from queue (wait up to 1 second)
                message = await asyncio.wait_for(app_state.message_queue.get(), timeout=1.0)
                
                # Convert message to JSON for WebSocket
                message_data = {
                    "type": "mqtt_message",
                    "data": {
                        "topic": message.topic,
                        "payload": message.payload,
                        "timestamp": message.timestamp,
                        "qos": message.qos,
                        "retain": message.retain
                    }
                }
                
                # Broadcast to all connected WebSocket clients
                await manager.broadcast(json.dumps(message_data))
                
            except asyncio.TimeoutError:
                # No message in queue, continue
                continue
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                
    except asyncio.CancelledError:
        logger.info("Message processor cancelled")
    finally:
        app_state.is_processing = False

# API Routes (with /api prefix)
@app.get("/api")
async def root():
    return {"message": "MQTT Message Visualizer API", "version": "2.0.0"}

@app.get("/api/status")
async def get_status():
    """Get current MQTT connection status"""
    mqtt_client = initialize_mqtt_client()
    status = mqtt_client.get_status()
    connection_info = mqtt_client.get_connection_info()
    
    return {
        "status": status.value,
        "connection_info": connection_info,
        "websocket_connections": len(manager.active_connections)
    }

@app.post("/api/connect")
async def connect_mqtt(connection: MQTTConnection):
    """Connect to MQTT broker"""
    mqtt_client = initialize_mqtt_client()
    
    # Check if already connected to avoid duplicate connections
    current_status = mqtt_client.get_status()
    if current_status.value == "Connected":
        return {"success": True, "message": "Already connected"}
    
    try:
        # Disconnect if in any intermediate state
        if current_status.value != "Disconnected":
            mqtt_client.disconnect()
            
        success = mqtt_client.connect(
            connection.host,
            connection.port,
            connection.username,
            connection.password
        )
        
        if success:
            # Start message processor if not already running
            if not app_state.is_processing:
                asyncio.create_task(message_processor())
            
            return {"success": True, "message": "Connection initiated"}
        else:
            raise HTTPException(status_code=400, detail="Failed to initiate connection")
            
    except Exception as e:
        logger.error(f"Connection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/disconnect")
async def disconnect_mqtt():
    """Disconnect from MQTT broker"""
    if app_state.mqtt_client:
        try:
            # Send status update before disconnecting to ensure WebSocket clients get the update
            await asyncio.sleep(0.1)  # Small delay to ensure WebSocket is ready
            
            success = app_state.mqtt_client.disconnect()
            
            # Give some time for the disconnect status to propagate
            await asyncio.sleep(0.1)
            
            return {"success": success, "message": "Disconnection initiated"}
        except Exception as e:
            logger.error(f"Disconnection error: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    
    return {"success": True, "message": "No active connection"}

@app.post("/api/subscribe")
async def subscribe_topic(subscription: TopicSubscription):
    """Subscribe to MQTT topic"""
    if not app_state.mqtt_client:
        raise HTTPException(status_code=400, detail="No MQTT client initialized")
    
    try:
        success = app_state.mqtt_client.subscribe_to_topic(
            subscription.topic, 
            subscription.qos
        )
        
        if success:
            return {"success": True, "message": f"Subscribed to {subscription.topic}"}
        else:
            raise HTTPException(status_code=400, detail="Failed to subscribe")
            
    except Exception as e:
        logger.error(f"Subscription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/unsubscribe/{topic}")
async def unsubscribe_topic(topic: str):
    """Unsubscribe from MQTT topic"""
    if not app_state.mqtt_client:
        raise HTTPException(status_code=400, detail="No MQTT client initialized")
    
    try:
        success = app_state.mqtt_client.unsubscribe_from_topic(topic)
        return {"success": success, "message": f"Unsubscribed from {topic}"}
    except Exception as e:
        logger.error(f"Unsubscription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/messages/recent")
async def get_recent_messages(limit: int = 50):
    """Get recent MQTT messages"""
    if not app_state.mqtt_client:
        return {"messages": []}
    
    try:
        messages = app_state.mqtt_client.get_recent_messages(limit)
        return {
            "messages": [
                {
                    "topic": msg.topic,
                    "payload": msg.payload,
                    "timestamp": msg.timestamp,
                    "qos": msg.qos,
                    "retain": msg.retain
                }
                for msg in messages
            ]
        }
    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/analytics")
async def get_analytics():
    """Get message analytics"""
    if not app_state.mqtt_client:
        return {"stats": {}, "topics": {}}
    
    try:
        stats = app_state.mqtt_client.get_message_statistics()
        return {
            "stats": stats,
            "topics": stats.get("topic_stats", {})
        }
    except Exception as e:
        logger.error(f"Error getting analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    
    # Send initial status
    try:
        mqtt_client = initialize_mqtt_client()
        status_data = {
            "type": "status",
            "data": {
                "status": mqtt_client.get_status().value,
                "connection_info": mqtt_client.get_connection_info()
            }
        }
        await websocket.send_text(json.dumps(status_data))
    except Exception as e:
        logger.error(f"Error sending initial status: {e}")
    
    try:
        while True:
            # Keep connection alive and handle any incoming messages
            try:
                data = await websocket.receive_text()
                # Handle any client messages if needed
                logger.info(f"Received WebSocket message: {data}")
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket error: {e}")
                break
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)

# Serve static files (frontend)
frontend_dir = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")

@app.on_event("startup")
async def startup_event():
    """Set the main event loop reference for cross-thread communication"""
    app_state.main_loop = asyncio.get_running_loop()
    logger.info("Main event loop reference saved")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")