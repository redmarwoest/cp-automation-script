// Photoshop script to create mockup from PDF
// Generated for queue: mockup-1769075074612-lsrn9ueqd, color: green, orientation: vertical
try {
  // Step 1: Verify PDF file exists
  var pdfFile = new File("/Users/redmarwoest/course-prints/exports/ORDER_mockup-mockup-1769075074612-lsrn9ueqd_Mediterraneo_Golf_1769075189428_poster.pdf");
  
  if (!pdfFile.exists) {
    throw new Error("PDF file not found: " + pdfFile.fsName);
  }

  // Step 2: Open the appropriate template based on orientation
  var templateFile = new File("/Users/redmarwoest/course-prints/templates/Portrait.psd");
  
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

  var outputFile = new File("/Users/redmarwoest/course-prints/exports/MOCKUP_mockup-1769075074612-lsrn9ueqd_green.png");
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