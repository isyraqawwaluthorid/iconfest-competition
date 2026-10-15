@echo off
rem Klik dua kali untuk melihat apakah worker hidup, kapan terakhir terlihat, dan keadaan lokasi air.
cd /d "%~dp0..\..\worker"
set PYTHONIOENCODING=utf-8
.venv\Scripts\python.exe scripts\status.py
echo.
pause
