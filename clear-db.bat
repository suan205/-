@echo off
setlocal EnableExtensions
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -m app.database --clear
) else (
  echo [ERROR] Project Python was not found. Run start.bat first.
)

echo.
pause
endlocal
