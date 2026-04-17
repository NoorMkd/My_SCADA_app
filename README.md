a Conveyor Belt SCADA (Supervisory Control and Data Acquisition) System. It has a Python backend (with MQTT, Machine Learning, and Real-time SSE) 
and a React/Vite frontend dashboard.

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

"" cd conveyor-backend
   python -m venv venv
   
   On Windows use: venv\Scripts\activate
   
   pip install -r requirements.txt
   
  # Initialize the database:
  python create_tables.py 
  
  # Assuming you are using uvicorn with FastAPI:
  uvicorn app.main:app --reload

### 1. Frontend Setup

   cd conveyor-frontend

   npm install

   npm run dev
