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
    // Template files use pixel dimensions: 40x50cm = 400x500px, 50x40cm = 500x400px
    // But we only have 400x500 templates, so we use those for both orientations
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
    // Ensure temp directory exists
    const tempDir = path.dirname(svgPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
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
      const isHorizontal = orientation === "horizontal";
      // Set size based on orientation: horizontal = 50x40cm, vertical = 40x50cm
      const selectedSize = isHorizontal ? "50 x 40 cm" : "40 x 50 cm";
      
      const mockPosterQueueItem = {
        queueId: `${queueId}-${colorName.toLowerCase()}`,
        orderId: `mockup-${queueId}`,
        customizationData: {
          title: courseName,
          subTitle: clubName,
          underTitle: city && state ? `${city}, ${state}` : city || state || country || "",
          selectedCourseMap: svgMap,
          selectedSize: selectedSize,
          isHorizontal: isHorizontal,
          color: colorName, // Use color instead of finalColorScheme
          navigationPosition: navigationPosition || "left",
          scorecardPosition: scorecardPosition || "left",
          courseData: scoreCard || [],
          scorecard: scoreCard || [], // Also provide scorecard field
          scores: [],
          showScorecard: scoreCard && scoreCard.length > 0,
          distanceUnit: country === "USA" ? "yards" : "meters",
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
  
  // Open the template file (main mockup document)
  var templateDoc = app.open(templateFile);
  
  // Wait a moment for the document to fully load
  app.refresh();
  $.sleep(500);
  
  // Step 3: Find the "PosterPlaceholder" Smart Object layer inside the Poster group
  // Try multiple possible names
  var possibleNames = ["PosterPlaceholder", "Poster", "Poster11", "Poster 11", "Placeholder"];
  
  function findPosterPlaceholder(parent, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 10) return null; // Prevent infinite recursion
    
    for (var i = 0; i < parent.layers.length; i++) {
      var lyr = parent.layers[i];
      
      // Check if this is a Smart Object layer
      if (lyr.typename === "ArtLayer" && lyr.kind === LayerKind.SMARTOBJECT) {
        // Check against all possible names
        for (var j = 0; j < possibleNames.length; j++) {
          if (lyr.name === possibleNames[j]) {
            $.writeln("Found Smart Object: " + lyr.name);
            return lyr;
          }
        }
      }
      
      // Recursively search in layer sets
      if (lyr.typename === "LayerSet") {
        var found = findPosterPlaceholder(lyr, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }
  
  // Also try to find any Smart Object as fallback
  function findAnySmartObject(parent, depth) {
    if (depth === undefined) depth = 0;
    if (depth > 10) return null;
    
    for (var i = 0; i < parent.layers.length; i++) {
      var lyr = parent.layers[i];
      if (lyr.typename === "ArtLayer" && lyr.kind === LayerKind.SMARTOBJECT) {
        $.writeln("Found Smart Object (fallback): " + lyr.name);
        return lyr;
      }
      if (lyr.typename === "LayerSet") {
        var found = findAnySmartObject(lyr, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  var posterLayer = findPosterPlaceholder(templateDoc);
  
  // If not found, try to find any Smart Object as fallback
  if (!posterLayer) {
    $.writeln("PosterPlaceholder not found, searching for any Smart Object...");
    posterLayer = findAnySmartObject(templateDoc);
  }
  
  if (!posterLayer) {
    // List all top-level layers for debugging
    $.writeln("Available layers in template:");
    for (var i = 0; i < templateDoc.layers.length; i++) {
      var lyr = templateDoc.layers[i];
      $.writeln("  Layer " + i + ": " + lyr.name + " (" + lyr.typename + ")");
    }
    templateDoc.close(SaveOptions.DONOTSAVECHANGES);
    throw new Error("PosterPlaceholder Smart Object not found in template. Check layer names.");
  }

  // Step 4: Open the Smart Object contents (PosterXX.psb)
  templateDoc.activeLayer = posterLayer;
  app.refresh();
  $.sleep(200);

  // Use the standard menu command to edit Smart Object contents
  app.runMenuItem(stringIDToTypeID("placedLayerEditContents"));

  // Now the active document is the Smart Object document (e.g. Poster11.psb)
  var posterDoc = app.activeDocument;
  app.refresh();
  $.sleep(300);

  // Step 5: Open the PDF, copy its contents, and paste into the Smart Object document
  try {
    // Open the PDF file as a new document without showing the import dialog
    var pdfOpenOptions = new PDFOpenOptions();
    pdfOpenOptions.antiAlias = true;
    pdfOpenOptions.mode = OpenDocumentMode.RGB;
    pdfOpenOptions.resolution = 300;
    // If the PDF has multiple pages, use the first page by default
    try {
      pdfOpenOptions.page = 1;
    } catch (optErr) {
      // ignore if property not supported
    }
    var pdfDoc = app.open(pdfFile, pdfOpenOptions);
    app.refresh();
    $.sleep(500);
    // Select all layers in the PDF document
    pdfDoc.activeLayer = pdfDoc.layers[0];
    pdfDoc.selection.selectAll();
    
    // Copy all content
    pdfDoc.selection.copy();
    app.refresh();
    $.sleep(200);
    
    // Close the PDF document without saving
    pdfDoc.close(SaveOptions.DONOTSAVECHANGES);
    app.refresh();
    $.sleep(200);

    // Switch back to Smart Object document
    app.activeDocument = posterDoc;
    app.refresh();
    $.sleep(200);

    // Deselect everything first
    posterDoc.selection.deselect();
    app.refresh();
    $.sleep(100);

    // Hide all existing layers instead of deleting (safer approach)
    for (var i = 0; i < posterDoc.artLayers.length; i++) {
      try {
        posterDoc.artLayers[i].visible = false;
      } catch (e) {}
    }
    app.refresh();
    $.sleep(100);

    // Paste the PDF content into the Smart Object (creates new layer on top)
    posterDoc.paste();
    app.refresh();
    $.sleep(500);

    // Get the pasted layer
    var pastedLayer = posterDoc.activeLayer;
    if (pastedLayer) {
      // Rename it to "Poster" for clarity
      pastedLayer.name = "Poster";

      // Resize and center the poster layer to fit the Smart Object canvas
      // Make sure the layer is active
      posterDoc.activeLayer = pastedLayer;
      app.refresh();
      $.sleep(200);
      
      // Deselect any active selection (this can interfere with resize)
      try {
        posterDoc.selection.deselect();
      } catch (e) {
        // Ignore if no selection exists
      }
      app.refresh();
      $.sleep(100);
      
      // Get document dimensions (placeholder size) - convert to pixels
      var docW = posterDoc.width.value;
      var docH = posterDoc.height.value;
      
      // Get current layer dimensions
      var b = pastedLayer.bounds;
      var layerW = b[2].value - b[0].value;
      var layerH = b[3].value - b[1].value;
      
      if (layerW > 0 && layerH > 0 && docW > 0 && docH > 0) {
        // Calculate scales for both dimensions
        var scaleX = docW / layerW;  // Scale to fit width exactly
        var scaleY = docH / layerH;  // Scale to fit height exactly
        
        // Strategy: Fill vertically completely, but ensure no horizontal overflow
        // Use scaleY to fill vertical space, but check if it overflows horizontally
        var scale = scaleY; // Start with vertical fill
        
        // Check if using scaleY would cause horizontal overflow
        var scaledWidth = layerW * scale;
        if (scaledWidth > docW) {
          // If vertical fill would overflow horizontally, use horizontal fit instead
          // This ensures no overflow, but might leave some vertical space
          scale = scaleX;
        }
        
        // Resize the layer using the calculated scale
        // This maintains aspect ratio while fitting the frame
        try {
          pastedLayer.resize(scale * 100, scale * 100, AnchorPosition.MIDDLECENTER);
          app.refresh();
          $.sleep(300);
          
          // After resize, check if we need to stretch vertically further
          // Get the new bounds after resize
          var newBounds = pastedLayer.bounds;
          var newLayerH = newBounds[3].value - newBounds[1].value;
          
          // If the layer height is less than document height, we can stretch vertically
          // But only if width still fits
          if (newLayerH < docH) {
            var newLayerW = newBounds[2].value - newBounds[0].value;
            if (newLayerW <= docW) {
              // We have room to stretch vertically without overflowing horizontally
              // Calculate additional vertical stretch needed
              var additionalScaleY = docH / newLayerH;
              // Apply additional vertical stretch
              pastedLayer.resize(100, additionalScaleY * 100, AnchorPosition.MIDDLECENTER);
              app.refresh();
              $.sleep(300);
            }
          }
        } catch (resizeError) {
          $.writeln("Warning: resize() failed, trying alternative method: " + resizeError.message);
          // Alternative: calculate new dimensions and resize
          var newW = layerW * scale;
          var newH = layerH * scale;
          // Resize using UnitValue
          var unitW = new UnitValue(newW, "px");
          var unitH = new UnitValue(newH, "px");
          pastedLayer.resize(unitW, unitH, AnchorPosition.MIDDLECENTER);
          app.refresh();
          $.sleep(300);
        }
        
        // Center the layer on the canvas
        var nb = pastedLayer.bounds;
        var layerCenterX = (nb[0].value + nb[2].value) / 2;
        var layerCenterY = (nb[1].value + nb[3].value) / 2;
        var docCenterX = docW / 2;
        var docCenterY = docH / 2;
        
        var offsetX = docCenterX - layerCenterX;
        var offsetY = docCenterY - layerCenterY;
        
        if (Math.abs(offsetX) > 0.1 || Math.abs(offsetY) > 0.1) {
          pastedLayer.translate(offsetX, offsetY);
          app.refresh();
          $.sleep(200);
        }
      }
    }
    
    app.refresh();
    $.sleep(200);
    
  } catch (replaceError) {
    // Close Smart Object and template if error occurs
    try {
      posterDoc.close(SaveOptions.DONOTSAVECHANGES);
    } catch (e) {}
    try {
      templateDoc.close(SaveOptions.DONOTSAVECHANGES);
    } catch (e) {}
    throw new Error("Failed to replace Smart Object content: " + replaceError.message);
  }
  
  // Step 6: Save and close the Smart Object document so the mockup updates
  posterDoc.save();
  posterDoc.close(SaveOptions.SAVECHANGES);
  app.refresh();
  $.sleep(300);

  // Step 7: Export the final mockup as PNG from the main template document
  app.activeDocument = templateDoc;
  app.refresh();

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
