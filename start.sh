#!/bin/bash
echo "Starting Lavalink..."
java -jar Lavalink.jar &

echo "Starting Discord Bot..."
node index.js
