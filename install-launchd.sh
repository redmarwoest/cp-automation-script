#!/bin/bash

# Install script for course prints worker launch agent
# This script copies the plist to the correct location and loads it

echo "🎨 Course Prints Worker - Launch Agent Installation"
echo "=================================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
  echo "❌ Please don't run this script as root"
  echo "Run it as your regular user account"
  exit 1
fi

# Define paths
AGENT_NAME="com.courseprints.worker"
PLIST_SOURCE="$(pwd)/${AGENT_NAME}.plist"
PLIST_DEST="${HOME}/Library/LaunchAgents/${AGENT_NAME}.plist"
LOG_DIR="${HOME}/Library/Logs"

# Create log directory if it doesn't exist
mkdir -p "${LOG_DIR}"

echo "📁 Creating LaunchAgents directory..."
mkdir -p "${HOME}/Library/LaunchAgents"

# Check if agent is already loaded
if launchctl list | grep -q "${AGENT_NAME}"; then
  echo "⚠️  Agent is already running. Unloading first..."
  launchctl unload "${PLIST_DEST}" 2>/dev/null || true
fi

# Copy plist file
echo "📋 Copying plist file..."
cp "${PLIST_SOURCE}" "${PLIST_DEST}"

# Load the agent
echo "🚀 Loading launch agent..."
launchctl load "${PLIST_DEST}"

# Start the agent
echo "▶️  Starting agent..."
launchctl start "${AGENT_NAME}"

echo ""
echo "✅ Installation complete!"
echo ""
echo "📊 Agent status:"
launchctl list | grep "${AGENT_NAME}" || echo "Agent may take a moment to start..."
echo ""
echo "📝 View logs:"
echo "   tail -f ${LOG_DIR}/courseprints.out.log"
echo "   tail -f ${LOG_DIR}/courseprints.err.log"
echo ""
echo "🛑 To stop the agent:"
echo "   launchctl unload ~/Library/LaunchAgents/${AGENT_NAME}.plist"
echo ""
echo "🔄 To restart the agent:"
echo "   launchctl stop ${AGENT_NAME}"
echo "   launchctl start ${AGENT_NAME}"
