# Updater Technical Documentation

## Overview

PoB Injector uses an **inline rename strategy** for self-updating the executable while running. This approach avoids common pitfalls like antivirus false positives from batch scripts and race conditions from external updaters.

## Update Flow

### 1. User Triggers Update

```
User (systray) → Click "Update"
    ↓
tray.py:trigger_update()
    ↓
GET /check-update?branch={channel}
    ↓
POST /update?branch={channel}&version={latest}
```

### 2. Server Spawns Updater

```python
# app.py:/update endpoint
subprocess.Popen([
    sys.executable,        # PoB-Injector.exe
    updater_path,          # server/updater.py
    repo,                  # rauldzmartin/PoB-Injector
    branch,                # main or dev
    version                # 0.6.25-beta
], creationflags=CREATE_NO_WINDOW)

# Server schedules shutdown
threading.Thread(target=kill_me).start()  # Exits in 1 second
```

### 3. New Process in Updater Mode

```python
# tray.py detects updater mode
if len(sys.argv) > 1 and "updater.py" in sys.argv[1]:
    import updater
    updater.main()  # Run updater instead of server
    sys.exit(0)
```

### 4. Updater Process

```
1. Wait for exe to be released (active polling, max 15s)
2. Download ZIP with retry (3 attempts, exponential backoff)
3. Validate ZIP integrity (testzip())
4. Extract to temp folder
5. Kill processes on port 5000 (if server changed)
6. ATOMIC RENAME: PoB-Injector.exe → PoB-Injector.exe.old
7. Copy new exe → PoB-Injector.exe
8. Verify copy (size check)
9. Copy extension folder
10. Clean up temp files
11. Launch: PoB-Injector.exe --updated
12. Exit updater process
```

### 5. New Process Starts

```python
# tray.py detects success flag
if "--updated" in sys.argv:
    icon.notify("Update Complete", ...)
    # Old exe (.old) kept for 24h as backup
```

## Error Handling & Rollback

### Download Failure

```python
if not download_with_retry(url, dest):
    rollback_and_restart(exe, exe + ".old")
    return
```

**Rollback:**
1. Restore: `exe.old` → `exe`
2. Launch: `exe --update-failed`
3. User sees notification

### ZIP Corruption

```python
try:
    extract_and_validate(zip_path, extract_dir)
except Exception:
    rollback_and_restart(...)
```

### Exe Copy Verification Failure

```python
if not verify_exe_copy(new_exe, exe_path):
    rollback_and_restart(exe_path, old_exe)
```

## File Paths & Modes

### Compiled Executable (Production)

```python
sys.frozen = True
sys.executable = "D:/Path/To/PoB-Injector.exe"
sys._MEIPASS = "C:/Users/.../Temp/_MEI12345"  # PyInstaller temp

# Paths
HERE = sys._MEIPASS                 # Bundled files
REPO_ROOT = HERE                    # Same as HERE
real_root = os.path.dirname(exe)    # D:/Path/To/
```

### Development Mode

```python
sys.frozen = False
sys.executable = "D:/Python312/python.exe"

# Paths
HERE = "D:/Code/PoB-Injector/server"
REPO_ROOT = "D:/Code/PoB-Injector"
```

## Version Consistency

### Problem

GitHub Actions workflow reads version from `manifest.json` at the tagged commit. If the manifest wasn't updated before tagging:

```
Tag:      v0.6.25-beta
Manifest: 0.6.24-beta
ZIP:      PoB_Injector_Release_v0.6.24-beta.zip  ← Wrong!

Updater downloads:
  /releases/download/v0.6.25-beta/PoB_Injector_Release_v0.6.25-beta.zip
  → 404 Not Found
```

### Solution

**Validation in Workflow** (`.github/workflows/release.yml`):

```yaml
- name: Validate Version Consistency
  run: |
    $TAG_VERSION = "${{ github.ref_name }}" -replace '^v', ''
    $MANIFEST_VERSION = (Get-Content manifest.json).version_name
    
    if ($TAG_VERSION -ne $MANIFEST_VERSION) {
      Write-Error "VERSION MISMATCH!"
      exit 1
    }
```

This **fails the build** if versions don't match, preventing broken releases.

## Logs & Debugging

### User-Facing Logs

| File | Location | Purpose |
|------|----------|---------|
| `PoB-Injector.log` | Installation folder | Server logs (uvicorn, PoB wrapper) |
| `updater.log` | Installation folder | Update process logs |

### Log Locations

**Compiled:**
```
D:/Path/To/PoB-Injector/
├── PoB-Injector.exe
├── PoB-Injector.exe.old  (backup, kept 24h)
├── PoB-Injector.log
├── updater.log
└── extension/
```

**Development:**
```
D:/Code/PoB-Injector/server/
├── PoB-Injector.log
├── updater.log
└── ...
```

### Debugging Update Failures

1. **Check if updater ran at all:**
   ```powershell
   Test-Path updater.log
   # False = updater never started (likely POST /update failed)
   # True = updater started, check logs
   ```

2. **Read updater logs:**
   ```powershell
   Get-Content updater.log
   ```

3. **Common errors:**
   - `HTTP 404` → ZIP name mismatch (version inconsistency)
   - `Size mismatch` → Incomplete download (network issue)
   - `Corrupted file in ZIP` → Bad upload or download corruption
   - `Process didn't release` → Old process didn't exit (AV blocking?)

## Manual Testing

### Test Update Process

```powershell
cd D:\Documentos\GitHub\PoB-Injector\server

# Simulate update from v0.6.24-beta to v0.6.25-beta
python updater.py rauldzmartin/PoB-Injector main 0.6.25-beta

# Check logs
cat updater.log
```

### Test Rollback

```powershell
# Modify updater.py to force failure:
# Line 17: Change version to "0.6.99-beta" (non-existent)

python updater.py rauldzmartin/PoB-Injector main 0.6.99-beta

# Expected:
# - Download fails (404)
# - Rollback triggered
# - Previous exe restored
# - updater.log shows rollback
```

## Future Improvements

### Planned

- [ ] Automatic version bumping from git tags
- [ ] Changelog generation from conventional commits
- [ ] Delta updates (patch-only downloads)
- [ ] Digital signature verification

### Considered

- [ ] Background downloads (notify when ready, apply on next start)
- [ ] Scheduled update checks (daily at startup)
- [ ] Update postpone option (remind later)

## References

- **Inline Rename Strategy**: [commit aed200b](https://github.com/rauldzmartin/PoB-Injector/commit/aed200b)
- **CWD Fix for Temp Folders**: [commit e0feeaa](https://github.com/rauldzmartin/PoB-Injector/commit/e0feeaa)
- **GitHub Releases API**: [commit a01d04c](https://github.com/rauldzmartin/PoB-Injector/commit/a01d04c)
