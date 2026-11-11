@echo off
chcp 65001 >nul
title Wasmi - connect the database
cd /d "%~dp0.."
node scripts\setup-db.mjs
echo.
pause
