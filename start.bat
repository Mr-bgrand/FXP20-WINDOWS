@echo off
echo ==========================================
echo   FXP20 RFID Reader - Starting (JPOS)
echo ==========================================
echo.
echo   Middleware: http://localhost:4000
echo   Web Client: http://localhost:3000
echo.

REM Start middleware in a new window
start "FXP20 Middleware" cmd /k "cd middleware && npm run dev"

REM Wait a moment for middleware to start
timeout /t 3 /nobreak >nul

REM Start web client in a new window
start "FXP20 Web Client" cmd /k "cd web-client && npm run dev"

echo Both services started in separate windows.
echo Close those windows to stop.
pause
