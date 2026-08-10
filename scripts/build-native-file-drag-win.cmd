@echo off
cd /d "%~dp0\.."
if not "%SOUNDLIB_BUILD_LOGGING%"=="1" (
  set SOUNDLIB_BUILD_LOGGING=1
  call "%~f0" > ".\native-drag-build.log" 2>&1
  set BUILD_EXIT=%ERRORLEVEL%
  type ".\native-drag-build.log"
  echo.
  echo Build log: %CD%\native-drag-build.log
  if exist ".\node-gyp-build.log" echo Node-gyp log: %CD%\node-gyp-build.log
  pause
  exit /b %BUILD_EXIT%
)

set "ROOT=%CD%"
set "MODULE_DIR=%ROOT%\native\file-drag"
set "PREBUILD_DIR=%MODULE_DIR%\prebuilds\win32-x64"
set "OUTPUT_FILE=%PREBUILD_DIR%\native_file_drag.node"
set "NODE_GYP_LOG=%ROOT%\node-gyp-build.log"

echo SoundLibraryManager Windows native drag build
echo Root: %ROOT%
echo Build log: %ROOT%\native-drag-build.log
echo Node-gyp log: %NODE_GYP_LOG%

where node >nul 2>nul || (
  echo FAILED: Node.js was not found.
  exit /b 1
)

where npm.cmd >nul 2>nul || (
  echo FAILED: npm.cmd was not found. Please reinstall Node.js with npm enabled.
  exit /b 1
)

where npx.cmd >nul 2>nul || (
  echo FAILED: npx.cmd was not found. Please reinstall Node.js with npm enabled.
  exit /b 1
)

if not exist ".\node_modules\" (
  echo node_modules not found. Installing project dependencies...
  if exist ".\package-lock.json" (
    call npm.cmd ci
  ) else (
    call npm.cmd install
  )
  if errorlevel 1 (
    echo FAILED: npm install failed.
    exit /b 1
  )
)

for /f "usebackq delims=" %%v in (`node -p "require('./node_modules/electron/package.json').version"`) do set "ELECTRON_VERSION=%%v"
if "%ELECTRON_VERSION%"=="" (
  echo FAILED: Could not read Electron version from node_modules.
  exit /b 1
)

echo Electron: %ELECTRON_VERSION%
echo Target arch: x64
echo Building native module...
del "%NODE_GYP_LOG%" >nul 2>nul

cd /d "%MODULE_DIR%"
set npm_config_arch=x64
set npm_config_target_arch=x64
call npx.cmd --yes node-gyp rebuild --verbose --arch=x64 --runtime=electron --target=%ELECTRON_VERSION% --dist-url=https://electronjs.org/headers > "%NODE_GYP_LOG%" 2>&1
set NODE_GYP_EXIT=%ERRORLEVEL%
type "%NODE_GYP_LOG%"
cd /d "%ROOT%"

if not "%NODE_GYP_EXIT%"=="0" (
  echo.
  echo FAILED: node-gyp exited with code %NODE_GYP_EXIT%
  echo If the log mentions Visual Studio, install Desktop development with C++ and Windows SDK in Visual Studio Installer.
  exit /b %NODE_GYP_EXIT%
)

if not exist "%MODULE_DIR%\build\Release\native_file_drag.node" (
  echo FAILED: Build finished, but native_file_drag.node was not created.
  exit /b 1
)

mkdir "%PREBUILD_DIR%" >nul 2>nul
copy /y "%MODULE_DIR%\build\Release\native_file_drag.node" "%OUTPUT_FILE%" >nul
if errorlevel 1 (
  echo FAILED: Could not copy native_file_drag.node to prebuilds.
  exit /b 1
)

echo Built native drag module: %OUTPUT_FILE%
echo SUCCESS: native drag module is ready.
exit /b 0
