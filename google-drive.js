/**
 * Google Drive Upload Module
 * Handles all Google Drive functionality for poster uploads
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

// Configuration
const CONFIG = {
  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || null,
  SERVICE_ACCOUNT_PATH: path.join(__dirname, "service-account-key.json"),
};

/**
 * Initialize Google Drive API client with service account
 */
function initializeGoogleDrive() {
  try {
    if (!fs.existsSync(CONFIG.SERVICE_ACCOUNT_PATH)) {
      throw new Error(`Service account file not found: ${CONFIG.SERVICE_ACCOUNT_PATH}`);
    }

    const credentials = JSON.parse(fs.readFileSync(CONFIG.SERVICE_ACCOUNT_PATH, 'utf8'));
    
    const auth = new google.auth.GoogleAuth({
      credentials: credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const drive = google.drive({ version: 'v3', auth });
    
    console.log("✅ Google Drive API initialized successfully");
    return drive;
  } catch (error) {
    console.error("❌ Failed to initialize Google Drive API:", error.message);
    throw error;
  }
}

/**
 * Upload file to Google Drive (handles shared drives)
 */
async function uploadToGoogleDrive(filePath, fileName, orderId) {
  try {
    console.log(`📤 Uploading ${fileName} to Google Drive...`);
    
    const drive = initializeGoogleDrive();
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileMetadata = {
      name: fileName,
      description: `Course print poster for order ${orderId}`,
    };

    // If GOOGLE_DRIVE_FOLDER_ID is set, use it (this should be a shared drive folder)
    if (CONFIG.GOOGLE_DRIVE_FOLDER_ID) {
      fileMetadata.parents = [CONFIG.GOOGLE_DRIVE_FOLDER_ID];
    }

    const media = {
      mimeType: 'application/pdf',
      body: fs.createReadStream(filePath),
    };

    const requestOptions = {
      requestBody: fileMetadata,
      media: media,
      fields: 'id,name,webViewLink,webContentLink',
    };

    // If uploading to a shared drive, add the supportsAllDrives parameter
    if (CONFIG.GOOGLE_DRIVE_FOLDER_ID) {
      requestOptions.supportsAllDrives = true;
    }

    const response = await drive.files.create(requestOptions);

    const file = response.data;
    
    console.log(`✅ File uploaded successfully to Google Drive`);
    console.log(`📄 File ID: ${file.id}`);
    console.log(`🔗 View Link: ${file.webViewLink}`);
    console.log(`📥 Download Link: ${file.webContentLink}`);

    return {
      fileId: file.id,
      fileName: file.name,
      viewLink: file.webViewLink,
      downloadLink: file.webContentLink,
    };
  } catch (error) {
    console.error("❌ Google Drive upload failed:", error.message);
    
    // Provide helpful error messages for common issues
    if (error.message.includes('storage quota')) {
      console.error('💡 Solution: You need to use a shared Google Drive. Please:');
      console.error('   1. Create a shared drive in Google Drive');
      console.error('   2. Add your service account as a member');
      console.error('   3. Set GOOGLE_DRIVE_FOLDER_ID to a folder in that shared drive');
    }
    
    throw error;
  }
}

/**
 * Share Google Drive file with specific email (optional)
 */
async function shareGoogleDriveFile(fileId, email, role = 'reader') {
  try {
    const drive = initializeGoogleDrive();
    
    const shareOptions = {
      fileId: fileId,
      requestBody: {
        role: role,
        type: 'user',
        emailAddress: email,
      },
    };

    // Support shared drives
    if (CONFIG.GOOGLE_DRIVE_FOLDER_ID) {
      shareOptions.supportsAllDrives = true;
    }

    await drive.permissions.create(shareOptions);

    console.log(`✅ File shared with ${email} as ${role}`);
  } catch (error) {
    console.error(`❌ Failed to share file with ${email}:`, error.message);
    throw error;
  }
}

/**
 * Check Google Drive configuration and connectivity
 */
async function checkGoogleDriveSetup() {
  try {
    console.log("🔍 Checking Google Drive setup...");
    
    // Check service account file
    if (!fs.existsSync(CONFIG.SERVICE_ACCOUNT_PATH)) {
      throw new Error("Service account file not found");
    }
    console.log("✅ Service account file found");

    // Check credentials format
    const credentials = JSON.parse(fs.readFileSync(CONFIG.SERVICE_ACCOUNT_PATH, 'utf8'));
    if (!credentials.client_email || !credentials.private_key) {
      throw new Error("Invalid service account format");
    }
    console.log("✅ Service account credentials valid");

    // Test API connection
    const drive = initializeGoogleDrive();
    await drive.about.get({ fields: 'user' });
    console.log("✅ Google Drive API connection successful");

    // Check folder configuration
    if (CONFIG.GOOGLE_DRIVE_FOLDER_ID) {
      console.log(`✅ Target folder ID configured: ${CONFIG.GOOGLE_DRIVE_FOLDER_ID}`);
    } else {
      console.log("⚠️ No target folder configured (will upload to root)");
    }

    return true;
  } catch (error) {
    console.error("❌ Google Drive setup check failed:", error.message);
    return false;
  }
}

module.exports = {
  uploadToGoogleDrive,
  shareGoogleDriveFile,
  initializeGoogleDrive,
  checkGoogleDriveSetup,
  CONFIG: CONFIG,
};
