# Quick Status Check

## How to Check if the Agent is Running

Run the status check script:
```bash
./check-status.sh
```

Or check manually:

```bash
# Check if agent is loaded
launchctl list | grep com.courseprints.worker

# View recent logs
tail -20 ~/Library/Logs/courseprints.out.log

# View errors
tail -20 ~/Library/Logs/courseprints.err.log

# Follow logs in real-time
tail -f ~/Library/Logs/courseprints.out.log
```

## Current Status

✅ **Agent is configured and running**

The agent is set up to:
- Run continuously as a background service
- Auto-start on login
- Poll for poster generation jobs every 30 seconds
- Use the Node.js installation at `/Users/redmarwoest/.nvm/versions/node/v25.0.0/bin/node`
- Generate posters using Adobe Illustrator
- Upload to Google Drive

## Management Commands

### Start
```bash
launchctl start com.courseprints.worker
```

### Stop
```bash
launchctl stop com.courseprints.worker
```

### Restart
```bash
launchctl stop com.courseprints.worker && launchctl start com.courseprints.worker
```

### Unload (remove auto-start)
```bash
launchctl unload ~/Library/LaunchAgents/com.courseprints.worker.plist
```

## Troubleshooting

If the agent stops working, check:
1. Node.js is accessible at `/Users/redmarwoest/.nvm/versions/node/v25.0.0/bin/node`
2. Adobe Illustrator is installed
3. Log files in `~/Library/Logs/` for error messages
4. Run `./check-status.sh` for a detailed status report
