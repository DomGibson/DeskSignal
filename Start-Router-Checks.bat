@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 goto fallback
py -3 router_checks.py
goto done
:fallback
python router_checks.py
:done
pause
