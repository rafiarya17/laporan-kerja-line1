@echo off
cd /d "%~dp0"
call node-run.cmd show-tablet-code.mjs
pause
