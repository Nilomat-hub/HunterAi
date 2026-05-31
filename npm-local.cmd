@echo off
setlocal
set "PROJECT_DIR=%~dp0"
for /d %%D in ("%PROJECT_DIR%.tools\node-v*-win-x64") do set "NODE_DIR=%%~fD"
if not defined NODE_DIR (
  echo Local Node.js installation not found in .tools
  exit /b 1
)
set "PATH=%NODE_DIR%;%PATH%"
set "NODE_OPTIONS=--use-system-ca"
set "NPM_CONFIG_CACHE=%PROJECT_DIR%.npm-cache"
set "PLAYWRIGHT_BROWSERS_PATH=%PROJECT_DIR%.playwright-runtime"
set "NEXT_DIST_DIR=.next-local"
"%NODE_DIR%\npm.cmd" %*
