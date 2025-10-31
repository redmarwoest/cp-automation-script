# Launch Agent Setup for Course Prints Worker

This guide explains how to set up the Course Prints poster generation worker to run as a background service using macOS Launch Agents.

## Overview

The worker polls for poster generation jobs and uses Adobe Illustrator to create custom golf course posters. It needs to run continuously with GUI access since it controls Illustrator.

## Key Features

- ✅ Runs 24/7 in the background
- ✅ Auto-starts on system login
- ✅ Auto-restarts if it crashes (`KeepAlive`)
- ✅ Keeps Mac awake while running (`Interactive` ProcessType)
- ✅ Full GUI session access for Adobe Illustrator automation
- ✅ Logging to `~/Library/Logs/`

## Prerequisites

1. **Node.js** installed at `/usr/local/bin/node`
   - Check with: `which node`
   - If different, update the path in `com.courseprints.worker.plist`

2. **Adobe Illustrator** installed and accessible

3. **Required files** in place:
   - `index.js` (entry point)
   - `poster-generator.js` (poster generation logic)
   - `simple-poster-worker-complete.js` (worker logic)
   - All dependencies installed via `npm install`

## Installation

### Option 1: Using the Install Script (Recommended)

```bash
cd /Users/redmarwoest/cp-automation-script
./install-launchd.sh
```

### Option 2: Manual Installation

```bash
# 1. Copy the plist file
cp com.courseprints.worker.plist ~/Library/LaunchAgents/

# 2. Load the agent
launchctl load ~/Library/LaunchAgents/com.courseprints.worker.plist

# 3. Start the agent
launchctl start com.courseprints.worker
```

## Management Commands

### Check Status
```bash
launchctl list | grep com.courseprints.worker
```

### View Logs
```bash
# Standard output
tail -f ~/Library/Logs/courseprints.out.log

# Errors
tail -f ~/Library/Logs/courseprints.err.log

# Both at once
tail -f ~/Library/Logs/courseprints.*.log
```

### Stop the Agent
```bash
launchctl stop com.courseprints.worker
```

### Start the Agent
```bash
launchctl start com.courseprints.worker
```

### Restart the Agent
```bash
launchctl stop com.courseprints.worker
launchctl start com.courseprints.worker
```

### Unload (Remove from Auto-start)
```bash
launchctl unload ~/Library/LaunchAgents/com.courseprints.worker.plist
```

## Configuration

### Update Node.js Path

If your Node.js installation is not at `/usr/local/bin/node`, update the plist:

1. Open `com.courseprints.worker.plist`
2. Change the path in the `ProgramArguments` array
3. Reload: `launchctl unload ~/Library/LaunchAgents/com.courseprints.worker.plist && launchctl load ~/Library/LaunchAgents/com.courseprints.worker.plist`

### Update Polling Interval

Edit `simple-poster-worker-complete.js` and change the `POLL_INTERVAL` value (default: 30000ms = 30 seconds).

### Environment Variables

You can add custom environment variables to the plist in the `EnvironmentVariables` dictionary.

## Troubleshooting

### Agent Won't Start

1. Check the log files:
   ```bash
   cat ~/Library/Logs/courseprints.err.log
   ```

2. Verify Node.js path:
   ```bash
   which node
   /usr/local/bin/node --version
   ```

3. Test the script manually:
   ```bash
   /usr/local/bin/node /Users/redmarwoest/cp-automation-script/index.js
   ```

### Illustrator Issues

- Ensure Illustrator is installed and accessible
- Check that the automation scripts have necessary permissions
- Look for Illustrator-specific errors in the error log

### Agent Keeps Crashing

1. Check KeepAlive behavior - it should restart automatically
2. Review error logs for recurring issues
3. Verify all dependencies are installed: `npm install`

## Verification

After installation, verify the agent is running:

```bash
# Check if it's loaded
launchctl list | grep com.courseprints.worker

# Watch the logs
tail -f ~/Library/Logs/courseprints.out.log
```

You should see output like:
```
🎨 Poster Generation Worker Starting...
Configuration: { POLL_INTERVAL: 30000, ... }
🔍 Checking for queue items...
```

## Security Notes

- The plist runs as your user account (not root)
- Logs are stored in your home directory
- No special permissions required

## References

- [Apple Launch Agent Documentation](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)
- [LaunchAgent vs LaunchDaemon](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html#//apple_ref/doc/uid/10000172i-CH4-SW8)
