@echo off
REM ===========================================================
REM   FARTWORLD launcher  —  double-click to play
REM   Spins up a tiny local web server in this folder and opens
REM   the game in your browser. (A real server avoids the file://
REM   CORS issues that break modules + the service worker.)
REM ===========================================================
title FartWorld Server
cd /d "%~dp0"
set PORT=8000

echo.
echo  Starting FartWorld on http://localhost:%PORT%
echo  Keep this window open while you play. Close it to stop.
echo.

REM --- Try Python first ---
where python >nul 2>nul
if %ERRORLEVEL%==0 (
    start "" "http://localhost:%PORT%/index.html"
    python -m http.server %PORT%
    goto :eof
)

REM --- Then the Windows "py" launcher ---
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    start "" "http://localhost:%PORT%/index.html"
    py -m http.server %PORT%
    goto :eof
)

REM --- Then Node (npx serve) ---
where npx >nul 2>nul
if %ERRORLEVEL%==0 (
    start "" "http://localhost:%PORT%/index.html"
    npx --yes serve -l %PORT% .
    goto :eof
)

echo  Could not find Python or Node on this PC.
echo.
echo  Easiest fix: install Python from https://python.org
echo  (tick "Add to PATH" during install), then run PLAY.bat again.
echo.
echo  Or, to try without a server, just double-click index.html
echo  ^(some features like offline cache may not work^).
echo.
pause
