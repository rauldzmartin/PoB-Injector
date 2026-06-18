@echo off
setlocal enabledelayedexpansion

echo Building PoB-Injector standalone executable...

cd /d "%~dp0"

:: Ensure .venv exists
if not exist ".venv" (
    echo Creating virtual environment...
    python -m venv .venv
)

:: Install dependencies
echo Installing dependencies...
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt

:: Generate ICO file
python -c "from PIL import Image; img = Image.open('../extension/img/icon-128.png'); img.save('../extension/img/icon.ico', format='ICO')"

:: Run pyinstaller
pyinstaller ^
  --name "PoB-Injector" ^
  --onefile ^
  --noconsole ^
  --icon "..\extension\img\icon.ico" ^
  --add-data "pob_wrapper\data;pob_wrapper\data" ^
  --add-data "..\extension\img;extension\img" ^
  --distpath "..\dist" ^
  --workpath "..\build" ^
  --specpath "." ^
  tray.py

echo.
echo Build complete! Executable is located in the root "dist" folder.
pause
