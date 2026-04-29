@echo off
cd /d %~dp0

echo Node server baslatiliyor...

start http://localhost:3000

node server.js

pause