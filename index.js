#!/usr/bin/env node

/**
 * Main entry point for the poster generation worker
 * This file exists to provide a clean entry point for the launch agent
 */

// Load environment variables from .env file
require('dotenv').config();

const { startWorker } = require("./simple-poster-worker-complete");

// Start the worker
startWorker().catch((error) => {
  console.error("💥 Worker startup failed:", error);
  process.exit(1);
});
