/**
 * Photoshop Script Template for Generating Mockups
 * 
 * This is a template file showing how to create mockups from PDF posters.
 * Customize this based on your Photoshop mockup template structure.
 * 
 * The script will be called with:
 * - pdfPath: Path to the PDF poster file
 * - outputPath: Where to save the final PNG mockup
 */

// Example implementation - customize based on your needs
try {
  // Get the PDF path from arguments (if passed)
  // In practice, this will be embedded in the dynamically generated script
  var pdfPath = arguments[0] || "/path/to/poster.pdf";
  var outputPath = arguments[1] || "/path/to/output.png";
  
  // Open the PDF poster
  var pdfFile = new File(pdfPath);
  if (!pdfFile.exists) {
    throw new Error("PDF file not found: " + pdfFile.fsName);
  }

  var pdfOptions = new PDFOpenOptions();
  pdfOptions.resolution = 300;
  pdfOptions.mode = OpenDocumentMode.RGB;
  pdfOptions.antiAlias = true;
  
  var pdfDoc = app.open(pdfFile, pdfOptions);
  
  // TODO: CUSTOMIZE THIS SECTION
  // 
  // If you have a mockup template PSD:
  // 1. Open your template
  // 2. Place the PDF as a smart object
  // 3. Position and scale
  // 4. Export
  
  // Example with template (uncomment and customize):
  /*
  var templateFile = new File("/Users/redmarwoest/course-prints/templates/mockup-template.psd");
  var templateDoc = app.open(templateFile);
  
  // Copy PDF content
  pdfDoc.selection.selectAll();
  pdfDoc.selection.copy();
  pdfDoc.close(SaveOptions.DONOTSAVECHANGES);
  
  // Paste into template
  templateDoc.activate();
  var placeholderLayer = templateDoc.artLayers.getByName("Poster Placeholder");
  if (placeholderLayer) placeholderLayer.visible = false;
  
  templateDoc.paste();
  var pastedLayer = templateDoc.activeLayer;
  
  // Position and scale (adjust as needed)
  // pastedLayer.translate(100, 100);
  // pastedLayer.resize(80, 80, AnchorPosition.MIDDLECENTER);
  
  // Export
  var outputFile = new File(outputPath);
  templateDoc.exportDocument(outputFile, ExportType.SAVEFORWEB, new ExportOptionsSaveForWeb());
  templateDoc.close(SaveOptions.DONOTSAVECHANGES);
  */
  
  // Simple export (current fallback - no template)
  var outputFile = new File(outputPath);
  var exportOptions = new ExportOptionsSaveForWeb();
  exportOptions.format = SaveDocumentType.PNG;
  exportOptions.PNG8 = false;
  exportOptions.transparency = true;
  exportOptions.interlaced = false;
  exportOptions.quality = 100;
  
  pdfDoc.exportDocument(outputFile, ExportType.SAVEFORWEB, exportOptions);
  pdfDoc.close(SaveOptions.DONOTSAVECHANGES);
  
  $.writeln("✅ Mockup generated: " + outputFile.fsName);
} catch (e) {
  $.writeln("❌ Error: " + e.message);
  throw e;
}
