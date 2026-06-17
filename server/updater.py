import sys, os, time, urllib.request, zipfile, shutil, subprocess

def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else "rauldzmartin/PoB-Injector"
    branch = sys.argv[2] if len(sys.argv) > 2 else "main"
    here = os.path.abspath(os.path.dirname(__file__))
    repo_root = os.path.abspath(os.path.join(here, ".."))
    
    print("Waiting for server to shut down...")
    time.sleep(3)
    
    # Append timestamp to bypass GitHub's aggressive zip cache (5 minutes)
    timestamp = int(time.time())
    zip_url = f"https://github.com/{repo}/archive/refs/heads/{branch}.zip?t={timestamp}"
    zip_path = os.path.join(here, "update.zip")
    
    print(f"Downloading update from {zip_url}...")
    try:
        # Add headers to avoid 403
        req = urllib.request.Request(zip_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response, open(zip_path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
    except Exception as e:
        print(f"Error downloading: {e}")
        time.sleep(5)
        return

    print("Extracting update...")
    extract_dir = os.path.join(here, "update_extracted")
    if os.path.exists(extract_dir):
        shutil.rmtree(extract_dir)
    
    with zipfile.ZipFile(zip_path, 'r') as zip_ref:
        zip_ref.extractall(extract_dir)
        
    subdirs = os.listdir(extract_dir)
    if not subdirs:
        return
    source_root = os.path.join(extract_dir, subdirs[0])
    
    try:
        import subprocess
        # Kill whatever is listening on port 5000
        out = subprocess.check_output('netstat -aon | findstr ":5000" | findstr "LISTENING"', shell=True, creationflags=0x08000000)
        for line in out.decode().splitlines():
            parts = line.strip().split()
            if len(parts) >= 5:
                pid = parts[-1]
                subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True, creationflags=0x08000000)
    except:
        pass

    try:
        subprocess.run("taskkill /F /IM luajit.exe", shell=True, capture_output=True, creationflags=0x08000000)
    except:
        pass
    
    print("Replacing files...")
    for item in os.listdir(source_root):
        s = os.path.join(source_root, item)
        d = os.path.join(repo_root, item)
        
        # Don't overwrite .git folder or scratch
        if item in [".git", "scratch"]:
            continue
            
        if item == "server" and os.path.isdir(d):
            # Merge server folder without deleting .env and .venv
            for sub_item in os.listdir(s):
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
    subprocess.run([sys.executable, "-m", "pip", "install", "-r", os.path.join(here, "requirements.txt")], creationflags=0x08000000)
    
    print("Restarting server...")
    run_vbs = os.path.join(repo_root, "start.vbs")
    subprocess.Popen(["wscript.exe", run_vbs], cwd=repo_root, creationflags=0x08000000)

if __name__ == "__main__":
    here = os.path.dirname(os.path.abspath(__file__))
    log_file = open(os.path.join(here, "updater.log"), "w", encoding="utf-8")
    sys.stdout = log_file
    sys.stderr = log_file
    
    try:
        main()
    except Exception as e:
        import traceback, tkinter as tk, subprocess
        from tkinter import messagebox
        traceback.print_exc()
        log_file.close()
        
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        if messagebox.showerror("PoB Injector Updater", f"There was an error updating.\n\n{str(e)}\n\nDo you want to view the detailed logs?", type=messagebox.YESNO) == messagebox.YES:
            pythonw_exe = sys.executable.replace("python.exe", "pythonw.exe")
            if not os.path.exists(pythonw_exe):
                pythonw_exe = sys.executable
            subprocess.Popen([pythonw_exe, os.path.join(here, "log_viewer.py"), "updater.log"], cwd=here)
        sys.exit(1)
