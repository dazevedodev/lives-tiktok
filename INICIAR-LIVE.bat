@echo off
chcp 65001 >nul
title Lives TikTok - LIGADO (nao feche esta janela durante a live)
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando o que falta, so na primeira vez...
  call npm install
)
start "" cmd /c "timeout /t 2 >nul & start http://localhost:3000"
node server.js
pause
