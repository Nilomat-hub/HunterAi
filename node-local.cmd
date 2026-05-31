@echo off
setlocal
set "PROJECT_DIR=%~dp0"
for /d %%D in ("%PROJECT_DIR%.tools\node-v*-win-x64") do set "NODE_DIR=%%~fD"
if not defined NODE_DIR (
  echo Local Node.js installation not found in .tools
  exit /b 1
)
"%NODE_DIR%\node.exe" %*
