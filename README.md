# MQTT Message Visualizer

A real-time MQTT message visualizer with FastAPI backend and JavaScript frontend that provides WebSocket-based live message streaming and visualization.

## Prerequisites

**All platforms:**
- Python 3.8 or higher
- pip (Python package manager)

## Installation & Running

### Linux & Mac

1. **Clone and navigate to the project:**
   ```bash
   cd flowero
   ```

2. **Create virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the server:**
   ```bash
   python backend/main.py
   ```

### Windows

1. **Clone and navigate to the project:**
   ```cmd
   cd flowero
   ```

2. **Create virtual environment:**
   ```cmd
   python -m venv venv
   venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```cmd
   pip install -r requirements.txt
   ```

4. **Run the server:**
   ```cmd
   python backend\main.py
   ```

## Access the Application

Once running, the server will be available at:
- **Web Interface:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs
- **WebSocket Endpoint:** ws://localhost:8000/ws

The application provides a real-time MQTT message visualizer with WebSocket connectivity for live message streaming and visualization.