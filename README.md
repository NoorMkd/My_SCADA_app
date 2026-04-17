a Conveyor Belt SCADA (Supervisory Control and Data Acquisition) System. It has a Python backend (with MQTT, Machine Learning, and Real-time SSE) 
and a React/Vite frontend dashboard.

**Important**: The backend needs PostgreSQL 18 + TimescaleDB.

# Frontend (`/conveyor-frontend`)

* **Framework:** React.js powered by Vite
* **State Management:** React Context API (`AuthContext`, `MachineContext`)
* **Real-time Updates:** Server-Sent Events (SSE)

# Backend (`/conveyor-backend`)
* **Framework:** Python (FastAPI)
* **IoT / Messaging:** MQTT (`mqtt_handler.py`)
* **Real-time Streaming:** SSE Manager (`sse_manager.py`)
* **Data & AI:** Custom ML Engine (`ml_engine.py`)
* **Database:** Relational Database with SQLAlchemy ORM

### Prerequisites
* Python 3.8+
* Node.js & npm 
* An MQTT Broker (e.g., Mosquitto) running locally

### 1. Backend Setup
Navigate to the backend directory and set up your Python environment:


### Backend Setup

cd conveyor-backend

venv\Scripts\activate

pip install -r requirements.txt

###Create all tables (users table included)
python create_tables.py

###. Create the 4 demo users (admin, supervisor, operator, technician)
python create_demo_users.py

###. Start the backend server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


### 2. Frontend Setup

   cd conveyor-frontend

   npm install

   npm run dev
