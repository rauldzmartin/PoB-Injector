from __future__ import annotations
import base64, os, threading, sys, re
from typing import Optional, List, Dict
from functools import lru_cache

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from dotenv import load_dotenv
if getattr(sys, 'frozen', False):
    load_dotenv(os.path.join(os.path.dirname(sys.executable), ".env"))
else:
    load_dotenv()

import ctypes
if "POB_CONSOLE_TITLE" in os.environ:
    ctypes.windll.kernel32.SetConsoleTitleW(os.environ["POB_CONSOLE_TITLE"])

POB_INSTALL_ENV = os.getenv("POB_INSTALL")

def _find_pob_install() -> str:
    # 1. Check from .env
    if POB_INSTALL_ENV and os.path.exists(os.path.join(POB_INSTALL_ENV, "Launch.lua")):
        return POB_INSTALL_ENV

    # 2. Check if PoB is running
    try:
        import win32com.client
        wmi = win32com.client.GetObject('winmgmts:')
        for p in wmi.InstancesOf('win32_process'):
            if p.Name and p.Name.lower() == 'path of building.exe':
                if p.ExecutablePath:
                    pob_dir = os.path.dirname(p.ExecutablePath)
                    if os.path.exists(os.path.join(pob_dir, "Launch.lua")):
                        return pob_dir
    except Exception as e:
        print(f"Error checking WMI for running PoB: {e}")

    # 3. Check common locations
    common = [
        r"C:\ProgramData\Path of Building Community",
        os.path.expandvars(r"%APPDATA%\Path of Building Community"),
        os.path.expandvars(r"%APPDATA%\Path of Building Community (PoE2)"),
        os.path.expandvars(r"%PROGRAMDATA%\Path of Building Community"),
        os.path.expandvars(r"%LOCALAPPDATA%\Path of Building Community"),
        os.path.expandvars(r"%USERPROFILE%\Desktop\Path of Building Community")
    ]
    for p in common:
        if os.path.exists(os.path.join(p, "Launch.lua")):
            return p

    # Fallback - If we reached here, no valid path was found.
    # If there was an invalid path in .env, ignore it.
    if getattr(sys, 'frozen', False):
        import tkinter as tk
        from tkinter import filedialog, messagebox
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        messagebox.showinfo("PoB Injector", "Could not automatically locate Path of Building.\nPlease select the folder where 'Path of Building Community' is installed.")
        folder = filedialog.askdirectory(title="Select Path of Building folder")
        if folder and os.path.exists(os.path.join(folder, "Launch.lua")):
            env_path = os.path.join(os.path.dirname(sys.executable), ".env")
            try:
                with open(env_path, "w") as f:
                    f.write(f'POB_INSTALL="{folder}"\n')
            except:
                pass
            return folder
        else:
            messagebox.showerror("Error", "The selected folder does not appear to contain Path of Building. The injector will now close.")
            sys.exit(1)
    return ""

POB_INSTALL = _find_pob_install()
POB_PATH    = os.getenv("POB_PATH", POB_INSTALL)
MOD_RUNES_PATH = os.getenv("MOD_RUNES_PATH", os.path.join(POB_INSTALL, r"Data\ModRunes.lua"))
MOD_ENCHANTS_PATH = os.getenv("MOD_ENCHANTS_PATH", os.path.join(POB_INSTALL, r"Data\QueryMods.lua"))

USER_POB_WRAPPER = os.getenv("USER_POB_WRAPPER")
if USER_POB_WRAPPER and USER_POB_WRAPPER not in sys.path:
    sys.path.insert(0, USER_POB_WRAPPER)

HERE = os.path.abspath(os.path.dirname(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, ".."))
PY_SRC = os.path.join(HERE, "pob_wrapper")

if os.path.exists(PY_SRC) and HERE not in sys.path:
    sys.path.insert(0, HERE)

try:
    from pob_wrapper import PathOfBuilding, ExternalError  # type: ignore
    _import_error = None
except Exception as e:
    PathOfBuilding = None  # type: ignore
    ExternalError = Exception  # type: ignore
    _import_error = e

app = FastAPI(
    title="PoB Injector Server",
    description="Servidor local para PoB Injector que interacciona con Path of Building de forma headless.",
    version="0.6.13",
)

import logging

class AccessFormatter(logging.Formatter):
    def format(self, record):
        if len(record.args) == 5:
            record.msg = '"%s %s HTTP/%s" %d'
            record.args = (record.args[1], record.args[2], record.args[3], record.args[4])
        return super().format(record)

def setup_logging():
    formatter = logging.Formatter(f"[v{app.version}] %(asctime)s - %(levelname)s - %(message)s", datefmt="%H:%M:%S")
    acc_formatter = AccessFormatter(f"[v{app.version}] %(asctime)s - %(levelname)s - %(message)s", datefmt="%H:%M:%S")
    
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logger = logging.getLogger(name)
        for handler in logger.handlers:
            if name == "uvicorn.access":
                handler.setFormatter(acc_formatter)
            else:
                handler.setFormatter(formatter)

@app.on_event("startup")
async def startup_event():
    setup_logging()
    print(f"\n======================================")
    print(f"  PoB Injector Server v{app.version}")
    print(f"======================================\n")
    logger = logging.getLogger("uvicorn")
    logger.info(f"PoB Installation path: {POB_INSTALL}")
    try:
        pob = _ensure_pob()
        builds_path = pob.get_builds_dir()
        if builds_path and not os.path.isabs(builds_path):
            builds_path = os.path.join(POB_INSTALL, builds_path)
        logger.info(f"PoB Builds path: {os.path.normpath(builds_path)}")
    except Exception as e:
        logger.info(f"PoB Builds path: (Unable to determine: {e})")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_pob = None
_lock = threading.Lock()

class LoadReq(BaseModel):
    path: Optional[str] = None

class ImpactReq(BaseModel):
    item: Optional[str] = None
    maxQuality: Optional[bool] = False

def _ensure_pob():
    global _pob
    if _import_error:
        raise HTTPException(status_code=500, detail=f"Failed to import pob_wrapper: {_import_error}")
    
    if _pob is not None:
        try:
            if _pob.pob.process.poll() is not None:
                print("PoB subprocess died, restarting...")
                _pob = None
        except Exception:
            _pob = None
            
    if _pob is None:
        _pob = PathOfBuilding(pob_path=POB_PATH, pob_install=POB_INSTALL, verbose=True)  # type: ignore
    return _pob

def _try_b64(s: str) -> str:
    try:
        dec = base64.b64decode(s).decode("utf-8")
        if dec.count("\x00") > 0:
            return s
        return dec
    except Exception:
        return s

@app.get("/status")
def status():
    return {"running": _pob is not None, "import_error": str(_import_error) if _import_error else None}

GITHUB_REPO = os.getenv("GITHUB_REPO", "rauldzmartin/PoB-Injector")

@app.get("/check-update")
def check_update(branch: str = "main"):
    try:
        import urllib.request, json, time
        timestamp = int(time.time())
        url = f"https://raw.githubusercontent.com/{GITHUB_REPO}/{branch}/extension/manifest.json?t={timestamp}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            if resp.status == 200:
                remote_manifest = json.loads(resp.read().decode('utf-8'))
                remote_version = remote_manifest.get("version_name", "")
                
                local_manifest_path = os.path.join(REPO_ROOT, "extension", "manifest.json")
                local_version = ""
                if os.path.exists(local_manifest_path):
                    with open(local_manifest_path, "r", encoding="utf-8") as f:
                        local_manifest = json.load(f)
                        local_version = local_manifest.get("version_name", "")
                        
                if remote_version and local_version and remote_version != local_version:
                    return {"update_available": True, "remote_version": remote_version, "local_version": local_version}
                return {"update_available": False, "remote_version": remote_version, "local_version": local_version}
            return {"update_available": False, "error": f"HTTP {resp.status}"}
    except Exception as e:
        return {"update_available": False, "error": str(e)}

@app.post("/update")
def update(branch: str = "main", version: str = ""):
    import subprocess
    updater_path = os.path.join(HERE, "updater.py")
    
    python_exe = sys.executable
    if "uvicorn" in python_exe.lower():
        python_exe = os.path.join(os.path.dirname(python_exe), "python.exe")
        if not os.path.exists(python_exe):
            python_exe = "python"
            
    # Spawn updater in a new console so it survives
    CREATE_NO_WINDOW = 0x08000000
    subprocess.Popen([python_exe, updater_path, "rauldzmartin/PoB-Injector", branch, version], 
                     cwd=HERE, 
                     creationflags=CREATE_NO_WINDOW,
                     stdin=subprocess.DEVNULL,
                     stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL)
    
    # Gracefully kill uvicorn
    def kill_me():
        import time
        time.sleep(1)
        os._exit(0)
    threading.Thread(target=kill_me).start()
    return {"status": "updating"}

def _get_active_build() -> str:
    possible_settings_paths = [os.path.join(POB_INSTALL, "Settings.xml")]
    builds_dir = ""
    
    try:
        pob = _ensure_pob()
        b_dir = pob.get_builds_dir()
        if b_dir and not os.path.isabs(b_dir):
            b_dir = os.path.normpath(os.path.join(POB_INSTALL, b_dir))
        builds_dir = b_dir
        if builds_dir:
            possible_settings_paths.insert(0, os.path.join(os.path.dirname(builds_dir), "Settings.xml"))
    except Exception:
        builds_dir = os.path.join(POB_INSTALL, "Builds")
        
    for settings_path in possible_settings_paths:
        if os.path.exists(settings_path):
            try:
                import xml.etree.ElementTree as ET
                tree = ET.parse(settings_path)
                root = tree.getroot()
                mode = root.find("./Mode[@mode='BUILD']")
                if mode is not None:
                    for arg in mode.findall("./Arg"):
                        if 'string' in arg.attrib:
                            build_path = arg.attrib['string']
                            if not os.path.isabs(build_path):
                                build_path = os.path.join(builds_dir, build_path)
                            if not build_path.endswith(".xml"):
                                build_path += ".xml"
                            if os.path.exists(build_path):
                                return build_path
            except Exception as e:
                print(f"Error parsing Settings.xml at {settings_path}: {e}")

    if builds_dir and os.path.exists(builds_dir):
        for root_dir, dirs, files in os.walk(builds_dir):
            for file in files:
                if file.lower().endswith(".xml"):
                    return os.path.join(root_dir, file)
                    
    return ""

_loaded_build_path = None
_loaded_build_mtime = 0

def _auto_reload_if_needed(pob):
    global _loaded_build_mtime, _loaded_build_path
    if _loaded_build_path and os.path.exists(_loaded_build_path):
        mtime = os.path.getmtime(_loaded_build_path)
        if mtime > _loaded_build_mtime:
            pob.load_build(_loaded_build_path)
            _loaded_build_mtime = mtime

@app.post("/load_pob")
def load_pob(req: LoadReq):
    global _loaded_build_path, _loaded_build_mtime
    with _lock:
        pob = _ensure_pob()
        build = (req.path or "").strip()
        if not build:
            build = _get_active_build()
        else:
            build = _try_b64(build)
            if not os.path.isabs(build):
                b_dir = pob.get_builds_dir()
                if b_dir and not os.path.isabs(b_dir):
                    b_dir = os.path.join(POB_INSTALL, b_dir)
                build = os.path.join(b_dir, build)
                if not build.endswith(".xml"):
                    build += ".xml"
                    
        if not build:
            raise HTTPException(status_code=400, detail="No active build found in PoB, and no build path was provided.")
            
        try:
            pob.load_build(build)
            _loaded_build_path = build
            if os.path.exists(build):
                _loaded_build_mtime = os.path.getmtime(build)
        except ExternalError as e:  # type: ignore
            raise HTTPException(status_code=500, detail=f"PoB error: {getattr(e,'status',e)}")
    return {"status": "ok"}

@app.get("/builds")
def list_builds():
    try:
        with _lock:
            pob = _ensure_pob()
            builds_dir = pob.get_builds_dir()
    except Exception:
        builds_dir = "Builds"
        
    if builds_dir and not os.path.isabs(builds_dir):
        builds_dir = os.path.join(POB_INSTALL, builds_dir)
        
    if not os.path.exists(builds_dir):
        return []
    
    found = []
    for root, dirs, files in os.walk(builds_dir):
        for file in files:
            if file.lower().endswith(".xml"):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, builds_dir)
                rel_path_no_ext = os.path.splitext(rel_path)[0]
                rel_path_no_ext = rel_path_no_ext.replace("\\", "/")
                basename = os.path.splitext(file)[0]
                found.append({
                    "path": rel_path_no_ext,
                    "name": basename
                })
    # Sort alphabetically by path
    found.sort(key=lambda x: x["path"].lower())
    return found

@app.post("/item-impact")
def item_impact(req: ImpactReq):
    if req.item is None or not isinstance(req.item, str) or not req.item.strip() or req.item.strip().lower() == "null":
        raise HTTPException(status_code=400, detail="Empty or invalid item text")
    with _lock:
        pob = _ensure_pob()
        _auto_reload_if_needed(pob)
        try:
            res = pob.test_item_as_html(req.item, req.maxQuality)
            html = res.get("html", "")
            unsupported = res.get("unsupported", [])
            if html:
                html = re.sub(r'(?:<br>)?\s*(?:\^x[0-9A-Fa-f]{6})?Tip: Press Ctrl\+D to disable the display of stat differences\.?', '', html, flags=re.IGNORECASE)
                html = re.sub(r'(?:<br>)+$', '', html.strip())
        except ExternalError as e:  # type: ignore
            raise HTTPException(status_code=500, detail=f"PoB error: {getattr(e,'status',e)}")
    if not html:
        return {"html": "", "unsupported": []}
    return {"html": html, "unsupported": unsupported}

@app.post("/import-item")
def import_item(req: ImpactReq):
    if req.item is None or not isinstance(req.item, str) or not req.item.strip() or req.item.strip().lower() == "null":
        raise HTTPException(status_code=400, detail="Empty or invalid item text")
    with _lock:
        pob = _ensure_pob()
        try:
            result = pob.import_item(req.item, req.maxQuality)
            if result != "Success":
                raise HTTPException(status_code=500, detail=str(result))
        except ExternalError as e:  # type: ignore
            raise HTTPException(status_code=500, detail=f"PoB error: {getattr(e,'status',e)}")
    return {"status": "ok"}

@lru_cache
def _load_runes_table():
    slots = set(["weapon","bow","caster","armour","helmet","gloves","boots","sceptre","shield","focus","body armour"])
    table = {s: set() for s in slots}
    try:
        with open(MOD_RUNES_PATH, "r", encoding="utf-8", errors="ignore") as f:
            txt = f.read()
    except Exception as e:
        return {"_error": {str(e)}}

    depth = 0
    current_slot = None
    for raw in txt.splitlines():
        line = raw.strip()
        opens = line.count("{")
        closes = line.count("}")
        m = re.match(r'\[\s*"([^"]+)"\s*\]\s*=\s*{\s*$', line)
        if m and depth >= 1:
            key = m.group(1).strip().lower()
            current_slot = key if key in slots else None
            depth += 1
            continue
        if current_slot and 'type' not in line:
            s = re.match(r'"([^"]+)"\s*,?\s*$', line)
            if s:
                table[current_slot].add(s.group(1))
        depth += opens - closes
        if depth < 0:
            depth = 0
        if depth == 1:
            current_slot = None
    return table

def _collect_runes(slot: Optional[str]):
    tbl = _load_runes_table()
    if "_error" in tbl:
        raise HTTPException(status_code=500, detail=f"Rune file error: {next(iter(tbl['_error']))}")
    if not slot:
        return {k: sorted(v) for k, v in tbl.items() if v}
    req = [s.strip().lower() for s in slot.split(",") if s.strip()]
    out = set()
    for s in req:
        out |= set(tbl.get(s, set()))
    return sorted(out)

@app.get("/runes")
def runes(slot: Optional[str] = None):
    return _collect_runes(slot)


@lru_cache(maxsize=1)
def _load_amulet_enchants() -> List[Dict[str, str]]:
    """Parse QueryMods.lua and collect 'tradeMod' entries where type == "enchant"."""
    path = MOD_ENCHANTS_PATH  # this is already defined in your file
    out: List[Dict[str, str]] = []

    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            data = f.read()

        # Matches:
        #   ["tradeMod"] = {
        #       ["id"] = "…",
        #       ["text"] = "…",
        #       ["type"] = "enchant",
        #       ...
        #   }
        pat = re.compile(
            r'\["tradeMod"\]\s*=\s*{'
            r'(?:(?!}).)*?\["id"\]\s*=\s*"([^"]+)"'
            r'(?:(?!}).)*?\["text"\]\s*=\s*"([^"]+)"'
            r'(?:(?!}).)*?\["type"\]\s*=\s*"enchant"'
            r'(?:(?!}).)*?}',
            re.S
        )

        for _id, _text in pat.findall(data):
            # Only keep the amulet-appropriate "Allocates …" enchants
            if not _text.startswith("Allocates "):
                continue
            out.append({"id": _id, "text": _text})

        out.sort(key=lambda d: d["text"])
        return out

    except Exception as e:
        # surface a clear message to the API caller
        raise RuntimeError(f"Failed to load amulet enchants from {path}: {type(e).__name__}: {e}") from e


@app.get("/amulet-enchants")
def amulet_enchants(q: Optional[str] = None, limit: int = 25):
    """
    Searchable list of amulet enchants from QueryMods.lua.
    - `q`: optional case-insensitive substring filter
    - `limit`: max items returned (default 25)
    """
    try:
        items = _load_amulet_enchants()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if q:
        qs = q.strip().lower()
        if qs:
            items = [d for d in items if qs in d["text"].lower()]

    if limit and limit > 0:
        items = items[: int(limit)]

    return items
