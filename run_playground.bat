@echo off
echo ========================================================
echo  Starting ThaiChord Interactive Web Playground...
echo ========================================================
echo.
echo Opening http://localhost:8501 in your default browser...
start http://localhost:8501
python -m http.server 8501 --directory playground
pause
