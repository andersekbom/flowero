import streamlit as st
import os
import sys
from datetime import datetime
import time
import hashlib
import pandas as pd

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))
from mqtt_client import MQTTClientWrapper, ConnectionStatus

def validate_topic(topic):
    """Validate MQTT topic format"""
    if not topic or not topic.strip():
        return False
    
    # Check for invalid characters
    invalid_chars = ['\x00', '\t', '\n', '\r']
    for char in invalid_chars:
        if char in topic:
            return False
    
    # Check for valid wildcard usage
    parts = topic.split('/')
    for part in parts:
        if '+' in part and part != '+':
            return False  # + must be standalone
        if '#' in part and part != '#':
            return False  # # must be standalone
    
    # # can only be at the end
    if '#' in topic and not topic.endswith('#'):
        return False
    
    return True



def get_topic_color(topic):
    """Generate a consistent color for a topic based on hash"""
    topic_hash = hashlib.md5(topic.encode()).hexdigest()
    # Convert first 6 characters of hash to RGB color
    return f"#{topic_hash[:6]}"

def format_message_payload(payload, max_length=100):
    """Format message payload for display"""
    if len(payload) <= max_length:
        return payload
    return payload[:max_length] + "..."

def format_timestamp(timestamp):
    """Format timestamp for display"""
    dt = datetime.fromtimestamp(timestamp)
    return dt.strftime("%H:%M:%S.%f")[:-3]  # Include milliseconds

def initialize_mqtt_client():
    """Initialize MQTT client in session state"""
    if 'mqtt_client' not in st.session_state:
        st.session_state.mqtt_client = MQTTClientWrapper()
        st.session_state.connection_status = ConnectionStatus.DISCONNECTED
        st.session_state.last_update = time.time()
        st.session_state.current_step = "connect"  # connect -> subscribe -> monitor
    
    return st.session_state.mqtt_client

def main():
    st.set_page_config(
        page_title="MQTT Message Visualizer",
        page_icon="📡",
        layout="wide"
    )
    
    st.title("📡 MQTT Message Visualizer")
    st.markdown("### Real-time MQTT data visualization and monitoring")
    
    # Initialize session state  
    if 'form_errors' not in st.session_state:
        st.session_state.form_errors = {}
    
    # Initialize MQTT client
    mqtt_client = initialize_mqtt_client()
    
    # Update connection status
    current_status = mqtt_client.get_status()
    if st.session_state.connection_status != current_status:
        st.session_state.connection_status = current_status
    
    # Simplified step-by-step sidebar
    with st.sidebar:
        st.header("MQTT Visualizer")
        
        # Step indicator
        steps = ["🔌 Connect", "📡 Subscribe", "📊 Monitor"] 
        current_step_idx = {"connect": 0, "subscribe": 1, "monitor": 2}.get(st.session_state.current_step, 0)
        
        # Visual step indicator
        for i, step in enumerate(steps):
            if i == current_step_idx:
                st.markdown(f"**{step}** ⬅️")
            elif i < current_step_idx:
                st.markdown(f"~~{step}~~ ✅")
            else:
                st.markdown(f"{step}")
        
        st.divider()
        
        # STEP 1: CONNECTION
        if st.session_state.current_step == "connect":
            st.subheader("🔌 Step 1: Connect to Broker")
            
            # Simple connection form
            broker_host = st.text_input("Broker Host", placeholder="broker.emqx.io", key="broker_host")
            port = st.number_input("Port", min_value=1, max_value=65535, value=1883, key="port")
            
            # Optional credentials (collapsed by default)
            with st.expander("🔐 Authentication (Optional)"):
                username = st.text_input("Username", key="username")
                password = st.text_input("Password", type="password", key="password")
            
            # Connect button
            can_connect = bool(broker_host and broker_host.strip())
            
            if st.button("🔌 Connect to Broker", type="primary", disabled=not can_connect):
                if can_connect:
                    success = mqtt_client.connect(
                        broker_host.strip(),
                        port,
                        username or None,
                        password or None
                    )
                    if success:
                        st.session_state.current_step = "subscribe"
                        st.success("🟢 Connection initiated! Moving to Step 2...")
                        time.sleep(1)
                        st.rerun()
                    else:
                        st.error("❌ Failed to initiate connection")
                else:
                    st.error("❌ Please enter a broker host")
            
            if not can_connect and broker_host == "":
                st.info("💡 Try: broker.emqx.io, test.mosquitto.org")
        
        # STEP 2: SUBSCRIPTION  
        elif st.session_state.current_step == "subscribe":
            st.subheader("📡 Step 2: Subscribe to Topics")
            
            # Show connection status
            if current_status == ConnectionStatus.CONNECTED:
                st.success("🟢 Connected! Ready to subscribe.")
            elif current_status == ConnectionStatus.CONNECTING:
                st.info("🟡 Connecting...")
                # Auto-refresh during connection
                time.sleep(1)
                st.rerun()
            elif current_status == ConnectionStatus.CONNECTION_FAILED:
                st.error("🔴 Connection failed! Going back to Step 1.")
                st.session_state.current_step = "connect"
                st.rerun()
            
            if current_status == ConnectionStatus.CONNECTED:
                # Simple topic subscription
                topic = st.text_input(
                    "Topic to Subscribe", 
                    placeholder="sensor/+/data or home/#",
                    help="Use + for single level wildcard, # for multi-level"
                )
                
                col1, col2 = st.columns([2, 1])
                
                with col1:
                    if st.button("📡 Subscribe to Topic", disabled=not topic):
                        if topic and validate_topic(topic.strip()):
                            success = mqtt_client.subscribe_to_topic(topic.strip())
                            if success:
                                st.success(f"✅ Subscribed to: {topic.strip()}")
                                st.session_state.current_step = "monitor"
                                time.sleep(1)
                                st.rerun()
                            else:
                                st.error("❌ Failed to subscribe")
                        else:
                            st.error("❌ Invalid topic format")
                
                with col2:
                    if st.button("⬅️ Back"):
                        mqtt_client.disconnect()
                        st.session_state.current_step = "connect"
                        st.rerun()
                
                # Show current subscriptions if any
                subscribed = mqtt_client.get_subscribed_topics()
                if subscribed:
                    st.write("**Current Subscriptions:**")
                    for topic_name in subscribed.keys():
                        st.text(f"📡 {topic_name}")
                    
                    if st.button("✅ Continue to Monitor"):
                        st.session_state.current_step = "monitor"
                        st.rerun()
        
        # STEP 3: MONITORING
        elif st.session_state.current_step == "monitor":
            st.subheader("📊 Step 3: Monitor Messages")
            
            # Show connection info
            subscribed = mqtt_client.get_subscribed_topics()
            if subscribed:
                st.success(f"🟢 Connected & monitoring {len(subscribed)} topic(s)")
                
                # Quick actions
                col1, col2 = st.columns(2)
                
                with col1:
                    if st.button("➕ Add Topic"):
                        st.session_state.current_step = "subscribe"  
                        st.rerun()
                
                with col2:
                    if st.button("🔌 Disconnect"):
                        mqtt_client.disconnect()
                        st.session_state.current_step = "connect"
                        st.rerun()
                
                st.divider()
                
                # Show subscriptions
                st.write("**Active Subscriptions:**")
                for topic_name in subscribed.keys():
                    col_topic, col_unsub = st.columns([3, 1])
                    with col_topic:
                        st.text(f"📡 {topic_name}")
                    with col_unsub:
                        if st.button("❌", key=f"unsub_{topic_name}"):
                            mqtt_client.unsubscribe_from_topic(topic_name)
                            remaining = mqtt_client.get_subscribed_topics()
                            if not remaining:
                                st.session_state.current_step = "subscribe"
                            st.rerun()
            else:
                st.warning("⚠️ No active subscriptions")
                if st.button("📡 Subscribe to Topics"):
                    st.session_state.current_step = "subscribe"
                    st.rerun()
    
    # Main content area with tabs
    tab1, tab2, tab3, tab4 = st.tabs(["📊 Live Stream", "📈 Analytics", "🌳 Topic Tree", "⚙️ Settings"])
    
    with tab1:
        st.header("Live Message Stream")
        
        # Get real-time statistics
        stats = mqtt_client.get_message_statistics()
        conn_info = mqtt_client.get_connection_info()
        
        # Connection status metrics
        col1, col2, col3 = st.columns(3)
        with col1:
            status_color = {
                ConnectionStatus.CONNECTED: "normal",
                ConnectionStatus.CONNECTING: "off",
                ConnectionStatus.DISCONNECTED: "off",
                ConnectionStatus.CONNECTION_FAILED: "inverse",
                ConnectionStatus.CONNECTION_LOST: "inverse"
            }.get(current_status, "off")
            
            st.metric(
                "Status", 
                current_status.value,
                delta=None
            )
            
        with col2:
            st.metric(
                "Total Messages", 
                f"{stats.get('total_messages', 0):,}",
                delta=f"{stats.get('messages_per_second', 0):.1f}/sec" if stats.get('messages_per_second', 0) > 0 else None
            )
            
        with col3:
            st.metric(
                "Active Topics", 
                stats.get('active_topics', 0),
                delta=None
            )
        
        # Show connection info when connected
        if current_status == ConnectionStatus.CONNECTED:
            with st.expander("📊 Connection Details", expanded=False):
                col_host, col_topics = st.columns(2)
                with col_host:
                    st.write(f"**Host:** {conn_info.get('host', 'N/A')}")
                    st.write(f"**Port:** {conn_info.get('port', 'N/A')}")
                    st.write(f"**Client ID:** {conn_info.get('client_id', 'N/A')}")
                
                with col_topics:
                    subscribed_topics = conn_info.get('subscribed_topics', {})
                    if subscribed_topics:
                        st.write("**Subscribed Topics:**")
                        for topic, qos in subscribed_topics.items():
                            st.write(f"• {topic} (QoS: {qos})")
                    else:
                        st.write("**No active subscriptions**")
        
        # Message stream area with live indicator
        col_title, col_indicator = st.columns([3, 1])
        with col_title:
            st.subheader("📨 Live Message Stream")
        with col_indicator:
            if current_status == ConnectionStatus.CONNECTED:
                st.markdown("<div style='text-align: right; color: #28a745;'>🟢 LIVE</div>", unsafe_allow_html=True)
            else:
                st.markdown("<div style='text-align: right; color: #6c757d;'>⚪ OFFLINE</div>", unsafe_allow_html=True)
        
        if current_status == ConnectionStatus.CONNECTED:
            # Get recent messages
            recent_messages = mqtt_client.get_recent_messages(50)  # Last 50 messages
            
            if recent_messages:
                # Create a scrollable container for messages
                st.markdown("""
                <style>
                .message-stream {
                    height: 500px;
                    overflow-y: auto;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 10px;
                    background-color: rgba(240, 242, 246, 0.1);
                }
                </style>
                """, unsafe_allow_html=True)
                
                # Display messages in chronological order (newest at bottom)
                message_container = st.container()
                
                with message_container:
                    for msg in recent_messages:
                        topic_color = get_topic_color(msg.topic)
                        formatted_time = format_timestamp(msg.timestamp)
                        formatted_payload = format_message_payload(msg.payload)
                        
                        # Create message card
                        st.markdown(
                            f"""<div style="
                                background-color: {topic_color}22; 
                                border-left: 4px solid {topic_color}; 
                                padding: 8px; 
                                margin: 4px 0; 
                                border-radius: 4px;
                            ">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <strong style="color: {topic_color}; font-size: 0.9em;">{msg.topic}</strong>
                                <span style="color: #666; font-size: 0.8em; font-family: monospace;">{formatted_time}</span>
                            </div>
                            <div style="margin-top: 4px; font-family: monospace; font-size: 0.85em;">
                                {formatted_payload}
                            </div>
                            <div style="margin-top: 4px; color: #888; font-size: 0.75em;">
                                QoS: {msg.qos} | Retain: {msg.retain}
                            </div>
                            </div>""",
                            unsafe_allow_html=True
                        )
                
                # Add scroll-to-bottom JavaScript
                st.markdown("""
                <script>
                setTimeout(function() {
                    var element = document.querySelector('.message-stream');
                    if (element) {
                        element.scrollTop = element.scrollHeight;
                    }
                }, 100);
                </script>
                """, unsafe_allow_html=True)
                
                # Auto-refresh for real-time streaming (300ms for faster updates)
                if time.time() - st.session_state.get('last_update', 0) > 0.3:
                    st.session_state.last_update = time.time()
                    st.rerun()
            else:
                st.info("No messages received yet. Waiting for MQTT messages...")
                
                # Auto-refresh when no messages (1 second)
                if time.time() - st.session_state.get('last_update', 0) > 1:
                    st.session_state.last_update = time.time()
                    st.rerun()
        else:
            if current_status == ConnectionStatus.CONNECTING:
                st.info("🔄 Connecting to MQTT broker...")
                # Refresh during connection attempt (500ms)
                if time.time() - st.session_state.get('last_update', 0) > 0.5:
                    st.session_state.last_update = time.time()
                    st.rerun()
            elif current_status == ConnectionStatus.CONNECTION_FAILED:
                st.error(f"❌ Connection failed: {mqtt_client.get_last_error()}")
            elif current_status == ConnectionStatus.CONNECTION_LOST:
                st.warning("⚠️ Connection lost. Please reconnect.")
            else:
                st.info("📡 Connect to an MQTT broker to see live messages")
    
    with tab2:
        st.header("Message Analytics")
        
        if current_status == ConnectionStatus.CONNECTED:
            # Get statistics for charts
            stats = mqtt_client.get_message_statistics()
            recent_messages = mqtt_client.get_recent_messages(100)
            
            col1, col2 = st.columns(2)
            
            with col1:
                st.subheader("📊 Message Rate Over Time")
                
                if recent_messages:
                    # Create time series data for message rate
                    import plotly.graph_objects as go
                    from collections import defaultdict
                    import numpy as np
                    
                    # Group messages by time intervals (30-second buckets)
                    time_buckets = defaultdict(int)
                    current_time = time.time()
                    
                    for msg in recent_messages:
                        # Round timestamp to 30-second intervals
                        bucket_time = int(msg.timestamp // 30) * 30
                        time_buckets[bucket_time] += 1
                    
                    # Prepare data for plotting
                    times = sorted(time_buckets.keys())[-20:]  # Last 20 intervals
                    counts = [time_buckets[t] for t in times]
                    time_labels = [datetime.fromtimestamp(t).strftime("%H:%M:%S") for t in times]
                    
                    # Create line chart
                    fig = go.Figure()
                    fig.add_trace(go.Scatter(
                        x=time_labels,
                        y=counts,
                        mode='lines+markers',
                        name='Messages/30s',
                        line=dict(color='#1f77b4', width=2),
                        marker=dict(size=6)
                    ))
                    
                    fig.update_layout(
                        title=f"Current Rate: {stats.get('messages_per_second', 0):.1f} msg/sec",
                        xaxis_title="Time",
                        yaxis_title="Message Count",
                        height=300,
                        showlegend=False,
                        margin=dict(l=50, r=50, t=50, b=50)
                    )
                    
                    st.plotly_chart(fig, use_container_width=True)
                else:
                    st.info("No message data available yet")
            
            with col2:
                st.subheader("🎯 Topic Activity")
                
                topic_stats = stats.get('topic_stats', {})
                if topic_stats:
                    # Create bar chart for topic activity
                    topics = list(topic_stats.keys())
                    counts = list(topic_stats.values())
                    
                    # Sort by count (descending) and take top 10
                    topic_data = sorted(zip(topics, counts), key=lambda x: x[1], reverse=True)[:10]
                    topics, counts = zip(*topic_data) if topic_data else ([], [])
                    
                    # Generate colors for topics
                    colors = [get_topic_color(topic) for topic in topics]
                    
                    fig = go.Figure()
                    fig.add_trace(go.Bar(
                        x=list(counts),
                        y=list(topics),
                        orientation='h',
                        marker=dict(color=colors),
                        text=counts,
                        textposition='auto'
                    ))
                    
                    fig.update_layout(
                        title="Message Count by Topic",
                        xaxis_title="Message Count",
                        yaxis_title="Topics",
                        height=400,
                        showlegend=False,
                        margin=dict(l=150, r=50, t=50, b=50)
                    )
                    
                    fig.update_yaxes(autorange="reversed")  # Show highest count at top
                    
                    st.plotly_chart(fig, use_container_width=True)
                    
                    # Show summary statistics
                    st.subheader("📈 Summary")
                    col_total, col_topics, col_rate = st.columns(3)
                    
                    with col_total:
                        st.metric("Total Messages", f"{stats.get('total_messages', 0):,}")
                    
                    with col_topics:
                        st.metric("Unique Topics", len(topic_stats))
                    
                    with col_rate:
                        avg_per_topic = stats.get('total_messages', 0) / len(topic_stats) if topic_stats else 0
                        st.metric("Avg per Topic", f"{avg_per_topic:.1f}")
                else:
                    st.info("No topic activity data available yet")
                    
        else:
            st.info("📈 Connect to an MQTT broker to see analytics")
            
            # Show placeholder charts
            col1, col2 = st.columns(2)
            with col1:
                st.subheader("Message Rate")
                st.info("Real-time message rate chart will appear here")
            with col2:
                st.subheader("Topic Activity") 
                st.info("Topic activity breakdown will appear here")
    
    with tab3:
        st.header("Topic Tree View")
        st.info("🌳 Hierarchical topic structure will be shown here")
        st.empty()  # Placeholder for topic tree
    
    with tab4:
        st.header("Application Settings")
        st.info("⚙️ Additional configuration options")
        
        st.subheader("Display Settings")
        st.selectbox("Theme", ["Auto", "Light", "Dark"])
        st.slider("Max Messages to Display", 10, 1000, 100)
        st.checkbox("Show Timestamps", value=True)
        st.checkbox("Auto-scroll", value=True)

if __name__ == "__main__":
    main()