@echo off
echo ==========================================
echo   FXP20 RFID Reader - Setup
echo ==========================================
echo.

REM Check Java
java -version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Java not found. Install JDK 17 or above.
    echo   https://adoptium.net/
    pause
    exit /b 1
)
echo [OK] Java found

REM Check Node
node -v >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found. Install Node.js 18 or above.
    echo   https://nodejs.org/
    pause
    exit /b 1
)
echo [OK] Node.js found

echo.
echo --- Installing middleware dependencies ---
cd middleware
call npm install
cd ..

echo.
echo --- Installing web client dependencies ---
cd web-client
call npm install
cd ..

echo.
echo --- Building Java bridge ---
cd java-bridge
call build.bat
cd ..

echo.
echo ==========================================
echo   Setup complete!
echo.
echo   To start:  start.bat
echo   Mock mode:  start-mock.bat
echo ==========================================
pause
