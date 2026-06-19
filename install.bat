@echo off
setlocal enabledelayedexpansion

echo ====================================================
echo Path of Building (PoB) Configuration
echo ====================================================

:: Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [INFO] Python is not installed or not added to your PATH.
    echo Attempting to install Python 3.13 via winget...
    winget install --id Python.Python.3.13 --source winget --accept-package-agreements --accept-source-agreements
    
    echo.
    echo Refreshing environment variables...
    set "PATH=!PATH!;%LOCALAPPDATA%\Programs\Python\Python313\Scripts;%LOCALAPPDATA%\Programs\Python\Python313"
    set "PATH=!PATH!;C:\Program Files\Python313\Scripts;C:\Program Files\Python313"
    
    python --version >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Python was installed but couldn't be loaded in this session.
        echo Please restart the console and run install.bat again.
        pause
        exit /b 1
    )
    echo [SUCCESS] Python successfully installed and loaded!
)

:: Try to guess PoB location
set "POB_DEFAULT=%APPDATA%\Path of Building Community"
if not exist "!POB_DEFAULT!\Launch.lua" (
    set "POB_DEFAULT=C:\ProgramData\Path of Building Community"
)
if not exist "!POB_DEFAULT!\Launch.lua" (
    set "POB_DEFAULT="
)

:ask_pob
echo.
echo Please provide the full path to your Path of Building Community directory.
echo Example format: C:\Users\Username\AppData\Roaming\Path of Building Community
if "!POB_DEFAULT!"=="" (
    set /p POB_INSTALL="Path of Building Community directory: "
) else (
    set /p POB_INSTALL="Path of Building Community directory (press Enter to use '!POB_DEFAULT!'): "
)

if "!POB_INSTALL!"=="" set "POB_INSTALL=!POB_DEFAULT!"
set "POB_INSTALL=!POB_INSTALL:"=!"
if "!POB_INSTALL:~-1!"=="\" set "POB_INSTALL=!POB_INSTALL:~0,-1!"

if not exist "!POB_INSTALL!\Launch.lua" (
    echo [WARNING] "Launch.lua" not found in the specified directory: !POB_INSTALL!
    echo Please verify the path.
    set "POB_DEFAULT="
    goto ask_pob
)



set "WRAPPER_DIR=%~dp0"
set "WRAPPER_DIR=!WRAPPER_DIR:"=!"
if "!WRAPPER_DIR:~-1!"=="\" set "WRAPPER_DIR=!WRAPPER_DIR:~0,-1!"

cd /d "%~dp0server"

echo.
echo Saving configuration to .env...
echo POB_INSTALL="!POB_INSTALL!" > .env
echo USER_POB_WRAPPER="!WRAPPER_DIR!" >> .env

echo.
echo Installing server dependencies...
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

echo Activating virtual environment and installing dependencies...
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt

echo.
echo Dependencies installed and directories configured successfully.

echo.
echo ====================================================
echo IMPORTANT: Extension Installation
echo ====================================================
echo Remember to install the extension in your browser:
echo 1. Go to chrome://extensions/ or brave://extensions/
echo 2. Enable "Developer mode"
echo 3. Click "Load unpacked" and select the "extension" folder in this directory.
echo ====================================================

echo.
choice /C YN /M "Do you want to start the server now?"
if errorlevel 2 goto end
if errorlevel 1 goto start_server

:start_server
echo.
echo Starting server at http://127.0.0.1:5000 ...
call .venv\Scripts\activate
uvicorn app:app --host 127.0.0.1 --port 5000

:end
