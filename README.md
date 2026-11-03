# Autonomous R&D Lab — Phase 1

AI-driven mechanical/electronics R&D workspace. Phase 1 establishes project tracking, artifact storage, an API, and a control dashboard. Physical robot control is intentionally out of scope until the safety and hardware layers are validated.

## Architecture
- FastAPI service: project/task/artifact metadata and health endpoint
- SQLite for the Phase 1 prototype (move to managed PostgreSQL before multi-user/production use)
- Static dashboard served by FastAPI
- Later adapters: FreeCAD, KiCad, build/test runners, and Raspberry Pi 5 + ROBOTIS DYNAMIXEL AX-18A

## Local setup (Windows PowerShell)
1. Install Python 3.11 or newer.
2. In this folder run:
   `py -3 -m venv .venv`
   `.venv\\Scripts\\Activate.ps1`
   `python -m pip install -r requirements.txt`
   `uvicorn app.main:app --reload`
3. Open http://127.0.0.1:8000

## Linux / macOS
`python3 -m venv .venv && source .venv/bin/activate`
`python -m pip install -r requirements.txt`
`uvicorn app.main:app --reload`

## Configuration
Copy `.env.example` to `.env`. Never commit API keys. AI provider integration is deliberately disabled until a provider and budget are explicitly configured.

## Safety boundary
This Phase 1 service does not send commands to motors, energize actuators, or execute generated code. Generated CAD/PCB/code remains a reviewable artifact. Hardware actuation must later require explicit operator approval, current/torque limits, guarded mechanisms, and a physical emergency stop.
