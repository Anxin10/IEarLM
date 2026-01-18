@echo off
echo ===================================================
echo Debugging RAG-Ollama Backend Startup
echo ===================================================
echo.
echo [1/3] Installing dependencies...
pip install -r requirements.txt
echo.

echo [2/3] Verifying imports...
python -c "import fastapi; import dotenv; import uvicorn; print('Imports OK')"
if %errorlevel% neq 0 (
    echo [ERROR] Import failed! Please check your environment.
    pause
    exit /b
)
echo.

echo [3/3] Starting app.py...
set QDRANT_HOST=localhost
set QDRANT_PORT=6333
python app.py

echo.
echo [INFO] App has exited. If you see errors above, please screenshot them.
pause
