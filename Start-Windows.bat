@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto fallback
py -3 -m http.server 8765 --bind 127.0.0.1
goto done
:fallback
python -m http.server 8765 --bind 127.0.0.1
:done
pause
