@echo off
cd /d "%~dp0"
echo Penghubung khusus Champer. API lokal dan kolektor dibuka terpisah.
echo Tidak membuka atau mengubah Takebishi. Tidak menulis ke PLC.
call node-run.cmd bridge-client.mjs
pause
