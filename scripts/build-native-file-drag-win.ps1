$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$ModuleDir = Join-Path $Root "native\file-drag"
$PrebuildDir = Join-Path $ModuleDir "prebuilds\win32-x64"
$OutputFile = Join-Path $PrebuildDir "native_file_drag.node"
$LogPath = Join-Path $Root "native-drag-build.log"
$NodeGypLogPath = Join-Path $Root "node-gyp-build.log"

try {
  Stop-Transcript | Out-Null
} catch {}
Start-Transcript -Path $LogPath -Force | Out-Null
trap {
  Write-Host ""
  Write-Host "FAILED: $($_.Exception.Message)"
  try {
    Stop-Transcript | Out-Null
  } catch {}
  exit 1
}

Write-Host "SoundLibraryManager Windows native drag build"
Write-Host "Root: $Root"
Write-Host "Build log: $LogPath"
Write-Host "Node-gyp log: $NodeGypLogPath"

function Invoke-CmdStep {
  param(
    [Parameter(Mandatory = $true)][string]$Command,
    [string]$WorkingDirectory = $Root,
    [string]$LogFile = ""
  )

  $temp = if ([string]::IsNullOrWhiteSpace($LogFile)) {
    Join-Path $Root "cmd-step.log"
  } else {
    $LogFile
  }
  Remove-Item $temp -Force -ErrorAction SilentlyContinue

  $escapedCommand = $Command.Replace('"', '\"')
  $process = Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/d", "/s", "/c", "`"$escapedCommand`"" `
    -WorkingDirectory $WorkingDirectory `
    -NoNewWindow `
    -Wait `
    -PassThru `
    -RedirectStandardOutput $temp `
    -RedirectStandardError $temp

  if (Test-Path $temp) {
    Get-Content $temp | ForEach-Object { Write-Host $_ }
  }
  return $process.ExitCode
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js was not found. Please install Node.js first, then run this script again."
}

if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  throw "npm was not found. Please reinstall Node.js with npm enabled."
}

if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
  throw "npx was not found. Please reinstall Node.js with npm enabled."
}

if (-not (Test-Path (Join-Path $Root "node_modules"))) {
  Write-Host "node_modules not found. Installing project dependencies..."
  if (Test-Path (Join-Path $Root "package-lock.json")) {
    $npmExit = Invoke-CmdStep -Command "npm.cmd ci" -WorkingDirectory $Root
  } else {
    $npmExit = Invoke-CmdStep -Command "npm.cmd install" -WorkingDirectory $Root
  }
  if ($npmExit -ne 0) {
    throw "npm install failed with code $npmExit."
  }
}

$ElectronPackage = Join-Path $Root "node_modules\electron\package.json"
$ElectronVersion = node -p "require(process.argv[1]).version" $ElectronPackage
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($ElectronVersion)) {
  throw "Could not read Electron version from node_modules."
}

Write-Host "Electron: $ElectronVersion"
Write-Host "Target arch: x64"
Write-Host "Building native module..."
Remove-Item $NodeGypLogPath -Force -ErrorAction SilentlyContinue

$env:npm_config_arch = "x64"
$env:npm_config_target_arch = "x64"
$nodeGypCommand = "npx.cmd --yes node-gyp rebuild --verbose --arch=x64 --runtime=electron --target=$ElectronVersion --dist-url=https://electronjs.org/headers"
$exitCode = Invoke-CmdStep -Command $nodeGypCommand -WorkingDirectory $ModuleDir -LogFile $NodeGypLogPath
if ($exitCode -ne 0) {
  Write-Host ""
  Write-Host "FAILED: node-gyp exited with code $exitCode"
  Write-Host "If the log mentions Visual Studio, install 'Desktop development with C++' and Windows SDK in Visual Studio Installer."
  throw "node-gyp build failed."
}
New-Item -ItemType Directory -Force -Path $PrebuildDir | Out-Null
Copy-Item (Join-Path $ModuleDir "build\Release\native_file_drag.node") $OutputFile -Force
& node (Join-Path $Root "scripts\sanitize-native-binary.js") $OutputFile
if ($LASTEXITCODE -ne 0) {
  throw "Could not remove local build paths from native_file_drag.node."
}
Write-Host "Built native drag module: $OutputFile"

if (-not (Test-Path $OutputFile)) {
  throw "Build finished, but native_file_drag.node was not created."
}

Write-Host "SUCCESS: native drag module is ready."
Stop-Transcript | Out-Null
