#!/data/data/com.termux/files/usr/bin/bash
set -e
pkg update -y
pkg install nodejs git -y
npm install
echo "NAWAB-MD installed. Configure .env, then run: npm start"
npm start
