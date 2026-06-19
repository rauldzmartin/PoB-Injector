# Test Updater Script
# Run this script to test the updater functionality

param(
    [string]$TestType = "success",  # success, download_fail, zip_corrupt
    [string]$Version = "0.6.25-beta"
)

$ErrorActionPreference = "Stop"
$ServerDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "PoB Injector Updater Test Suite" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

function Test-SuccessfulUpdate {
    param([string]$Version)
    
    Write-Host "TEST: Successful Update to v$Version" -ForegroundColor Green
    Write-Host "This will download and validate the update process" -ForegroundColor Yellow
    Write-Host ""
    
    # Run updater
    python updater.py rauldzmartin/PoB-Injector main $Version
    
    # Check logs
    if (Test-Path "updater.log") {
        Write-Host "`nUpdater Log:" -ForegroundColor Cyan
        Get-Content updater.log
        
        if (Select-String -Path "updater.log" -Pattern "UPDATE COMPLETED SUCCESSFULLY") {
            Write-Host "`n[OK] Update completed successfully" -ForegroundColor Green
        } else {
            Write-Host "`n[FAIL] Update did not complete successfully" -ForegroundColor Red
        }
    } else {
        Write-Host "`n[FAIL] updater.log not found - updater didn't start" -ForegroundColor Red
    }
}

function Test-DownloadFail {
    Write-Host "TEST: Download Failure & Rollback" -ForegroundColor Green
    Write-Host "This will attempt to download a non-existent version" -ForegroundColor Yellow
    Write-Host ""
    
    # Try to download non-existent version
    python updater.py rauldzmartin/PoB-Injector main 0.6.99-nonexistent
    
    # Check logs for rollback
    if (Test-Path "updater.log") {
        Write-Host "`nUpdater Log:" -ForegroundColor Cyan
        Get-Content updater.log
        
        if (Select-String -Path "updater.log" -Pattern "rollback") {
            Write-Host "`n[OK] Rollback mechanism triggered correctly" -ForegroundColor Green
        } else {
            Write-Host "`n[FAIL] Rollback was not triggered" -ForegroundColor Red
        }
    }
}

function Test-ZipValidation {
    Write-Host "TEST: ZIP Integrity Validation" -ForegroundColor Green
    Write-Host "This will test ZIP corruption detection" -ForegroundColor Yellow
    Write-Host ""
    
    # Download a valid update first
    Write-Host "Downloading valid ZIP..." -ForegroundColor Gray
    python updater.py rauldzmartin/PoB-Injector main $Version
    
    # Wait for download
    Start-Sleep -Seconds 2
    
    if (Test-Path "update.zip") {
        Write-Host "Corrupting ZIP file..." -ForegroundColor Gray
        
        # Truncate the ZIP to corrupt it
        $zipContent = Get-Content "update.zip" -Raw -Encoding Byte
        $corrupted = $zipContent[0..($zipContent.Length / 2)]
        Set-Content "update.zip" -Value $corrupted -Encoding Byte
        
        # Try to extract corrupted ZIP
        Write-Host "Attempting to validate corrupted ZIP..." -ForegroundColor Gray
        $pythonCode = @'
import zipfile
try:
    with zipfile.ZipFile('update.zip', 'r') as z:
        bad = z.testzip()
        if bad:
            print('OK: Corruption detected:', bad)
        else:
            print('FAIL: Corruption not detected')
except Exception as e:
    print('OK: Corruption detected:', e)
'@
        python -c $pythonCode
    } else {
        Write-Host "[FAIL] update.zip not found" -ForegroundColor Red
    }
}

function Show-UpdaterLogs {
    Write-Host "`nCurrent Logs:" -ForegroundColor Cyan
    Write-Host "=" * 60 -ForegroundColor Gray
    
    if (Test-Path "updater.log") {
        Write-Host "`n[updater.log]" -ForegroundColor Yellow
        Get-Content updater.log | Select-Object -Last 20
    } else {
        Write-Host "updater.log: Not found" -ForegroundColor Gray
    }
    
    if (Test-Path "PoB-Injector.log") {
        Write-Host "`n[PoB-Injector.log]" -ForegroundColor Yellow
        Get-Content PoB-Injector.log | Select-Object -Last 10
    }
}

function Cleanup-TestFiles {
    Write-Host "`nCleaning up test files..." -ForegroundColor Gray
    
    @("update.zip", "updater.log") | ForEach-Object {
        if (Test-Path $_) {
            Remove-Item $_ -Force
            Write-Host "Removed: $_" -ForegroundColor Gray
        }
    }
    
    if (Test-Path "update_extracted") {
        Remove-Item "update_extracted" -Recurse -Force
        Write-Host "Removed: update_extracted/" -ForegroundColor Gray
    }
}

# Main test execution
Set-Location $ServerDir

Write-Host "Test Type: $TestType" -ForegroundColor Cyan
Write-Host "Version: $Version" -ForegroundColor Cyan
Write-Host ""

# Cleanup before test
Cleanup-TestFiles

try {
    switch ($TestType) {
        "success" { 
            Test-SuccessfulUpdate -Version $Version 
        }
        "download_fail" { 
            Test-DownloadFail 
        }
        "zip_validation" { 
            Test-ZipValidation 
        }
        default { 
            Write-Host "Unknown test type: $TestType" -ForegroundColor Red
            Write-Host "Available: success, download_fail, zip_validation"
            exit 1
        }
    }
} catch {
    Write-Host "`n[FAIL] Test failed with error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
}

# Show logs
Show-UpdaterLogs

Write-Host "`n" + "=" * 60 -ForegroundColor Cyan
Write-Host "Test completed" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Cleanup option
Write-Host "`nCleanup test files? [Y/n]: " -NoNewline -ForegroundColor Yellow
$cleanup = Read-Host
if ($cleanup -ne "n") {
    Cleanup-TestFiles
    Write-Host "[OK] Cleanup completed" -ForegroundColor Green
}
