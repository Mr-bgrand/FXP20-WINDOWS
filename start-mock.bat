@echo off
echo ==========================================
echo   FXP20 RFID Reader - Starting (MOCK)
echo   No hardware required - simulated tags
echo ==========================================
echo.

REM Start middleware in mock mode
start "FXP20 Middleware (Mock)" cmd /k "cd middleware && set READER_MODE=mock && npm run dev"

timeout /t 3 /nobreak >nul

start "FXP20 Web Client" cmd /k "cd web-client && npm run dev"

echo Both services started. Open http://localhost:3000
pause
