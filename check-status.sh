#!/bin/bash

echo "🔍 Checking Course Prints Worker Status"
echo "========================================="
echo ""

# Check if agent is loaded
if launchctl list | grep -q com.courseprints.worker; then
    echo "✅ Agent is loaded and running"
    launchctl list | grep com.courseprints.worker
else
    echo "❌ Agent is not running"
fi

echo ""
echo "📝 Recent log output:"
echo "-------------------"
if [ -f ~/Library/Logs/courseprints.out.log ]; then
    if [ -s ~/Library/Logs/courseprints.out.log ]; then
        tail -10 ~/Library/Logs/courseprints.out.log
    else
        echo "(log file is empty)"
    fi
else
    echo "(log file doesn't exist yet)"
fi

echo ""
echo "🚨 Recent errors:"
echo "----------------"
if [ -f ~/Library/Logs/courseprints.err.log ]; then
    if [ -s ~/Library/Logs/courseprints.err.log ]; then
        tail -10 ~/Library/Logs/courseprints.err.log
    else
        echo "(no errors)"
    fi
else
    echo "(no error log yet)"
fi

echo ""
echo "💡 To monitor logs in real-time:"
echo "   tail -f ~/Library/Logs/courseprints.out.log"
