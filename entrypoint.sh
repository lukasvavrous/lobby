#!/bin/sh
# Spustí React app v pozadí
npm start &

# Spustí backend server
node src/server.js
