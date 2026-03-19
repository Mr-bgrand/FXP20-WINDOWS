@echo off
REM Build FXP20 Java Bridge
set JPOS_LIB=..\jpos-driver\lib
set OUT_DIR=build

echo Building FXP20Bridge...

if not exist %OUT_DIR% mkdir %OUT_DIR%

javac -cp "%JPOS_LIB%\*;%JPOS_LIB%" -d %OUT_DIR% FXP20Bridge.java

if %ERRORLEVEL% EQU 0 (
    echo.
    echo Build successful!
    echo.
    echo Test with: run.bat
) else (
    echo.
    echo Build FAILED
    exit /b 1
)
