import os, sys, time, subprocess, threading
import pystray
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)
ICON_PATH = os.path.join(REPO_ROOT, "extension", "img", "icon.png")

server_process = None
viewer_process = None
log_file = None

def get_python_exe():
    python_exe = sys.executable
    if "pythonw" in python_exe.lower() or "uvicorn" in python_exe.lower():
        python_exe = os.path.join(os.path.dirname(python_exe), "python.exe")
    return python_exe

def start_server():
    global server_process, log_file
    
    python_exe = get_python_exe()
    log_path = os.path.join(HERE, "server.log")
    
    # We must keep the file handle open so stdout can write to it
    log_file = open(log_path, "w", encoding="utf-8")
    
    CREATE_NO_WINDOW = 0x08000000
    server_process = subprocess.Popen(
        [python_exe, "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "5000"],
        cwd=HERE, 
        creationflags=CREATE_NO_WINDOW,
        stdout=log_file,
        stderr=subprocess.STDOUT
    )

def monitor_server(icon):
    if server_process:
        server_process.wait()
    icon.stop()
    os._exit(0)

def toggle_console(icon, item):
    global viewer_process
    if viewer_process and viewer_process.poll() is None:
        viewer_process.kill()
        viewer_process = None
    else:
        python_exe = get_python_exe()
        pythonw_exe = python_exe.replace("python.exe", "pythonw.exe")
        if not os.path.exists(pythonw_exe):
            pythonw_exe = python_exe
            
        viewer_path = os.path.join(HERE, "log_viewer.py")
        viewer_process = subprocess.Popen([pythonw_exe, viewer_path], cwd=HERE)

current_channel = "dev"

def set_channel(channel):
    def inner(icon, item):
        global current_channel
        current_channel = channel
    return inner

def is_channel(channel):
    def inner(item):
        return current_channel == channel
    return inner

def trigger_update(icon, item):
    import urllib.request
    try:
        req = urllib.request.Request(f"http://127.0.0.1:5000/update?branch={current_channel}", method="POST")
        urllib.request.urlopen(req)
    except Exception as e:
        print(f"Update failed: {e}")

def quit_app(icon, item):
    icon.stop()
    if viewer_process and viewer_process.poll() is None:
        viewer_process.kill()
    if server_process:
        server_process.kill()
    if log_file:
        try:
            log_file.close()
        except:
            pass
    os._exit(0)

def create_tray():
    image = Image.open(ICON_PATH)
    
    channel_menu = pystray.Menu(
        pystray.MenuItem("Stable", set_channel("main"), checked=is_channel("main"), radio=True),
        pystray.MenuItem("Beta", set_channel("dev"), checked=is_channel("dev"), radio=True)
    )
    
    menu = pystray.Menu(
        pystray.MenuItem("Toggle Console", toggle_console),
        pystray.MenuItem("Update", trigger_update),
        pystray.MenuItem("Update Channel", channel_menu),
        pystray.MenuItem("Quit", quit_app)
    )
    
    icon = pystray.Icon("PoB Injector", image, "PoB Injector Server", menu)
    
    threading.Thread(target=monitor_server, args=(icon,), daemon=True).start()
    icon.run()

if __name__ == "__main__":
    start_server()
    create_tray()
