@echo off
chcp 65001 >nul
rem Arrastra el export CSV del sistema encima de este archivo (o haz doble clic y eligelo).
cd /d "%~dp0"
set "SRC=%~1"
if "%SRC%"=="" (
  for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $d=New-Object System.Windows.Forms.OpenFileDialog; $d.Filter='CSV (*.csv)|*.csv'; $d.Title='Selecciona el export del nodo Kennedy'; if($d.ShowDialog() -eq 'OK'){$d.FileName}"`) do set "SRC=%%F"
)
if "%SRC%"=="" ( echo No se selecciono ningun archivo. & pause & exit /b 1 )
node scripts\actualizar.cjs "%SRC%"
echo.
pause
