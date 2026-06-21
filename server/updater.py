"""
PoB Injector Updater - Background download + apply-on-restart
Two public functions:
  - download_update(repo, version, dest_dir) -> bool
  - apply_pending_update(exe_dir) -> bool
"""
import os, sys, shutil, zipfile, logging

log = logging.getLogger("updater")

PENDING_DIR_NAME = "pending"
PENDING_ZIP_NAME = "update.zip"
PENDING_VERSION_FILE = "version.txt"


def _get_pending_dir(exe_dir: str) -> str:
    return os.path.join(exe_dir, PENDING_DIR_NAME)


def _get_zip_url(repo: str, version: str) -> str:
    return f"https://github.com/{repo}/releases/download/v{version}/PoB_Injector_Release_v{version}.zip"


def download_update(repo: str, version: str, exe_dir: str) -> bool:
    """Download a release ZIP into exe_dir/pending/. Returns True on success."""
    import requests

    pending = _get_pending_dir(exe_dir)
    os.makedirs(pending, exist_ok=True)
    zip_path = os.path.join(pending, PENDING_ZIP_NAME)
    version_path = os.path.join(pending, PENDING_VERSION_FILE)

    url = _get_zip_url(repo, version)
    log.info("Downloading %s", url)

    try:
        resp = requests.get(url, timeout=120, stream=True)
        resp.raise_for_status()

        with open(zip_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=65536):
                f.write(chunk)

        # Validate ZIP integrity
        with zipfile.ZipFile(zip_path, "r") as zf:
            bad = zf.testzip()
            if bad:
                log.error("Corrupt file in ZIP: %s", bad)
                shutil.rmtree(pending, ignore_errors=True)
                return False

        # Write version marker
        with open(version_path, "w", encoding="utf-8") as f:
            f.write(version)

        log.info("Download complete: %s", zip_path)
        return True

    except Exception as e:
        log.error("Download failed: %s", e)
        shutil.rmtree(pending, ignore_errors=True)
        return False


def has_pending_update(exe_dir: str) -> str | None:
    """Return pending version string, or None if no update is staged."""
    pending = _get_pending_dir(exe_dir)
    version_path = os.path.join(pending, PENDING_VERSION_FILE)
    zip_path = os.path.join(pending, PENDING_ZIP_NAME)
    if os.path.isfile(version_path) and os.path.isfile(zip_path):
        try:
            with open(version_path, "r", encoding="utf-8") as f:
                return f.read().strip()
        except Exception:
            pass
    return None


def apply_pending_update(exe_dir: str) -> bool:
    """
    Apply a previously downloaded update. Call BEFORE starting the server.
    Returns True if update was applied (caller should relaunch with --updated).
    Returns False if no pending update or if it failed.
    """
    pending = _get_pending_dir(exe_dir)
    zip_path = os.path.join(pending, PENDING_ZIP_NAME)
    version_path = os.path.join(pending, PENDING_VERSION_FILE)

    if not os.path.isfile(zip_path):
        return False

    version = "unknown"
    if os.path.isfile(version_path):
        with open(version_path, "r", encoding="utf-8") as f:
            version = f.read().strip()

    log.info("Applying pending update v%s", version)
    extract_dir = os.path.join(pending, "extracted")

    try:
        # Extract
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(extract_dir)

        # Locate extracted content (ZIP contains PoB-Injector/ subfolder)
        inner = os.path.join(extract_dir, "PoB-Injector")
        if not os.path.isdir(inner):
            # Fallback: maybe extracted flat
            inner = extract_dir

        # --- Swap exe ---
        exe_path = os.path.join(exe_dir, "PoB-Injector.exe")
        new_exe = os.path.join(inner, "PoB-Injector.exe")
        old_exe = exe_path + ".old"

        if os.path.isfile(new_exe):
            if os.path.isfile(old_exe):
                os.remove(old_exe)
            if os.path.isfile(exe_path):
                os.rename(exe_path, old_exe)
            shutil.copy2(new_exe, exe_path)
            log.info("Exe swapped successfully")

        # --- Swap extension folder ---
        new_ext = os.path.join(inner, "extension")
        old_ext = os.path.join(exe_dir, "extension")
        if os.path.isdir(new_ext):
            if os.path.isdir(old_ext):
                shutil.rmtree(old_ext)
            shutil.copytree(new_ext, old_ext)
            log.info("Extension folder updated")

        # Cleanup pending
        shutil.rmtree(pending, ignore_errors=True)
        log.info("Update v%s applied successfully", version)
        return True

    except Exception as e:
        log.error("Failed to apply update: %s", e)
        # Attempt rollback of exe
        exe_path = os.path.join(exe_dir, "PoB-Injector.exe")
        old_exe = exe_path + ".old"
        if os.path.isfile(old_exe) and not os.path.isfile(exe_path):
            try:
                os.rename(old_exe, exe_path)
                log.info("Rolled back exe")
            except Exception:
                pass
        # Leave pending dir for debugging (don't delete on failure)
        return False
