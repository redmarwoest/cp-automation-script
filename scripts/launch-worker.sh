#!/bin/zsh

# Launch Adobe Illustrator, wait until it is running, then start the worker

open -ga "Adobe Illustrator"

# Wait for Illustrator to be running
osascript -e 'repeat until application "Adobe Illustrator" is running
  delay 1
end repeat'

# Optional: brief extra delay to ensure app is fully initialized
sleep 2

exec /Users/redmarwoest/.nvm/versions/node/v25.0.0/bin/node /Users/redmarwoest/cp-automation-script/index.js


