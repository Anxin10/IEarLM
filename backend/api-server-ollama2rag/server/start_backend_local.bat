@echo off
echo Starting RAG-Ollama Backend (Local Mode)...
echo Setting environment variables for Localhost...

set QDRANT_HOST=localhost
set QDRANT_PORT=6333
set OLLAMA_HOST=localhost
set OLLAMA_PORT=11434

echo Environment variables set.
echo Starting app.py...
python app.py
pause
