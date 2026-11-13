@echo off
setlocal
set "CHAMPER_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
where node.exe >nul 2>nul
if not errorlevel 1 set "CHAMPER_NODE=node.exe"
"%CHAMPER_NODE%" -e "if(Number(process.versions.node.split('.')[0])<20)process.exit(1)" >nul 2>nul
if errorlevel 1 (
 echo Node.js 20 atau lebih baru diperlukan. Hubungi pengelola.
 exit /b 1
)
"%CHAMPER_NODE%" %*
