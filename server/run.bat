@echo off
setlocal
cd /d "%~dp0"

if not exist ".venv" (
  echo [ERROR] Virtual environment not found. Please run install.bat in the root folder first.
  pause
  exit /b 1
)

call .venv\Scripts\activate

echo Closing previous processes on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5000" ^| findstr "LISTENING"') do taskkill /F /PID %%a >nul 2>&1

if not exist ".venv\Scripts\PoB-Injector.exe" (
  copy /Y ".venv\Scripts\pythonw.exe" ".venv\Scripts\PoB-Injector.exe" >nul
)
start "" .venv\Scripts\PoB-Injector.exe tray.py
