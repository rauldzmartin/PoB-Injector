@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv" (
  echo [ERROR] Virtual environment not found. Please run install.bat in the root folder first.
  pause
  exit /b 1
)

call .venv\Scripts\activate

echo Cerrando procesos previos en el puerto 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

uvicorn app:app --host 127.0.0.1 --port 5000
