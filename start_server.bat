@echo off
echo ===================================================
echo WORLDVIEW COMMAND CENTER V4.6 
echo ===================================================
echo LOCAL SERVER BOOT SEQUENCE INITIATED...
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python was not found on your system!
    echo To run this local server, please install Python from the Microsoft Store or python.org.
    echo Press any key to exit...
    pause >nul
    exit
)

echo Starting Local Sockets Server on Port 8080...
echo.
echo [ACCESS YOUR BROWSER AND NAVIGATE TO:]
echo http://127.0.0.1:8080
echo.
echo Leave this window running while using Worldview. 
echo Press CTRL+C to terminate the local server.
echo ===================================================

python -m http.server 8080

pause
