@echo off
echo === Starting Rubik's Cube Solver Frontend ===
echo.

cd /d "%~dp0frontend"

echo Installing Node dependencies...
npm install

echo.
echo Starting React dev server on http://localhost:3000
echo.
npm run dev
