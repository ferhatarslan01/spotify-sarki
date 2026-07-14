@echo off
cd /d "%~dp0"
node src\postDailyChart.js >> logs\chart.log 2>&1
