$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$dest = Join-Path $root "lib\marathon-manifest"
$tmp  = Join-Path $env:TEMP ("marathon-manifest-" + [Guid]::NewGuid().ToString("N"))
$zip  = Join-Path $tmp "repo.zip"

# Clean destination
if (Test-Path $dest) {
  Remove-Item -Recurse -Force $dest
}
New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

# Download main.zip from GitHub
$zipUrl = "https://github.com/lax20attack/marathon-manifest/archive/refs/heads/main.zip"
Write-Host "Downloading $zipUrl"
Invoke-WebRequest -Uri $zipUrl -OutFile $zip

# Extract zip
Expand-Archive -Path $zip -DestinationPath $tmp -Force

# Move extracted folder to lib/marathon-manifest
$extracted = Join-Path $tmp "marathon-manifest-main"
if (!(Test-Path $extracted)) {
  throw "Unexpected zip layout. Can't find: $extracted"
}

Move-Item -Path $extracted -Destination $dest

# Cleanup temp
Remove-Item -Recurse -Force $tmp

Write-Host "✅ Installed manifest to: $dest"