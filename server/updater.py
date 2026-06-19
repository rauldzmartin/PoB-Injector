"""
PoB Injector Updater - Simple BAT-based updater
Generates a BAT file that handles the complete update process
"""
import sys, os, time, subprocess

def generate_bat_updater(repo, version, exe_dir, exe_path):
    """
    Generate BAT script that downloads, extracts, and installs update
    Returns path to generated BAT file
    """
    bat_path = os.path.join(exe_dir, "update.bat")
    log_path = os.path.join(exe_dir, "update.log")
    
    # GitHub release URL
    zip_url = f"https://github.com/{repo}/releases/download/v{version}/PoB_Injector_Release_v{version}.zip"
    
    # BAT script content
    bat_script = f"""@echo off
REM PoB Injector Auto-Updater v{version}
REM Log: {log_path}

echo ============================================================ > "{log_path}"
echo PoB Injector Auto-Updater >> "{log_path}"
echo Version: {version} >> "{log_path}"
echo ============================================================ >> "{log_path}"
echo. >> "{log_path}"

REM Step 1: Close running exe
echo [Step 1/5] Closing running application... >> "{log_path}"
taskkill /F /IM "PoB-Injector.exe" >nul 2>&1
timeout /t 3 /nobreak >nul
echo [OK] Process closed >> "{log_path}"
echo. >> "{log_path}"

REM Step 2: Download release ZIP
echo [Step 2/5] Downloading update... >> "{log_path}"
set "TEMP_ZIP=%TEMP%\\pob_update_{version}.zip"
set "UPDATE_DIR={exe_dir}\\update"

powershell -Command "Invoke-WebRequest -Uri '{zip_url}' -OutFile '%TEMP_ZIP%' -UserAgent 'PoB-Injector-Updater'" >> "{log_path}" 2>&1
if errorlevel 1 (
    echo [ERROR] Download failed >> "{log_path}"
    echo Update failed. Check update.log for details.
    timeout /t 5 /nobreak >nul
    exit /b 1
)
echo [OK] Download completed >> "{log_path}"
echo. >> "{log_path}"

REM Step 3: Extract ZIP to /update folder
echo [Step 3/5] Extracting update... >> "{log_path}"
if exist "%UPDATE_DIR%" rmdir /s /q "%UPDATE_DIR%" >nul 2>&1
powershell -Command "Expand-Archive -Path '%TEMP_ZIP%' -DestinationPath '%UPDATE_DIR%' -Force" >> "{log_path}" 2>&1
if errorlevel 1 (
    echo [ERROR] Extraction failed >> "{log_path}"
    echo Update failed. Check update.log for details.
    timeout /t 5 /nobreak >nul
    exit /b 1
)
echo [OK] Extracted to update folder >> "{log_path}"
echo. >> "{log_path}"

REM Step 4: Replace exe
echo [Step 4/5] Installing new version... >> "{log_path}"
if exist "{exe_path}.old" del /f /q "{exe_path}.old" >nul 2>&1
if exist "{exe_path}" move /y "{exe_path}" "{exe_path}.old" >> "{log_path}" 2>&1
copy /y "%UPDATE_DIR%\\PoB-Injector\\PoB-Injector.exe" "{exe_path}" >> "{log_path}" 2>&1
if errorlevel 1 (
    echo [ERROR] Installation failed >> "{log_path}"
    if exist "{exe_path}.old" (
        echo [INFO] Restoring backup... >> "{log_path}"
        move /y "{exe_path}.old" "{exe_path}" >nul 2>&1
    )
    echo Update failed. Check update.log for details.
    timeout /t 5 /nobreak >nul
    exit /b 1
)
echo [OK] New version installed >> "{log_path}"
echo. >> "{log_path}"

REM Step 5: Start new exe
echo [Step 5/5] Starting application... >> "{log_path}"
start "" "{exe_path}" --updated
timeout /t 3 /nobreak >nul

REM Verify process started
tasklist | find /i "PoB-Injector.exe" >nul
if errorlevel 1 (
    echo [WARNING] Process not detected >> "{log_path}"
    echo Application may need to be started manually >> "{log_path}"
) else (
    echo [OK] Application started successfully >> "{log_path}"
)

echo. >> "{log_path}"
echo ============================================================ >> "{log_path}"
echo Update completed! >> "{log_path}"
echo ============================================================ >> "{log_path}"

REM Cleanup
del /f /q "%TEMP_ZIP%" >nul 2>&1
rmdir /s /q "%UPDATE_DIR%" >nul 2>&1
del /f /q "{bat_path}" >nul 2>&1

exit
"""
    
    # Write BAT file
    with open(bat_path, 'w', encoding='utf-8') as f:
        f.write(bat_script)
    
    return bat_path

def main():
    print("============================================================")
    print("PoB Injector Updater (BAT-based)")
    print("============================================================")
    
    # Check if running in frozen/compiled mode
    is_compiled = getattr(sys, 'frozen', False)
    
    if is_compiled:
        exe_path = sys.executable
        exe_dir = os.path.dirname(exe_path)
    else:
        # Dev mode - not supported with BAT updater
        print("[ERROR] BAT updater only works in compiled mode")
        print("[INFO] In dev mode, use git pull instead")
        return
    
    print(f"Mode: Compiled")
    print(f"Exe: {exe_path}")
    print(f"Dir: {exe_dir}")
    print("")
    
    # Parse arguments
    if len(sys.argv) < 3:
        print("[ERROR] Usage: updater.py <repo> <version>")
        print("Example: updater.py rauldzmartin/PoB-Injector 0.6.52-beta")
        return
    
    repo = sys.argv[1]
    version = sys.argv[2]
    
    print(f"Repository: {repo}")
    print(f"Version: {version}")
    print("")
    
    # Wait for server to shut down
    print("Waiting for server to shut down...")
    time.sleep(2)
    
    # Generate BAT updater
    print("Generating BAT updater...")
    bat_path = generate_bat_updater(repo, version, exe_dir, exe_path)
    print(f"[OK] Updater generated: {bat_path}")
    print("")
    
    # Execute BAT file
    print("Launching updater...")
    print("============================================================")
    print("")
    
    try:
        # Execute BAT file in a new window
        subprocess.Popen([bat_path], shell=True, creationflags=subprocess.CREATE_NEW_CONSOLE)
        
        print("[OK] Updater launched")
        print("[INFO] Check update.log for progress")
        
    except Exception as e:
        print(f"[ERROR] Failed to launch updater: {e}")
        try:
            os.remove(bat_path)
        except:
            pass

if __name__ == "__main__":
    main()
