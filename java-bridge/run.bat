@echo off
REM Run FXP20 Java Bridge standalone (for testing)
echo Starting FXP20 Java Bridge...
echo Press Ctrl+C to stop.
echo.

java --enable-native-access=ALL-UNNAMED -Djava.library.path=".;..\jpos-driver\lib" -cp "build;..\jpos-driver\lib\*;..\jpos-driver\lib;." FXP20Bridge
