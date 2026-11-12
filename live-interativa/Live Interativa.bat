@echo off
chcp 65001 >nul
title Live Interativa - deixe esta janela aberta durante a live
cd /d "%~dp0"
set "NODE=node"
if exist "%~dp0node\node.exe" set "NODE=%~dp0node\node.exe"
"%NODE%" server.js --abrir
echo.
echo A Live Interativa foi desligada.
pause
