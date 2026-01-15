#!/bin/bash

# Restart Course Prints Worker Script
# This script stops and starts the launchd worker service

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="com.courseprints.worker"

echo "🔄 Restarting Course Prints Worker..."

# Stop the worker (ignore error if not running)
echo "⏹️  Stopping worker..."
launchctl stop "$SERVICE_NAME" 2>/dev/null || echo "   (Worker was not running)"

# Wait a moment for graceful shutdown
sleep 2

# Start the worker
echo "▶️  Starting worker..."
launchctl start "$SERVICE_NAME"

# Wait a moment for startup
sleep 2

# Check if it's running
if launchctl list | grep -q "$SERVICE_NAME"; then
    echo "✅ Worker restarted successfully!"
    echo ""
    echo "📋 View logs with: tail -f ~/Library/Logs/courseprints.out.log"
else
    echo "⚠️  Warning: Worker may not have started. Check logs for errors."
fi

