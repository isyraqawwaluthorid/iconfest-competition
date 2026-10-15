@echo off
rem Klik dua kali untuk mematikan worker dengan rapi.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0matikan-worker.ps1"
echo.
pause
