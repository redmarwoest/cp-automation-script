/**
 * Mockup Generation Module
 * Handles mockup generation: creates 5 color variants using Illustrator, then creates mockup PNGs using Photoshop
 */

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { JSDOM } = require("jsdom");
const { uploadToBunnyCDN } = require("./bunnycdn");
const { colorSchemes } = require("./color-schemes");
const { generatePoster } = require("./poster-generator");

// Get the project root directory
const PROJECT_ROOT = __dirname;

/**
 * Run Photoshop script using AppleScript
 */
function runPhotoshopScript(jsxPath) {
  return new Promise((resolve, reject) => {
    const appleScript = `
      on run argv
        set jsxPOSIX to item 1 of argv
        try
          do shell script "echo [RunPS] argv=" & quoted form of jsxPOSIX
          
          -- confirm file exists
          set existsJSX to do shell script "test -f " & quoted form of jsxPOSIX & " && echo 1 || echo 0"
          if existsJSX is "0" then error "JSX not found: " & jsxPOSIX number -43
          
          set jsxFile to POSIX file jsxPOSIX
          
          -- Check if Photoshop is running, if not launch it
          set psRunning to false
          try
            tell application "System Events"
              set psRunning to (name of processes) contains "Adobe Photoshop"
            end tell
          end try
          
          if not psRunning then
            do shell script "echo [RunPS] Launching Photoshop..."
            tell application id "com.adobe.Photoshop"
              launch
              delay 5 -- Wait for Photoshop to fully launch
            end tell
          end if
          
          -- Now run the script
          tell application id "com.adobe.Photoshop"
            activate
            delay 1 -- Give Photoshop time to activate
            do javascript file jsxFile
          end tell
          
          do shell script "echo [RunPS] success for " & quoted form of jsxPOSIX
        on error errMsg number errNum
          do shell script "echo [RunPS] ERROR " & errNum & ": " & quoted form of errMsg & " 1>&2"
          error errMsg number errNum
        end try
      end run
    `;
    
    execFile(
      "/usr/bin/osascript",
      ["-e", appleScript, jsxPath],
      (error, stdout, stderr) => {
        if (error) return reject(error);
        resolve({ stdout, stderr });
      }
    );
  });
}

/**
 * Generate mockups for a queue item
 * 1. Generate 5 color variant PDFs using Illustrator
 * 2. Create 5 mockup PNGs using Photoshop
 * 3. Upload all files to BunnyCDN
 */
async function generateMockups(queueItem) {
  console.log(`🎨 Generating mockups for queue: ${queueItem.queueId}`);
  console.log(`📋 Course: ${queueItem.courseName}`);

  try {
    const {
      queueId,
      courseName,
      clubName,
      svgMap,
      orientation,
      navigationPosition,
      scorecardPosition,
      scoreCard,
      city,
      state,
      country,
      yearStarted,
    } = queueItem;

    if (!svgMap) {
      throw new Error("No SVG map found for mockup generation");
    }

    // Determine template file based on orientation
    const isHorizontal = orientation === "horizontal";
    const fileName = isHorizontal
      ? "cp-canvas__horizontal__400x500.ai"
      : "cp-canvas__vertical__400x500.ai";

    const templatePath = `/Users/redmarwoest/course-prints/templates/${fileName}`;
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    // Prepare SVG map
    const svgPath = `/Users/redmarwoest/cp-automation-script/temp/selected-course-map.svg`;
    fs.writeFileSync(svgPath, svgMap);

    // Generate 5 color variant PDFs using Illustrator (SEQUENTIALLY)
    const colorNames = ["White", "Navy", "Green", "Blue", "Brown"];
    const illustratorFiles = [];
    const photoshopFiles = [];

    console.log(`🎨 Starting Illustrator generation: 5 color variants (sequential)`);
    
    for (let i = 0; i < colorNames.length; i++) {
      const colorName = colorNames[i];
      console.log(`🎨 [${i + 1}/5] Generating ${colorName} color variant with Illustrator...`);

      // Create a mock queue item for poster generation
      const mockPosterQueueItem = {
        queueId: `${queueId}-${colorName.toLowerCase()}`,
        orderId: `mockup-${queueId}`,
        customizationData: {
          title: courseName,
          subTitle: clubName,
          underTitle: city && state ? `${city}, ${state}` : city || state || country || "",
          selectedCourseMap: svgMap,
          finalColorScheme: colorName,
          orientation: orientation || "vertical",
          navigationPosition: navigationPosition || "left",
          scorecardPosition: scorecardPosition || "left",
          courseData: scoreCard || [],
          scores: [],
          showScorecard: scoreCard && scoreCard.length > 0,
          distanceUnit: country === "USA" ? "Yards" : "Meters",
        },
      };

      // Generate poster PDF (await ensures sequential execution)
      const posterResult = await generatePoster(mockPosterQueueItem);
      
      if (!posterResult.success) {
        throw new Error(`Failed to generate ${colorName} poster: ${posterResult.error}`);
      }

      const pdfPath = posterResult.posterPath;
      illustratorFiles.push(pdfPath);

      console.log(`✅ [${i + 1}/5] Generated ${colorName} poster: ${pdfPath}`);
      
      // Small delay to ensure Illustrator finishes completely before next run
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ All 5 Illustrator PDFs generated successfully`);

    // Upload Illustrator PDFs to BunnyCDN
    console.log(`📤 Uploading Illustrator files to BunnyCDN...`);
    const illustratorUrls = [];
    for (let i = 0; i < illustratorFiles.length; i++) {
      const pdfPath = illustratorFiles[i];
      const colorName = colorNames[i].toLowerCase();
      const remotePath = `mockups/${queueId}/illustrator/${colorName}.pdf`;
      
      try {
        const uploadResult = await uploadToBunnyCDN(pdfPath, remotePath);
        illustratorUrls.push(uploadResult.downloadLink);
        console.log(`✅ Uploaded ${colorName}.pdf: ${uploadResult.downloadLink}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${colorName}.pdf:`, error.message);
        throw error;
      }
    }

    // Generate Photoshop mockups (SEQUENTIALLY - only after all Illustrator runs complete)
    console.log(`🖼️ Starting Photoshop generation: 5 mockups (sequential)`);
    const mockupPdfPaths = illustratorFiles; // Use the same PDFs for mockups
    
    for (let i = 0; i < mockupPdfPaths.length; i++) {
      const pdfPath = mockupPdfPaths[i];
      const colorName = colorNames[i].toLowerCase();
      
      console.log(`🖼️ [${i + 1}/5] Creating mockup for ${colorName} with Photoshop...`);

      // Create Photoshop script
      const mockupJsxPath = path.join(
        PROJECT_ROOT,
        "temp",
        `generateMockup_${queueId}_${colorName}.jsx`
      );

      // Ensure temp directory exists
      const tempDir = path.dirname(mockupJsxPath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const mockupJsxContent = generatePhotoshopScript(pdfPath, queueId, colorName, orientation);
      fs.writeFileSync(mockupJsxPath, mockupJsxContent, "utf8");

      // Run Photoshop script (await ensures sequential execution)
      try {
        await runPhotoshopScript(mockupJsxPath);
        
        // Expected output path
        const mockupPngPath = `/Users/redmarwoest/course-prints/exports/MOCKUP_${queueId}_${colorName}.png`;
        
        if (!fs.existsSync(mockupPngPath)) {
          throw new Error(`Mockup PNG not found after generation: ${mockupPngPath}`);
        }

        photoshopFiles.push(mockupPngPath);
        console.log(`✅ [${i + 1}/5] Generated mockup PNG: ${mockupPngPath}`);

        // Clean up temporary JSX file
        try {
          fs.unlinkSync(mockupJsxPath);
        } catch (e) {
          console.warn(`⚠️ Could not delete temp JSX file: ${mockupJsxPath}`);
        }
        
        // Small delay to ensure Photoshop finishes completely before next run
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`❌ Failed to generate ${colorName} mockup:`, error.message);
        throw error;
      }
    }
    
    console.log(`✅ All 5 Photoshop mockups generated successfully`);

    // Upload Photoshop PNGs to BunnyCDN
    console.log(`📤 Uploading Photoshop mockups to BunnyCDN...`);
    const photoshopUrls = [];
    for (let i = 0; i < photoshopFiles.length; i++) {
      const pngPath = photoshopFiles[i];
      const colorName = colorNames[i].toLowerCase();
      const remotePath = `mockups/${queueId}/photoshop/${colorName}.png`;
      
      try {
        // Upload PNG with correct content type
        const uploadResult = await uploadToBunnyCDN(pngPath, remotePath, "image/png");
        photoshopUrls.push(uploadResult.downloadLink);
        console.log(`✅ Uploaded ${colorName}.png: ${uploadResult.downloadLink}`);
      } catch (error) {
        console.error(`❌ Failed to upload ${colorName}.png:`, error.message);
        throw error;
      }
    }

    return {
      success: true,
      illustratorFiles,
      photoshopFiles,
      downloadLinks: {
        illustrator: illustratorUrls,
        photoshop: photoshopUrls,
      },
    };
  } catch (error) {
    console.error("❌ Mockup generation failed:", error);
    return {
      success: false,
      error: error.message || "Unknown error during mockup generation",
    };
  }
}

/**
 * Generate Photoshop JSX script for creating mockup
 * @param {string} pdfPath - Path to the PDF poster file
 * @param {string} queueId - Queue ID for naming output file
 * @param {string} colorName - Color variant name
 * @param {string} orientation - "vertical" or "horizontal"
 */
function generatePhotoshopScript(pdfPath, queueId, colorName, orientation) {
  const isHorizontal = orientation === "horizontal";
  const templateFileName = isHorizontal ? "Landscape.psd" : "Portrait.psd";
  const templatePath = `/Users/redmarwoest/course-prints/templates/${templateFileName}`;
  const escapedPdfPath = pdfPath.replace(/\\/g, "/");
  const outputPath = `/Users/redmarwoest/course-prints/exports/MOCKUP_${queueId}_${colorName}.png`;
  
  return `
// Photoshop script to create mockup from PDF
// Generated for queue: ${queueId}, color: ${colorName}, orientation: ${orientation}

try {
  // Step 1: Verify PDF file exists
  var pdfFile = new File("${escapedPdfPath}");
  
  if (!pdfFile.exists) {
    throw new Error("PDF file not found: " + pdfFile.fsName);
  }

  // Step 2: Open the appropriate template based on orientation
  var templateFile = new File("${templatePath}");
  
  if (!templateFile.exists) {
    throw new Error("Template file not found: " + templateFile.fsName);
  }
  
  var templateDoc = app.open(templateFile);
  
  // Step 3: Find the "Poster" Smart Object layer
  var posterLayer = null;
  
  // Search in art layers first
  for (var i = 0; i < templateDoc.artLayers.length; i++) {
    var layer = templateDoc.artLayers[i];
    if (layer.name === "Poster" && layer.kind === LayerKind.SMARTOBJECT) {
      posterLayer = layer;
      break;
    }
  }
  
  // If not found in art layers, search in layer sets (groups)
  if (!posterLayer) {
    for (var i = 0; i < templateDoc.layerSets.length; i++) {
      var layerSet = templateDoc.layerSets[i];
      for (var j = 0; j < layerSet.artLayers.length; j++) {
        var layer = layerSet.artLayers[j];
        if (layer.name === "Poster" && layer.kind === LayerKind.SMARTOBJECT) {
          posterLayer = layer;
          break;
        }
      }
      if (posterLayer) break;
    }
  }
  
  if (!posterLayer) {
    templateDoc.close(SaveOptions.DONOTSAVECHANGES);
    throw new Error("Poster layer (Smart Object) not found in template. Make sure there is a layer named 'Poster' that is a Smart Object.");
  }
  
  // Step 4: Replace the Smart Object content with the PDF
  // Select the poster layer
  templateDoc.activeLayer = posterLayer;
  
  // Replace the Smart Object's contents with the PDF file
  // replaceContents expects a File object and optional PlaceOptions
  try {
    var placeOptions = new PDFPlaceOptions();
    placeOptions.resolution = 300; // High resolution for print quality
    placeOptions.mode = OpenDocumentMode.RGB;
    placeOptions.antiAlias = true;
    
    // Replace the Smart Object content with the PDF
    posterLayer.replaceContents(pdfFile, placeOptions);
    
    // Wait a moment for the replacement to complete
    app.refresh();
    
  } catch (replaceError) {
    templateDoc.close(SaveOptions.DONOTSAVECHANGES);
    throw new Error("Failed to replace Smart Object content: " + replaceError.message);
  }
  
  // Step 5: Export the final mockup as PNG
  var outputFile = new File("${outputPath}");
  var exportOptions = new ExportOptionsSaveForWeb();
  exportOptions.format = SaveDocumentType.PNG;
  exportOptions.PNG8 = false; // Use PNG-24
  exportOptions.transparency = true;
  exportOptions.interlaced = false;
  exportOptions.quality = 100;
  
  templateDoc.exportDocument(outputFile, ExportType.SAVEFORWEB, exportOptions);
  
  // Close template without saving changes (keep original template intact)
  templateDoc.close(SaveOptions.DONOTSAVECHANGES);
  
  $.writeln("✅ Mockup generated successfully: " + outputFile.fsName);
} catch (e) {
  $.writeln("❌ Error generating mockup: " + e.message);
  throw e;
}
  `.trim();
}

module.exports = {
  generateMockups,
  runPhotoshopScript,
};
