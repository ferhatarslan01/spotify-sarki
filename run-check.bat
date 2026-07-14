@echo off
cd /d "%~dp0"
node src\checkNewReleases.js >> logs\check.log 2>&1
