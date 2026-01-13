/**
 * BunnyCDN Storage Upload Module
 * Handles file uploads to BunnyCDN Storage
 */

const fs = require("fs");

// Configuration - read from environment at runtime
function getConfig() {
  return {
    STORAGE_ZONE_NAME: process.env.BUNNYCDN_STORAGE_ZONE_NAME || null,
    STORAGE_ACCESS_KEY: process.env.BUNNYCDN_STORAGE_ACCESS_KEY || null,
    PULL_ZONE_URL: process.env.BUNNYCDN_PULL_ZONE_URL || null, // e.g., https://mypullzone.b-cdn.net
  };
}

// Keep CONFIG for backward compatibility, but it will be read at runtime
const CONFIG = getConfig();

/**
 * Upload file to BunnyCDN Storage
 * @param {string} filePath - Local path to the file
 * @param {string} remotePath - Path in storage zone (e.g., "posters/order-123.pdf")
 * @returns {Promise<{filePath: string, downloadLink: string}>}
 */
async function uploadToBunnyCDN(filePath, remotePath) {
  try {
    // Read config at runtime to ensure environment variables are loaded
    const config = getConfig();
    
    if (!config.STORAGE_ZONE_NAME) {
      throw new Error("BUNNYCDN_STORAGE_ZONE_NAME environment variable is required");
    }
    if (!config.STORAGE_ACCESS_KEY) {
      throw new Error("BUNNYCDN_STORAGE_ACCESS_KEY environment variable is required");
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    console.log(`📤 Uploading to BunnyCDN Storage: ${remotePath}`);

    // Ensure remote path doesn't start with /
    const cleanRemotePath = remotePath.startsWith("/") ? remotePath.slice(1) : remotePath;

    // Read file buffer
    const fileBuffer = fs.readFileSync(filePath);

    // Upload to BunnyCDN Storage
    const storageUrl = `https://storage.bunnycdn.com/${config.STORAGE_ZONE_NAME}/${cleanRemotePath}`;

    const response = await fetch(storageUrl, {
      method: "PUT",
      headers: {
        AccessKey: config.STORAGE_ACCESS_KEY,
        "Content-Type": "application/pdf",
      },
      body: fileBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BunnyCDN upload failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Generate download link
    let downloadLink = null;
    if (config.PULL_ZONE_URL) {
      // Use custom pull zone URL if provided
      downloadLink = `${config.PULL_ZONE_URL}/${cleanRemotePath}`;
    } else {
      // Fallback to default storage URL (may require authentication)
      downloadLink = `https://storage.bunnycdn.com/${config.STORAGE_ZONE_NAME}/${cleanRemotePath}`;
    }

    console.log(`✅ File uploaded successfully to BunnyCDN`);
    console.log(`📥 Download link: ${downloadLink}`);

    return {
      filePath: cleanRemotePath,
      downloadLink: downloadLink,
      storageZone: config.STORAGE_ZONE_NAME,
    };
  } catch (error) {
    console.error("❌ BunnyCDN upload failed:", error.message);
    throw error;
  }
}

/**
 * Check BunnyCDN configuration
 */
function checkBunnyCDNSetup() {
  const config = getConfig();
  const issues = [];

  if (!config.STORAGE_ZONE_NAME) {
    issues.push("BUNNYCDN_STORAGE_ZONE_NAME environment variable is not set");
  }
  if (!config.STORAGE_ACCESS_KEY) {
    issues.push("BUNNYCDN_STORAGE_ACCESS_KEY environment variable is not set");
  }
  if (!config.PULL_ZONE_URL) {
    console.log("⚠️ BUNNYCDN_PULL_ZONE_URL not set - using storage URL (may require authentication)");
  }

  if (issues.length > 0) {
    console.error("❌ BunnyCDN configuration issues:");
    issues.forEach((issue) => console.error(`   - ${issue}`));
    return false;
  }

  console.log("✅ BunnyCDN configuration looks good");
  return true;
}

module.exports = {
  uploadToBunnyCDN,
  checkBunnyCDNSetup,
  CONFIG: CONFIG,
};

