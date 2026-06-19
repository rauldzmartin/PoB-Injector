import sys, os, time, urllib.request, zipfile, shutil, subprocess, socket

def setup_logging(log_path):
    """Redirect stdout/stderr to updater.log"""
    log_file = open(log_path, "w", encoding="utf-8")
    sys.stdout = log_file
    sys.stderr = log_file
    return log_file

def wait_for_exe_release(exe_path, max_wait=15):
    """Wait for exe to be released by polling, max 15 seconds"""
    if not exe_path or not os.path.exists(exe_path):
        return True
    
    print(f"Waiting for {exe_path} to be released...")
    start = time.time()
    while time.time() - start < max_wait:
        try:
            # Try to rename to itself (tests if file is locked)
            os.rename(exe_path, exe_path)
            print(f"[OK] Exe released after {time.time() - start:.1f}s")
            return True
        except OSError:
            time.sleep(0.5)
    
    print(f"[WARNING] Exe still locked after {max_wait}s, proceeding anyway...")
    return False

def kill_port_5000():
    """Kill any process using port 5000 (in case server didn't exit cleanly)"""
    try:
        if os.name == 'nt':
            # Windows: netstat + findstr + taskkill
            result = subprocess.run(
                ['netstat', '-ano'], 
                capture_output=True, 
                text=True,
                creationflags=0x08000000  # CREATE_NO_WINDOW
            )
            for line in result.stdout.splitlines():
                if ':5000' in line and 'LISTENING' in line:
                    parts = line.split()
                    pid = parts[-1]
                    print(f"Killing process {pid} on port 5000...")
                    subprocess.run(['taskkill', '/F', '/PID', pid], 
                                 creationflags=0x08000000)
    except Exception as e:
        print(f"[WARNING] Could not kill port 5000: {e}")

def download_with_retry(url, dest, max_retries=3):
    """Download with exponential backoff retry logic"""
    for attempt in range(1, max_retries + 1):
        try:
            print(f"Downloading ({attempt}/{max_retries}): {url}")
            req = urllib.request.Request(url, headers={'User-Agent': 'PoB-Injector-Updater/1.0'})
            
            with urllib.request.urlopen(req, timeout=60) as response:
                total_size = int(response.headers.get('Content-Length', 0))
                downloaded = 0
                
                with open(dest, 'wb') as out_file:
                    while True:
                        chunk = response.read(8192)
                        if not chunk:
                            break
                        out_file.write(chunk)
                        downloaded += len(chunk)
                        if total_size > 0:
                            progress = (downloaded / total_size) * 100
                            print(f"Progress: {progress:.1f}% ({downloaded}/{total_size} bytes)", end='\r')
                
                print(f"\n[OK] Download completed: {downloaded} bytes")
                
                # Verify file exists and has content
                if os.path.exists(dest) and os.path.getsize(dest) > 0:
                    return True
                else:
                    raise Exception("Downloaded file is empty or missing")
                    
        except urllib.error.HTTPError as e:
            print(f"[ERROR] HTTP {e.code}: {e.reason}")
            if e.code == 404:
                print("[FATAL] Release not found (404) - cannot retry")
                return False
            if attempt < max_retries:
                wait = 2 ** attempt  # Exponential backoff: 2, 4, 8 seconds
                print(f"Retrying in {wait} seconds...")
                time.sleep(wait)
            else:
                print(f"[FATAL] Download failed after {max_retries} attempts")
                return False
        except Exception as e:
            print(f"[ERROR] Download failed: {e}")
            if attempt < max_retries:
                wait = 2 ** attempt
                print(f"Retrying in {wait} seconds...")
                time.sleep(wait)
            else:
                print(f"[FATAL] Download failed after {max_retries} attempts")
                return False
    
    return False

def extract_and_validate(zip_path, extract_dir):
    """Validate ZIP integrity and extract"""
    print(f"Validating ZIP integrity: {zip_path}")
    
    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            # Test ZIP integrity
            corrupt_file = zip_ref.testzip()
            if corrupt_file:
                raise Exception(f"Corrupted file in ZIP: {corrupt_file}")
            
            print("[OK] ZIP integrity validated")
            print(f"Extracting to: {extract_dir}")
            
            # Extract
            zip_ref.extractall(extract_dir)
            
            print(f"[OK] Extracted {len(zip_ref.namelist())} files")
            
    except zipfile.BadZipFile as e:
        raise Exception(f"Invalid ZIP file: {e}")
    except Exception as e:
        raise Exception(f"ZIP validation/extraction failed: {e}")

def verify_exe_copy(src, dest):
    """Verify exe was copied correctly by comparing sizes"""
    if not os.path.exists(src):
        raise Exception(f"Source exe not found: {src}")
    if not os.path.exists(dest):
        raise Exception(f"Destination exe not found: {dest}")
    
    src_size = os.path.getsize(src)
    dest_size = os.path.getsize(dest)
    
    if src_size != dest_size:
        raise Exception(f"Size mismatch: src={src_size}, dest={dest_size}")
    
    print(f"[OK] Exe copy verified: {dest_size} bytes")
    return True

def rollback_and_restart(exe_path, old_exe):
    """Rollback to previous version and restart with --update-failed flag"""
    print("\n" + "="*60)
    print("ROLLBACK TRIGGERED")
    print("="*60)
    
    try:
        if os.path.exists(old_exe):
            print(f"Restoring previous version: {old_exe} → {exe_path}")
            
            # Remove failed new exe if exists
            if os.path.exists(exe_path):
                try:
                    os.remove(exe_path)
                except:
                    pass
            
            # Restore old exe
            shutil.copy2(old_exe, exe_path)
            print("[OK] Previous version restored")
            
            # Launch with failure flag
            print(f"Restarting with --update-failed flag...")
            subprocess.Popen([exe_path, "--update-failed"], 
                           cwd=os.path.dirname(exe_path),
                           creationflags=0x00000008 if os.name == 'nt' else 0)  # DETACHED_PROCESS
            print("[OK] Rollback complete")
        else:
            print(f"[ERROR] Cannot rollback - old exe not found: {old_exe}")
    except Exception as e:
        print(f"[ERROR] Rollback failed: {e}")
        print("Please manually restore from .old file or reinstall")

def update_from_release(repo, version, exe_dir, exe_path):
    """Update from GitHub release (compiled exe mode)"""
    print("="*60)
    print("UPDATE MODE: Release (Compiled Executable)")
    print("="*60)
    print(f"Repository: {repo}")
    print(f"Version: {version}")
    print(f"Exe directory: {exe_dir}")
    print(f"Exe path: {exe_path}")
    print("")
    
    # Paths
    zip_name = f"PoB_Injector_Release_v{version}.zip"
    zip_url = f"https://github.com/{repo}/releases/download/v{version}/{zip_name}"
    zip_path = os.path.join(exe_dir, "update.zip")
    extract_dir = os.path.join(exe_dir, "update_extracted")
    old_exe = exe_path + ".old"
    
    # Clean up previous update remnants
    for path in [zip_path, extract_dir]:
        if os.path.exists(path):
            try:
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)
            except:
                pass
    
    # Step 1: Wait for exe release
    print("\n[Step 1/8] Waiting for exe to be released...")
    if not wait_for_exe_release(exe_path):
        print("[WARNING] Exe may still be locked, attempting to proceed...")
    
    kill_port_5000()
    
    # Step 2: Download ZIP
    print(f"\n[Step 2/8] Downloading release ZIP...")
    if not download_with_retry(zip_url, zip_path):
        print("[FATAL] Download failed")
        rollback_and_restart(exe_path, old_exe)
        return False
    
    # Step 3: Validate and extract ZIP
    print(f"\n[Step 3/8] Validating and extracting ZIP...")
    try:
        extract_and_validate(zip_path, extract_dir)
    except Exception as e:
        print(f"[FATAL] {e}")
        rollback_and_restart(exe_path, old_exe)
        return False
    
    # Find extracted folder (should be "PoB-Injector")
    subdirs = [d for d in os.listdir(extract_dir) if os.path.isdir(os.path.join(extract_dir, d))]
    if not subdirs:
        print("[FATAL] No folder found in extracted ZIP")
        rollback_and_restart(exe_path, old_exe)
        return False
    
    source_root = os.path.join(extract_dir, subdirs[0])
    new_exe = os.path.join(source_root, "PoB-Injector.exe")
    
    if not os.path.exists(new_exe):
        print(f"[FATAL] PoB-Injector.exe not found in extracted ZIP: {new_exe}")
        rollback_and_restart(exe_path, old_exe)
        return False
    
    # Step 4: Atomic rename - backup current exe
    print(f"\n[Step 4/8] Creating backup...")
    try:
        if os.path.exists(old_exe):
            os.remove(old_exe)
        shutil.copy2(exe_path, old_exe)
        print(f"[OK] Backup created: {old_exe}")
    except Exception as e:
        print(f"[FATAL] Cannot create backup: {e}")
        return False
    
    # Step 5: Replace exe
    print(f"\n[Step 5/8] Replacing executable...")
    try:
        os.remove(exe_path)
        shutil.copy2(new_exe, exe_path)
        print(f"[OK] Exe replaced: {exe_path}")
    except Exception as e:
        print(f"[FATAL] Cannot replace exe: {e}")
        rollback_and_restart(exe_path, old_exe)
        return False
    
    # Step 6: Verify copy
    print(f"\n[Step 6/8] Verifying exe copy...")
    try:
        verify_exe_copy(new_exe, exe_path)
    except Exception as e:
        print(f"[FATAL] Verification failed: {e}")
        rollback_and_restart(exe_path, old_exe)
        return False
    
    # Step 7: Copy extension folder
    print(f"\n[Step 7/8] Updating extension...")
    try:
        source_ext = os.path.join(source_root, "extension")
        dest_ext = os.path.join(exe_dir, "extension")
        
        if os.path.exists(source_ext):
            if os.path.exists(dest_ext):
                shutil.rmtree(dest_ext)
            shutil.copytree(source_ext, dest_ext)
            print(f"[OK] Extension updated")
        else:
            print("[WARNING] Extension folder not found in release")
    except Exception as e:
        print(f"[WARNING] Extension update failed: {e}")
        # Non-fatal, continue
    
    # Step 8: Cleanup
    print(f"\n[Step 8/8] Cleaning up...")
    try:
        os.remove(zip_path)
        shutil.rmtree(extract_dir)
        print("[OK] Cleanup complete")
    except Exception as e:
        print(f"[WARNING] Cleanup failed: {e}")
    
    print("\n" + "="*60)
    print("UPDATE COMPLETED SUCCESSFULLY")
    print("="*60)
    print(f"Version: {version}")
    print(f"Old backup: {old_exe} (kept for 24h)")
    print("")
    
    # Step 9: Restart
    print("Restarting application with --updated flag...")
    try:
        subprocess.Popen([exe_path, "--updated"], 
                        cwd=exe_dir,
                        creationflags=0x00000008 if os.name == 'nt' else 0)  # DETACHED_PROCESS
        print("[OK] Application restarted")
    except Exception as e:
        print(f"[ERROR] Failed to restart: {e}")
        print("Please start the application manually")
    
    return True

def update_from_source(repo, branch, repo_root):
    """Update from GitHub source code (dev mode)"""
    print("="*60)
    print("UPDATE MODE: Source Code (Development)")
    print("="*60)
    print(f"Repository: {repo}")
    print(f"Branch: {branch}")
    print(f"Repo root: {repo_root}")
    print("")
    
    here = os.path.join(repo_root, "server")
    zip_url = f"https://github.com/{repo}/archive/refs/heads/{branch}.zip"
    zip_path = os.path.join(here, "update.zip")
    extract_dir = os.path.join(here, "update_extracted")
    
    print(f"Downloading source from: {zip_url}")
    
    if not download_with_retry(zip_url, zip_path):
        print("[FATAL] Download failed")
        return False
    
    try:
        extract_and_validate(zip_path, extract_dir)
    except Exception as e:
        print(f"[FATAL] {e}")
        return False
    
    subdirs = os.listdir(extract_dir)
    if not subdirs:
        print("[FATAL] Empty extracted folder")
        return False
    
    source_root = os.path.join(extract_dir, subdirs[0])
    
    print("Replacing files...")
    for item in os.listdir(source_root):
        s = os.path.join(source_root, item)
        d = os.path.join(repo_root, item)
        
        # Don't overwrite .git, scratch, .venv, .env
        if item in [".git", "scratch", ".venv", ".env"]:
            continue
        
        if item == "server" and os.path.isdir(d):
            # Merge server folder without deleting .env and .venv
            for sub_item in os.listdir(s):
                if sub_item in [".env", ".venv"]:
                    continue
                s_sub = os.path.join(s, sub_item)
                d_sub = os.path.join(d, sub_item)
                if os.path.isdir(s_sub):
                    shutil.copytree(s_sub, d_sub, dirs_exist_ok=True)
                else:
                    shutil.copy2(s_sub, d_sub)
        elif os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        else:
            shutil.copy2(s, d)
    
    print("Cleaning up...")
    try:
        os.remove(zip_path)
        shutil.rmtree(extract_dir)
    except:
        pass
    
    print("Installing dependencies...")
    subprocess.run([sys.executable, "-m", "pip", "install", "-r", 
                   os.path.join(here, "requirements.txt")])
    
    print("\n" + "="*60)
    print("UPDATE COMPLETED SUCCESSFULLY (DEV MODE)")
    print("="*60)
    
    print("Restarting server...")
    run_bat = os.path.join(repo_root, "start.bat")
    subprocess.Popen(["cmd.exe", "/c", run_bat], cwd=repo_root, 
                    creationflags=0x00000010 if os.name == 'nt' else 0)
    
    return True

def main():
    # Determine paths based on mode
    if getattr(sys, 'frozen', False):
        # Compiled exe mode
        exe_path = sys.executable
        exe_dir = os.path.dirname(exe_path)
        log_path = os.path.join(exe_dir, "updater.log")
        is_compiled = True
    else:
        # Dev mode
        here = os.path.abspath(os.path.dirname(__file__))
        repo_root = os.path.abspath(os.path.join(here, ".."))
        log_path = os.path.join(here, "updater.log")
        is_compiled = False
    
    # Setup logging
    log_file = setup_logging(log_path)
    
    print("="*60)
    print("PoB Injector Updater")
    print("="*60)
    print(f"Mode: {'Compiled' if is_compiled else 'Development'}")
    print(f"Log: {log_path}")
    print("")
    
    # Parse arguments
    if len(sys.argv) < 2:
        print("[ERROR] Usage: updater.py <repo> <version_or_branch>")
        print("Example (release): updater.py rauldzmartin/PoB-Injector 0.6.27-beta")
        print("Example (source): updater.py rauldzmartin/PoB-Injector dev")
        return
    
    repo = sys.argv[1]
    version_or_branch = sys.argv[2] if len(sys.argv) > 2 else "main"
    
    print(f"Arguments: repo={repo}, version_or_branch={version_or_branch}")
    print("")
    
    # Wait for server shutdown
    print("Waiting for server to shut down...")
    time.sleep(3)
    
    # Route to appropriate update method
    try:
        if is_compiled:
            # Compiled mode: use release
            success = update_from_release(repo, version_or_branch, exe_dir, exe_path)
        else:
            # Dev mode: use source
            success = update_from_source(repo, version_or_branch, repo_root)
        
        if success:
            print("\nUpdater finished successfully")
        else:
            print("\nUpdater finished with errors")
    except Exception as e:
        print(f"\n[FATAL] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        
        if is_compiled:
            rollback_and_restart(exe_path, exe_path + ".old")
    
    # Close log
    try:
        log_file.close()
    except:
        pass
    
    # Keep window open for 5 seconds in case of error
    if not success:
        print("\nClosing in 5 seconds...")
        time.sleep(5)

if __name__ == "__main__":
    main()
