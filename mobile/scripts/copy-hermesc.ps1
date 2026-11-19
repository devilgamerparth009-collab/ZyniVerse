# Copies React Native's Hermes compiler out of node_modules so Windows
# Application Control (WDAC) does not block it during release builds.
#
# Usage (from mobile/android):
#   $hermesc = (pwsh -File ..\scripts\copy-hermesc.ps1).Trim()
#   .\gradlew assembleRelease --no-daemon -PzyniHermescPath=$hermesc
#
# The script prints the absolute path to hermesc.exe. It is a no-op on machines
# where the default path already works; passing the override is always safe.

$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "..\node_modules\react-native\sdks\hermesc\win64-bin"
if (-not (Test-Path $source)) {
  throw "Hermes compiler not found at $source. Run npm install in mobile/ first."
}

$destination = Join-Path $env:LOCALAPPDATA "ZyniVerse\hermesc"
New-Item -ItemType Directory -Force -Path $destination | Out-Null
Copy-Item (Join-Path $source "*") -Destination $destination -Force

$hermesc = Join-Path $destination "hermesc.exe"
& $hermesc --version | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Copied Hermes compiler failed its version check at $hermesc."
}

Write-Output $hermesc
