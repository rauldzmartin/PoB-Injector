param ()
$manifestPath = Join-Path $PSScriptRoot "..\extension\manifest.json"
$manifest = Get-Content $manifestPath | ConvertFrom-Json
$version = $manifest.version_name
if (-not $version) { $version = $manifest.version }
if (-not $version) { $version = Get-Date -Format "yyyyMMdd-HHmmss" }

$root = Join-Path $PSScriptRoot ".."
$releasesDir = Join-Path $root "releases"
New-Item -ItemType Directory -Force -Path $releasesDir | Out-Null

$zipName = "PoB_Injector_Release_v${version}.zip"
$zipPath = Join-Path $releasesDir $zipName

$tmpDir = Join-Path $root "tmp_release"
if (Test-Path $tmpDir) { Remove-Item -Recurse -Force $tmpDir }
New-Item -ItemType Directory -Force -Path $tmpDir | Out-Null

# Copy only indispensable files
$requiredItems = @("extension", "pob_wrapper", "server", "install.bat", "start.bat", "README.md")
foreach ($item in $requiredItems) {
    $src = Join-Path $root $item
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $tmpDir -Recurse
    }
}

# Clean up heavy dev folders
Get-ChildItem -Path $tmpDir -Recurse -Directory -Include ".venv", "venv", "__pycache__" | Remove-Item -Recurse -Force

if (Test-Path $zipPath) { Remove-Item $zipPath }

Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmpDir, $zipPath)

Remove-Item -Recurse -Force $tmpDir

Write-Host "Wrote $zipPath"
