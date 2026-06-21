import os, sys, time, subprocess, threading, json, webbrowser, logging
import pystray
from PIL import Image

if getattr(sys, 'frozen', False):
    HERE = sys._MEIPASS
    REPO_ROOT = HERE
else:
    HERE = os.path.dirname(os.path.abspath(__file__))
    REPO_ROOT = os.path.dirname(HERE)

ICON_PATH = os.path.join(REPO_ROOT, "extension", "img", "icon.png")
GITHUB_REPO = "rauldzmartin/PoB-Injector"

server_process = None
viewer_process = None
log_file = None

def _get_exe_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return HERE

# Configure updater logging to file
_updater_log_path = os.path.join(_get_exe_dir(), "updater.log")
logging.basicConfig(
    filename=_updater_log_path,
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

def get_current_version():
    """Read current version from manifest.json"""
    try:
        manifest_path = os.path.join(REPO_ROOT, "extension", "manifest.json")
        if os.path.exists(manifest_path):
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
                return manifest.get("version_name", "unknown")
    except:
        pass
    return "unknown"

import ctypes
try:
    ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("PoB Injector")
except:
    pass

import multiprocessing

def get_python_exe():
    python_exe = sys.executable
    if "pythonw" in python_exe.lower() or "uvicorn" in python_exe.lower():
        python_exe = os.path.join(os.path.dirname(python_exe), "python.exe")
    return python_exe

def start_server():
    global log_file
    
    if getattr(sys, 'frozen', False):
        log_path = os.path.join(os.path.dirname(sys.executable), "PoB-Injector.log")
    else:
        log_path = os.path.join(HERE, "PoB-Injector.log")
    
    # We must keep the file handle open so stdout can write to it if needed
    log_file = open(log_path, "w", encoding="utf-8")
    sys.stdout = log_file
    sys.stderr = log_file
    
    import uvicorn
    from app import app as fastapi_app
    
    config = uvicorn.Config(fastapi_app, host="127.0.0.1", port=5000, log_level="info")
    server = uvicorn.Server(config)
    threading.Thread(target=server.run, daemon=True).start()

def cleanup_and_exit(icon=None):
    if icon:
        icon.stop()
    if viewer_process and viewer_process.is_alive():
        viewer_process.terminate()
    if log_file:
        try:
            log_file.close()
        except:
            pass
    os._exit(0)

def monitor_server(icon):
    time.sleep(1)
    icon.notify("Server started successfully.", "PoB Injector")
    # In PyInstaller mode, Uvicorn runs in a thread. 
    # If the user wants to close the app, they use the tray menu.
    # We no longer wait for a separate process to die.
    while True:
        time.sleep(1)

def run_viewer(target_log):
    import log_viewer
    log_viewer.main(target_log)

def toggle_console(icon, item):
    global viewer_process
    if viewer_process and viewer_process.is_alive():
        viewer_process.terminate()
        viewer_process = None
    else:
        if getattr(sys, 'frozen', False):
            log_path = os.path.join(os.path.dirname(sys.executable), "PoB-Injector.log")
        else:
            log_path = os.path.join(HERE, "PoB-Injector.log")
        viewer_process = multiprocessing.Process(target=run_viewer, args=(log_path,))
        viewer_process.start()

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
    """Check for update, download to pending/, and notify user."""
    import urllib.request
    try:
        req = urllib.request.Request(f"http://127.0.0.1:5000/check-update?branch={current_channel}")
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())

        if not data.get("update_available"):
            icon.notify("You already have the latest version installed.", "PoB Injector")
            return

        latest = data.get("remote_version", "")
        icon.notify(f"Downloading v{latest}...", "PoB Injector")

        import updater
        exe_dir = _get_exe_dir()
        success = updater.download_update(GITHUB_REPO, latest, exe_dir)

        if success:
            icon.notify(f"v{latest} ready! Restart to install.", "PoB Injector")
        else:
            icon.notify("Download failed. Check updater.log.", "PoB Injector")
    except Exception as e:
        icon.notify(f"Update error: {e}", "PoB Injector")

def quit_app(icon, item):
    cleanup_and_exit(icon)

def view_release_notes(icon, item):
    """Open GitHub release page in browser"""
    version = get_current_version()
    url = f"https://github.com/{GITHUB_REPO}/releases/tag/v{version}"
    try:
        webbrowser.open(url)
    except Exception as e:
        icon.notify(f"Could not open browser: {e}", "Error")

def restart_and_update(icon, item):
    """Spawn a new instance (which will apply the pending update on startup), then exit."""
    import updater
    if updater.has_pending_update(_get_exe_dir()):
        icon.notify("Restarting to apply update...", "PoB Injector")
        time.sleep(1)
        # Fully detached child survives parent exit in PyInstaller --noconsole
        subprocess.Popen(
            [sys.executable],
            creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
        )
        cleanup_and_exit(icon)
    else:
        icon.notify("No pending update.", "PoB Injector")

def _has_pending(item):
    """Dynamic visibility: only show 'Restart & Update' when update is pending."""
    import updater
    return updater.has_pending_update(_get_exe_dir()) is not None

def _background_update_checker(icon):
    """Check for updates every 4 hours. Download silently if available."""
    import updater
    while True:
        time.sleep(4 * 3600)  # 4 hours
        try:
            import urllib.request
            req = urllib.request.Request(f"http://127.0.0.1:5000/check-update?branch={current_channel}")
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode())
            if data.get("update_available"):
                latest = data.get("remote_version", "")
                exe_dir = _get_exe_dir()
                if not updater.has_pending_update(exe_dir):
                    success = updater.download_update(GITHUB_REPO, latest, exe_dir)
                    if success:
                        icon.notify(f"v{latest} ready! Restart to install.", "PoB Injector")
        except Exception:
            pass  # Silent fail for background checks

def create_tray():
    image = Image.open(ICON_PATH)

    channel_menu = pystray.Menu(
        pystray.MenuItem("Stable", set_channel("main"), checked=is_channel("main"), radio=True),
        pystray.MenuItem("Beta", set_channel("dev"), checked=is_channel("dev"), radio=True)
    )

    menu = pystray.Menu(
        pystray.MenuItem("Toggle console", toggle_console, default=True),
        pystray.MenuItem("Check for Updates", trigger_update),
        pystray.MenuItem("Restart && Update", restart_and_update, visible=_has_pending),
        pystray.MenuItem("Update channel", channel_menu),
        pystray.MenuItem("View Release Notes", view_release_notes),
        pystray.MenuItem("Quit", quit_app)
    )

    icon = pystray.Icon("PoB Injector", image, "PoB Injector Server", menu)

    # Post-update notification
    if "--updated" in sys.argv:
        def show_update_notif():
            time.sleep(2)
            version = get_current_version()
            icon.notify(f"Updated successfully to v{version}!", "Update Complete")
        threading.Thread(target=show_update_notif, daemon=True).start()
    elif "--update-failed" in sys.argv:
        def show_fail_notif():
            time.sleep(2)
            icon.notify("Update failed. Running previous version. Check updater.log.", "Update Failed")
        threading.Thread(target=show_fail_notif, daemon=True).start()

    threading.Thread(target=monitor_server, args=(icon,), daemon=True).start()
    threading.Thread(target=_background_update_checker, args=(icon,), daemon=True).start()
    icon.run()

if __name__ == "__main__":
    multiprocessing.freeze_support()

    # --- Phase 1: Apply pending update (before anything else) ---
    exe_dir = _get_exe_dir()

    if getattr(sys, 'frozen', False) and "--updated" not in sys.argv:
        import updater
        if updater.apply_pending_update(exe_dir):
            # Fully detached child survives parent exit in PyInstaller --noconsole
            subprocess.Popen(
                [sys.executable, "--updated"],
                creationflags=subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP,
            )
            os._exit(0)

    # Clean up old exe backup (older than 24h)
    if getattr(sys, 'frozen', False):
        old_exe = sys.executable + ".old"
        if os.path.exists(old_exe):
            try:
                age = time.time() - os.path.getmtime(old_exe)
                if age > 24 * 3600:
                    os.remove(old_exe)
            except Exception:
                pass

    start_server()
    create_tray()
