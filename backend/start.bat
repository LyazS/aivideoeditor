@echo off
echo Starting AI Video Editor Backend...
echo.
echo Installing dependencies...
pip install -r requirements.txt
echo.
echo Starting server on http://localhost:8900
echo Press Ctrl+C to stop the server
echo.
python main.py
pause
