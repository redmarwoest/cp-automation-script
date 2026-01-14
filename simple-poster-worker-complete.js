const { generatePoster } = require("./poster-generator");
const { generateMockups } = require("./mockup-generator");

const CONFIG = {
  API_URL: "https://course-prints-store.vercel.app", // Commerce app (for poster_queue)
  COURSE_PRINTS_API_URL: process.env.COURSE_PRINTS_API_URL || "https://course-prints.vercel.app", // Course-prints app (for mockup_queue)
  POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL) || 30000, // 30 seconds
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};

/**
 * Make API request to worker queue endpoint (poster_queue)
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
 * Make API request to mockup queue endpoint (uses course-prints app URL)
 */
async function makeMockupQueueRequest(action, data = {}) {
  const requestBody = { action, ...data };
  const url = `${CONFIG.COURSE_PRINTS_API_URL}/api/mockup-queue`;
  
  log("info", `📤 POST to mockup queue: ${url} (action: ${action})`);
  
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const text = await response.text();
    log("error", `Mockup queue API ${response.status} - Response: ${text.substring(0, 200)}`);
    throw new Error(`Mockup queue API responded with ${response.status}: ${text.substring(0, 100)}`);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    log("error", `Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`);
    throw new Error(`Expected JSON but got ${contentType}. Check if URL is correct: ${url}`);
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

console.log("🎨 Poster & Mockup Generation Worker Starting...");
console.log("Configuration:", CONFIG);

/**
 * Get next pending item from poster queue
 */
async function getNextQueueItem() {
  try {
    // The API supports GET with actions: pending | stats | failed. Use pending to fetch next item.
    const res = await fetch(`${CONFIG.API_URL}/api/worker-queue?action=pending&limit=1`);
    if (!res.ok) throw new Error(`Queue API ${res.status}`);
    const data = await res.json();
    return data.success && Array.isArray(data.items) && data.items.length > 0 ? data.items[0] : null;
  } catch (e) {
    log("error", "Failed to claim poster queue item:", e.message);
    return null;
  }
}

/**
 * Get next pending item from mockup queue (uses course-prints app URL)
 */
async function getNextMockupQueueItem() {
  try {
    const url = `${CONFIG.COURSE_PRINTS_API_URL}/api/mockup-queue?action=pending`;
    log("info", `🔍 Fetching mockup queue from: ${url}`);
    
    const res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
      },
    });
    
    if (!res.ok) {
      const text = await res.text();
      log("error", `Mockup queue API ${res.status} - Response: ${text.substring(0, 200)}`);
      throw new Error(`Mockup queue API ${res.status}: ${text.substring(0, 100)}`);
    }
    
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const text = await res.text();
      log("error", `Expected JSON but got ${contentType}. Response: ${text.substring(0, 200)}`);
      throw new Error(`Expected JSON but got ${contentType}. Check if URL is correct: ${url}`);
    }
    
    const data = await res.json();
    return data.success && Array.isArray(data.items) && data.items.length > 0 ? data.items[0] : null;
  } catch (e) {
    log("error", "Failed to claim mockup queue item:", e.message);
    // Log the URL being used for debugging
    log("error", `Attempted URL: ${CONFIG.COURSE_PRINTS_API_URL}/api/mockup-queue?action=pending`);
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

async function markQueueItemCompleted(queueId, posterPath, fileName, bunnyCDNResult = null, orderId = null, merchandiseId = null) {
  try {
    // Build request data object - explicitly include all fields
    const requestData = {
      queueId: queueId,
      posterPath: posterPath,
      fileName: fileName,
      downloadLink: bunnyCDNResult?.downloadLink || null,  // Explicitly set downloadLink (null if not available)
      orderId: orderId || null,
      merchandiseId: merchandiseId || null,
    };

    // Add BunnyCDN result object if available
    if (bunnyCDNResult) {
      requestData.bunnyCDN = bunnyCDNResult;
    }

    // Log what we're sending
    if (requestData.downloadLink) {
      log("info", `📤 Including BunnyCDN download link in API request: ${requestData.downloadLink}`);
    } else {
      log("warn", `⚠️ No BunnyCDN download link available (upload failed or not configured)`);
      log("warn", `⚠️ Sending downloadLink as null - API should handle this gracefully`);
    }

    log("info", `📤 Sending completion request to API with data:`, JSON.stringify(requestData, null, 2));
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
 * Mark mockup queue item as processing
 */
async function markMockupQueueItemProcessing(queueId) {
  try {
    await makeMockupQueueRequest("start", { queueId });
    return true;
  } catch (error) {
    log("error", "❌ Failed to mark mockup as processing:", error.message);
    return false;
  }
}

/**
 * Mark mockup queue item as completed
 */
async function markMockupQueueItemCompleted(queueId, downloadLinks) {
  try {
    await makeMockupQueueRequest("complete", { queueId, downloadLinks });
    return true;
  } catch (error) {
    log("error", "❌ Failed to mark mockup as completed:", error.message);
    return false;
  }
}

/**
 * Mark mockup queue item as failed
 */
async function markMockupQueueItemFailed(queueId, errorMessage) {
  try {
    await makeMockupQueueRequest("fail", { queueId, error: errorMessage });
    return true;
  } catch (error) {
    log("error", "❌ Failed to mark mockup as failed:", error.message);
    return false;
  }
}

/**
 * Process a single poster queue item: generate poster and handle results
 */
async function processQueueItem(queueItem) {
  const { queueId, orderId, merchandiseId } = queueItem;
  
  log("info", `📝 Processing poster queue item: ${queueId}`);
  log("info", `📦 Order: ${orderId}`);
  log("info", `🛍️ Merchandise: ${merchandiseId}`);

  try {
    // Generate the poster
    const result = await generatePoster(queueItem);

    if (!result.success) {
      throw new Error(result.error || "Poster generation failed");
    }

    // Mark as completed with results (file uploaded to BunnyCDN)
    const marked = await markQueueItemCompleted(queueId, result.posterPath, result.fileName, result.bunnyCDN, orderId, merchandiseId);

    if (!marked) {
      throw new Error("Failed to mark item as completed");
    }

    // Log success
    log("info", `✅ Successfully completed: ${queueId}`);
    log("info", `📄 Local file: ${result.posterPath}`);
    if (result.bunnyCDN?.downloadLink) {
      log("info", `☁️ BunnyCDN download link: ${result.bunnyCDN.downloadLink}`);
      log("info", `📤 Sending download link to API for order: ${orderId}`);
    } else {
      log("warn", `⚠️ No download link available (BunnyCDN upload may have failed)`);
    }
    
    return true;
  } catch (error) {
    log("error", `❌ Failed to process ${queueId}:`, error.message);
    await markQueueItemFailed(queueId, error.message);
    return false;
  }
}

/**
 * Process a single mockup queue item: generate 5 color posters and mockup PNGs
 */
async function processMockupQueueItem(queueItem) {
  const { queueId, courseName } = queueItem;
  
  log("info", `📝 Processing mockup queue item: ${queueId}`);
  log("info", `🏌️ Course: ${courseName}`);

  try {
    // Generate mockups (5 color variants + 5 mockup PNGs)
    const result = await generateMockups(queueItem);

    if (!result.success) {
      throw new Error(result.error || "Mockup generation failed");
    }

    // Mark as completed with download links
    const marked = await markMockupQueueItemCompleted(queueId, result.downloadLinks);

    if (!marked) {
      throw new Error("Failed to mark mockup item as completed");
    }

    // Log success
    log("info", `✅ Successfully completed mockup: ${queueId}`);
    log("info", `📄 Illustrator files: ${result.downloadLinks.illustrator.length}`);
    log("info", `🖼️ Photoshop files: ${result.downloadLinks.photoshop.length}`);
    log("info", `📤 Sending download links to API for queue: ${queueId}`);
    
    return true;
  } catch (error) {
    log("error", `❌ Failed to process mockup ${queueId}:`, error.message);
    await markMockupQueueItemFailed(queueId, error.message);
    return false;
  }
}
/**
 * Main worker loop: check for queue items and process them
 * Prioritizes poster_queue over mockup_queue
 */
async function workerLoop() {
  try {
    log("info", "🔍 Checking for queue items...");

    // Check poster queue first (higher priority)
    let queueItem = await getNextQueueItem();
    let queueType = "poster";

    // If no poster queue items, check mockup queue
    if (!queueItem) {
      queueItem = await getNextMockupQueueItem();
      queueType = "mockup";
    }

    if (!queueItem) {
      log("info", "💤 No items in either queue, waiting...");
      return;
    }

    log("info", `🎯 Found ${queueType} queue item: ${queueItem.queueId}`);

    // Mark as processing
    if (queueType === "poster") {
      await markQueueItemProcessing(queueItem.queueId);
      const success = await processQueueItem(queueItem);
      log("info", success ? "🎉 Poster queue item processed successfully!" : "💥 Poster queue item processing failed");
    } else {
      await markMockupQueueItemProcessing(queueItem.queueId);
      const success = await processMockupQueueItem(queueItem);
      log("info", success ? "🎉 Mockup queue item processed successfully!" : "💥 Mockup queue item processing failed");
    }
  } catch (error) {
    log("error", "❌ Worker loop error:", error.message);
  }
}

/**
 * Start the worker with polling interval
 */
async function startWorker() {
  log("info", "🚀 Starting poster & mockup generation worker...");
  log("info", `⏱️  Polling every ${CONFIG.POLL_INTERVAL}ms`);
  log("info", `📋 Checking both poster_queue and mockup_queue`);
  log("info", `🔗 Poster queue API: ${CONFIG.API_URL}`);
  log("info", `🔗 Mockup queue API: ${CONFIG.COURSE_PRINTS_API_URL}`);

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
  processMockupQueueItem,
};
