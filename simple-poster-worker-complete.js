const { generatePoster } = require("./poster-generator");


const CONFIG = {
  API_URL: "https://course-prints-store.vercel.app",
  POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL) || 30000, // 30 seconds
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};

/**
 * Make API request to worker queue endpoint
 */
async function makeQueueRequest(action, data = {}) {
  const requestBody = { action, ...data };
  
  const response = await fetch(`${CONFIG.API_URL}/api/worker-queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }

  return response.json();
}

/**
 * Log with consistent formatting
 */
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...args);
}

console.log("🎨 Poster Generation Worker Starting...");
console.log("Configuration:", CONFIG);

async function getNextQueueItem() {
  try {
    // The API supports GET with actions: pending | stats | failed. Use pending to fetch next item.
    const res = await fetch(`${CONFIG.API_URL}/api/worker-queue?action=pending&limit=1`);
    if (!res.ok) throw new Error(`Queue API ${res.status}`);
    const data = await res.json();
    return data.success && Array.isArray(data.items) && data.items.length > 0 ? data.items[0] : null;
  } catch (e) {
    log("error", "Failed to claim item:", e.message);
    return null;
  }
}
async function markQueueItemProcessing(queueId) {
  try {
    await makeQueueRequest("start", { queueId });
    return true;
  } catch (error) {
    log("error", "❌ Failed to mark processing:", error.message);
    return false;
  }
}

async function markQueueItemCompleted(queueId, posterPath, additionalData = null) {
  try {
    const requestData = {
      queueId,
      posterPath,
    };

    if (additionalData?.driveFile) {
      requestData.driveFile = additionalData.driveFile;
    }

    await makeQueueRequest("complete", requestData);
    return true;
  } catch (error) {
    log("error", "❌ Failed to mark completed:", error.message);
    return false;
  }
}

async function markQueueItemFailed(queueId, errorMessage) {
  try {
    await makeQueueRequest("fail", { queueId, error: errorMessage });
    return true;
  } catch (error) {
    log("error", "❌ Failed to mark failed:", error.message);
    return false;
  }
}

/**
 * Process a single queue item: generate poster and handle results
 */
async function processQueueItem(queueItem) {
  const { queueId, orderId, merchandiseId } = queueItem;
  
  log("info", `📝 Processing queue item: ${queueId}`);
  log("info", `📦 Order: ${orderId}`);
  log("info", `🛍️ Merchandise: ${merchandiseId}`);

  try {
    // Generate the poster
    const result = await generatePoster(queueItem);

    if (!result.success) {
      throw new Error(result.error || "Poster generation failed");
    }

    // Mark as completed with results
    const completionData = {
      posterPath: result.posterPath,
      driveFile: result.driveFile
    };
    
    const marked = await markQueueItemCompleted(queueId, result.posterPath, completionData);

    if (!marked) {
      throw new Error("Failed to mark item as completed");
    }

    // Log success
    log("info", `✅ Successfully completed: ${queueId}`);
    log("info", `📄 Local file: ${result.posterPath}`);
    if (result.driveFile) {
      log("info", `☁️ Google Drive file: ${result.driveFile.viewLink}`);
    }
    
    return true;
  } catch (error) {
    log("error", `❌ Failed to process ${queueId}:`, error.message);
    await markQueueItemFailed(queueId, error.message);
    return false;
  }
}
/**
 * Main worker loop: check for queue items and process them
 */
async function workerLoop() {
  try {
    log("info", "🔍 Checking for queue items...");

    const queueItem = await getNextQueueItem();

    if (!queueItem) {
      log("info", "💤 No items in queue, waiting...");
      return;
    }

    log("info", `🎯 Found queue item: ${queueItem.queueId}`);

    const success = await processQueueItem(queueItem);

    log("info", success ? "🎉 Queue item processed successfully!" : "💥 Queue item processing failed");
  } catch (error) {
    log("error", "❌ Worker loop error:", error.message);
  }
}

/**
 * Start the worker with polling interval
 */
async function startWorker() {
  log("info", "🚀 Starting poster generation worker...");
  log("info", `⏱️  Polling every ${CONFIG.POLL_INTERVAL}ms`);

  // Run initial loop
  await workerLoop();

  // Set up recurring polling
  setInterval(workerLoop, CONFIG.POLL_INTERVAL);
}


function setupGracefulShutdown() {
  const shutdown = (signal) => {
    log("info", `🛑 Received ${signal}, shutting down gracefully...`);
  process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

setupGracefulShutdown();

if (require.main === module) {
  startWorker().catch((error) => {
    log("error", "💥 Worker startup failed:", error);
    process.exit(1);
  });
}

module.exports = {
  startWorker,
  processQueueItem,
};
