@echo off
cd /d "%~dp0"
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Milliseconds 800; Start-Process 'http://localhost:3000'"
call npm start
