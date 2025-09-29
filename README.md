# MQTT Message Visualizer

A real-time MQTT message visualizer with FastAPI backend and JavaScript frontend featuring multiple visualization modes.

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

## 🏗️ Frontend Architecture

```
frontend/src/
├── animation/          # Animation systems (5 modules)
│   ├── LinearAnimation.js
│   ├── ForceAnimation.js
│   ├── ClustersAnimation.js
│   ├── AnimationManager.js
│   └── AnimationTypes.js
├── config/            # Configuration & constants (3 modules)
│   ├── AppConfig.js
│   ├── GlobalFunctions.js
│   └── Constants.js
├── core/              # Core application systems (4 modules)
│   ├── LayoutCalculator.js
│   ├── MessageProcessor.js
│   ├── CleanupManager.js
│   ├── ContainerSystem.js
│   └── PerformanceManager.js
├── elements/          # Element management (5 modules)
│   ├── StyleProvider.js
│   ├── CircleStyle.js
│   ├── UnifiedElementSystem.js
│   ├── UnifiedElementTracker.js
│   └── ElementFactory.js
└── modes/             # Mode switching (1 module)
    └── ModeManager.js
```
