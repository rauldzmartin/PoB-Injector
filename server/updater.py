import sys, os, time, urllib.request, zipfile, shutil, subprocess

def main():
    repo = sys.argv[1] if len(sys.argv) > 1 else "rauldzmartin/PoB-Injector"
    here = os.path.abspath(os.path.dirname(__file__))
    repo_root = os.path.abspath(os.path.join(here, ".."))
    
    print("Waiting for server to shut down...")
    time.sleep(3)
    
    zip_url = f"https://github.com/{repo}/archive/refs/heads/main.zip"
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
    subprocess.run([sys.executable, "-m", "pip", "install", "-r", os.path.join(here, "requirements.txt")])
    
    print("Restarting server...")
    run_bat = os.path.join(repo_root, "start.bat")
    subprocess.Popen(["cmd.exe", "/c", run_bat], cwd=repo_root, creationflags=subprocess.CREATE_NEW_CONSOLE)

if __name__ == "__main__":
    main()
