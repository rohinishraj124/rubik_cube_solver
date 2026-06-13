@echo off
echo === Starting Rubik's Cube Solver Backend ===
echo.

cd /d "%~dp0backend"

echo Installing Python dependencies...
pip install fastapi "uvicorn[standard]" numpy opencv-python pydantic python-multipart

echo.
echo Trying to install kociemba (optional, needs C++ Build Tools)...
pip install kociemba --only-binary=:all: 2>nul || echo [WARN] kociemba not installed - using IDA* fallback (still works!)

echo.
echo Starting FastAPI server on http://localhost:8000
echo API docs at http://localhost:8000/docs
echo.
python -m uvicorn api.main:app --reload --port 8000
