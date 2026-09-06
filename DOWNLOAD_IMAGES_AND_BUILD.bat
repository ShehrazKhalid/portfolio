@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 20 or newer first.
  pause
  exit /b 1
)
echo Refreshing available source galleries into assets/projects. This needs an internet connection.
call npm run media -- --refresh
if errorlevel 1 (
  echo The media tool stopped unexpectedly. See the message above.
  pause
  exit /b 1
)
call npm run build
if errorlevel 1 (
  echo Build failed. Do not upload an old dist folder.
  pause
  exit /b 1
)
echo.
echo Finished. Review data/media-report.json for missing or unavailable listings.
echo The generated dist folder is the ready-to-host website.
pause
