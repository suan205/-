@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "HOST=127.0.0.1"
if "%PORT%"=="" set "PORT=8000"
if not "%~1"=="" set "PORT=%~1"

set "PY_EXE="
set "PY_ARGS="

python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
if not errorlevel 1 set "PY_EXE=python"

if not defined PY_EXE (
  for %%V in (3.14 3.13 3.12 3.11 3.10) do (
    if not defined PY_EXE (
      py -%%V -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
      if not errorlevel 1 (
        set "PY_EXE=py"
        set "PY_ARGS=-%%V"
      )
    )
  )
)

if not defined PY_EXE (
  py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" >nul 2>nul
  if not errorlevel 1 (
    set "PY_EXE=py"
    set "PY_ARGS=-3"
  )
)

if not defined PY_EXE (
  echo [ERROR] Python 3.10 or newer was not found.
  echo         Install it from https://www.python.org/downloads/ and try again.
  pause
  exit /b 1
)

if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" -m pip --version >nul 2>nul
  if errorlevel 1 (
    echo [WARN] Existing .venv is incomplete. Recreating it...
    rmdir /s /q ".venv"
  )
)

if not exist ".venv\Scripts\python.exe" (
  echo [1/3] Creating project virtual environment...
  "%PY_EXE%" %PY_ARGS% -m venv .venv
  if errorlevel 1 (
    echo [ERROR] Failed to create .venv
    echo         Make sure Python includes the venv module, then try again.
    pause
    exit /b 1
  )
) else (
  echo [1/3] Virtual environment ready.
)

if not defined PIP_INDEX_URL (
  set "PIP_INDEX_URL=https://pypi.tuna.tsinghua.edu.cn/simple"
)

set "DEPS_READY="
".venv\Scripts\python.exe" -m pip install --dry-run --no-index --disable-pip-version-check -r requirements.txt >nul 2>nul

if not errorlevel 1 set "DEPS_READY=1"
if defined DEPS_READY (
  echo [2/3] Dependencies already installed.
) else (
  echo [2/3] Installing dependencies into .venv...
  echo        Index: %PIP_INDEX_URL%
  ".venv\Scripts\python.exe" -m pip install --disable-pip-version-check --no-input --timeout 60 --retries 2 --progress-bar on -r requirements.txt
)
if errorlevel 1 (
  echo [ERROR] Dependency installation failed.
  echo         Check your network or proxy, then delete .venv and run start.bat again.
  pause
  exit /b 1
)

".venv\Scripts\python.exe" -c "import fastapi, uvicorn, jwt, email_validator" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] .venv is missing required packages.
  echo         Delete .venv and run start.bat again.
  pause
  exit /b 1
)

set "OPEN_PATH=/test"
set "HAS_INDEX="
if exist "web\index.html" for %%F in ("web\index.html") do if %%~zF GTR 0 set "HAS_INDEX=1"
if defined HAS_INDEX set "OPEN_PATH=/web/"

echo [3/3] Starting server...
echo.
echo   API:       http://%HOST%:%PORT%/
if defined HAS_INDEX (
  echo   Site page: http://%HOST%:%PORT%/web/
  echo   Test page: http://%HOST%:%PORT%/test
) else (
  echo   Test page: http://%HOST%:%PORT%/test
)
echo   API docs:  http://%HOST%:%PORT%/docs
echo.
echo   Press Ctrl+C to stop.
echo.

if not defined NO_BROWSER (
  start "" /min powershell -NoProfile -WindowStyle Hidden -Command "$url='http://%HOST%:%PORT%'; for($i=0; $i -lt 30; $i++) { try { $r=Invoke-RestMethod ($url+'/api/health') -TimeoutSec 1; if($r.status -eq 'ok') { Start-Process ($url+'%OPEN_PATH%'); exit } } catch {}; Start-Sleep -Milliseconds 500 }"
)

".venv\Scripts\python.exe" -m uvicorn app.main:app --host %HOST% --port %PORT%
if errorlevel 1 (
  echo.
  echo [ERROR] The server stopped unexpectedly. Is port %PORT% already in use?
  pause
)

endlocal
