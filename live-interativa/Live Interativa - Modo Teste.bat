@echo off
chcp 65001 >nul
title Live Interativa (MODO TESTE, sem TikTok)
cd /d "%~dp0"
set "NODE=node"
if exist "%~dp0node\node.exe" set "NODE=%~dp0node\node.exe"
"%NODE%" server.js --teste --abrir
echo.
echo A Live Interativa foi desligada.
pause
