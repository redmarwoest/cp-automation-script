/**
 * Poster Generation Module
 * Handles all poster generation functionality using Adobe Illustrator
 */

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { JSDOM } = require("jsdom");
const { uploadToGoogleDrive } = require("./google-drive");
const { colorSchemes } = require("./color-schemes");

function runIllustratorScript(jsxPath) {
  return new Promise((resolve, reject) => {
    const appleScript = `
      on run argv
        set jsxPOSIX to item 1 of argv
        try
          do shell script "echo [RunAI] argv=" & quoted form of jsxPOSIX
          
          -- confirm file exists
          set existsJSX to do shell script "test -f " & quoted form of jsxPOSIX & " && echo 1 || echo 0"
          if existsJSX is "0" then error "JSX not found: " & jsxPOSIX number -43
          
          set jsxFile to POSIX file jsxPOSIX
          
          -- Check if Illustrator is running, if not launch it
          set aiRunning to false
          try
            tell application "System Events"
              set aiRunning to (name of processes) contains "Adobe Illustrator"
            end tell
          end try
          
          if not aiRunning then
            do shell script "echo [RunAI] Launching Illustrator..."
            tell application id "com.adobe.illustrator"
              launch
              delay 3 -- Wait for Illustrator to fully launch
            end tell
          end if
          
          -- Now run the script
          tell application id "com.adobe.illustrator"
            activate
            delay 1 -- Give Illustrator time to activate
            do javascript file jsxFile
          end tell
          
          do shell script "echo [RunAI] success for " & quoted form of jsxPOSIX
        on error errMsg number errNum
          do shell script "echo [RunAI] ERROR " & errNum & ": " & quoted form of errMsg & " 1>&2"
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
 * Generate poster using Adobe Illustrator and upload to Google Drive
 */
async function generatePoster(queueItem) {
  console.log(`🎨 Generating poster for order: ${queueItem.orderId}`);

  try {
    const { customizationData } = queueItem;

    if (!customizationData) {
      throw new Error("No customization data found for order");
    }

    // Parse course data - prioritize scorecard field from PosterQueueData interface
    let parsedCourseData = [];
    if (customizationData.courseData) {
      try {
        parsedCourseData =
          typeof customizationData.courseData === "string"
            ? JSON.parse(customizationData.courseData)
            : customizationData.courseData;
      } catch (e) {
        console.error("Error parsing courseData:", e);
      }
    }

    // Extract data according to PosterQueueData interface
    const {
      title,
      subTitle,
      extraTitle,
      isHorizontal,
      selectedSize,
      color,
      frame,
      navigationPosition,
      scorecardPosition,
      showScorecard,
      distanceUnit,
      underTitle,
      scores,
      scorecard,
      selectedCourseMap, 
    } = customizationData;

    // Prioritize scorecard field from PosterQueueData interface, fallback to legacy courseData
    const courseData = scorecard && scorecard.length > 0 ? scorecard : parsedCourseData;

      console.log("🎯 Processing poster with:");
      console.log(`   📏 Size: ${selectedSize}`);
      console.log(`   🎨 Colors: ${color || 'White (default)'}`);
      console.log(`   🏌️ Course: ${title}`);
      console.log(`   📊 Orientation: ${isHorizontal ? 'Horizontal' : 'Vertical'}`);
      console.log(`   🔍 Scorecard Position: ${scorecardPosition}`);
      console.log(`   🔍 Show Scorecard: ${showScorecard}`);
      console.log(`   🔍 Compass Position: ${navigationPosition}`);
      console.log(`   🔍 Under Title: ${underTitle}`);
      console.log(`   🔍 Extra Title: ${extraTitle}`);
      console.log(`   🔍 Sub Title: ${subTitle}`);
      console.log(`   🔍 Frame: ${frame}`);
      console.log(`   🔍 Distance Unit: ${distanceUnit}`);
      console.log(`   🔍 Scores: ${scores ? scores.length : 0} scores`);
      console.log(`   🔍 Scorecard: ${scorecard ? scorecard.length : 0} holes`);
      console.log(`   🔍 Course Data: ${courseData.length} holes (${scorecard && scorecard.length > 0 ? 'from scorecard' : 'from legacy courseData'})`);
    

    // Format size (exact same logic as generate-poster)
    const formattedSize = selectedSize
      .replace(" cm", "")
      .split(" x ")
      .map(Number)
      .map((n) => Math.round(n * 10))
      .join("x");

    // Use default color scheme if none specified
    const finalColorScheme = color || 'White';
    const colorSchemeData = colorSchemes[finalColorScheme];
    if (!colorSchemeData) {
      throw new Error(`Invalid color scheme: ${finalColorScheme}`);
    }

    // Helper functions (exact same as generate-poster)
    const hexToRgb = (hex) => {
      const normalizedHex = hex.replace("#", "");
      const bigint = parseInt(normalizedHex, 16);
      return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    };

    const backgroundRGB = hexToRgb(colorSchemeData.backgroundColor);
    const outlineInnerRGB = hexToRgb(colorSchemeData.outlineColorInner);
    const outlineOuterRGB = hexToRgb(colorSchemeData.outlineColorOuter);
    const textRGB = hexToRgb(colorSchemeData.textColor);
    const extraTitleRGB = hexToRgb(colorSchemeData.extraTitle);
    const compassRGB = hexToRgb(colorSchemeData.compassColor);
    const fileName = `cp-canvas__${isHorizontal ? "horizontal" : "vertical"}__${formattedSize}.ai`;

    const templatePath = `/Users/redmarwoest/course-prints/templates/${fileName}`;
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file does not exist: ${templatePath}`);
    }

    const svgPath = path.resolve(
      "/Users/redmarwoest/cp-automation-script/temp/selected-course-map.svg"
    );

    // Ensure temp directory exists
    const tempDir = path.dirname(svgPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Decode base64 data URL if needed (using the working approach)
    const decodeBase64DataURL = (dataURL) => {
      if (dataURL.startsWith("data:image/svg+xml;base64,")) {
        try {
          const base64 = dataURL.replace("data:image/svg+xml;base64,", "");
          const decoded = Buffer.from(base64, "base64").toString("utf-8");
          return decoded;
        } catch (error) {
          console.error("Error decoding base64 data URL:", error);
          return dataURL;
        }
      }
      return dataURL;
    };

    const updateSvgColors = (svgString, colors) => {
      // Decode base64 data URL if needed
      const decodedSvg = decodeBase64DataURL(svgString);

      const dom = new JSDOM(decodedSvg, { contentType: "image/svg+xml" });
      const doc = dom.window.document;

      Object.keys(colors).forEach((key) => {
        const elements = doc.querySelectorAll(`#${key}, #${key} *`);

        elements.forEach((element) => {
          if (
            element.tagName === "path" ||
            element.tagName === "polygon" ||
            element.tagName === "circle" ||
            element.tagName === "text" ||
            element.tagName === "rect" ||
            element.tagName === "line" ||
            element.tagName === "polyline"
          ) {
            // Set fill if not already set and not a polyline
            if (element.tagName !== "polyline" && element.hasAttribute("fill")) {
              element.setAttribute("fill", colors[key] || "");
            }

            // Set stroke if not already set
            if (element.hasAttribute("stroke")) {
              element.setAttribute("stroke", colors[key] || "");
            }
          }
        });
      });

      // Handle outline colors for specific elements
      const outlineElements = [
        { elementId: "green", outlineKey: "greenOutline" },
        { elementId: "sand", outlineKey: "sandOutline" },
        { elementId: "fairway", outlineKey: "fairwayOutline" },
        { elementId: "numberContainer", outlineKey: "numberContainerOutline" },
      ];

      outlineElements.forEach(({ elementId, outlineKey }) => {
        if (colors[outlineKey]) {
          const elements = doc.querySelectorAll(`#${elementId}, #${elementId} *`);

          elements.forEach((element) => {
            if (
              element.tagName === "path" ||
              element.tagName === "polygon" ||
              element.tagName === "circle" ||
              element.tagName === "text" ||
              element.tagName === "rect" ||
              element.tagName === "line" ||
              element.tagName === "polyline"
            ) {
              // Apply outline color to stroke
              element.setAttribute("stroke", colors[outlineKey] || "");
            }
          });
        }
      });

      return dom.serialize();
    };

    try {
      const selectedColors = colorSchemes[finalColorScheme];
      const updatedSvg = updateSvgColors(selectedCourseMap, selectedColors);
      fs.writeFileSync(svgPath, updatedSvg);
    } catch (error) {
      console.error("Error processing SVG:", error);
      fs.writeFileSync(svgPath, selectedCourseMap);
    }

    // Create dynamic filename with order ID
    const posterFileName = `ORDER_${queueItem.orderId}_${title.replace(/[^a-zA-Z0-9]/g, '_')}_poster.pdf`;
    
    // Create JSX script (exact same as generate-poster)
    const jsxContent = `
      var file = new File("/Users/redmarwoest/course-prints/templates/${fileName}");
      if (!file.exists) { throw new Error("Template file does not exist: " + file.fsName); }
      var doc = app.open(file);

      function makeRGB(r,g,b){ var c=new RGBColor(); c.red=r; c.green=g; c.blue=b; return c; }

      // Helpers to switch shapes
      function replaceWithCircle(item) {
        if (!item || item.typename !== "PathItem") return item;
        var parent = item.parent;
        var top = item.top, left = item.left, w = item.width, h = item.height;
        var d = Math.min(w,h);
        var cx = left + w/2, cy = top - h/2;
        var cTop = cy + d/2, cLeft = cx - d/2;
        var circle = parent.pathItems.ellipse(cTop, cLeft, d, d);
        circle.filled = item.filled; if (item.filled) circle.fillColor = item.fillColor;
        circle.stroked = item.stroked; if (item.stroked){ circle.strokeColor = item.strokeColor; circle.strokeWidth = item.strokeWidth; }
        circle.name = item.name;
        circle.move(item, ElementPlacement.PLACEBEFORE);
        item.remove();
        return circle;
      }
      function replaceWithRect(item) {
        if (!item || item.typename !== "PathItem") return item;
        var parent = item.parent;
        var b = item.geometricBounds; // [left, top, right, bottom]
        var left = b[0], top = b[1], w = b[2]-b[0], h = b[1]-b[3];
        var rect = parent.pathItems.rectangle(top, left, w, h);
        rect.filled = item.filled; if (item.filled) rect.fillColor = item.fillColor;
        rect.stroked = item.stroked; if (item.stroked){ rect.strokeColor = item.strokeColor; rect.strokeWidth = item.strokeWidth; }
        rect.name = item.name;
        rect.move(item, ElementPlacement.PLACEBEFORE);
        item.remove();
        return rect;
      }

      var textColor = makeRGB(${textRGB.join(",")});
      var extraTitleColor = makeRGB(${extraTitleRGB.join(",")});
      var backgroundColor = makeRGB(${backgroundRGB.join(",")});
      var outlineInnerColor = makeRGB(${outlineInnerRGB.join(",")});
      var outlineOuterColor = makeRGB(${outlineOuterRGB.join(",")});
      var compassColor = makeRGB(${compassRGB.join(",")});

      var textLayer = doc.layers.getByName("text");
      if (textLayer) {
        textLayer.textFrames[0].contents = ${JSON.stringify(title || "")};
        textLayer.textFrames[0].textRange.fillColor = textColor;
        textLayer.textFrames[1].contents = ${JSON.stringify(subTitle || "")};
        textLayer.textFrames[1].textRange.fillColor = textColor;
        textLayer.textFrames[2].contents = ${JSON.stringify(underTitle || "")};
        textLayer.textFrames[2].textRange.fillColor = textColor;
        textLayer.textFrames[3].contents = ${JSON.stringify(extraTitle || "")};
        textLayer.textFrames[3].textRange.fillColor = extraTitleColor;
      }

      try { doc.pageItems.getByName("background").fillColor = backgroundColor; } catch(e) {}

      // Handle outline layer with inner and outer elements
      var outlineLayer = doc.layers.getByName("outline");
      if (outlineLayer) {
        // Target outlineInner element
        try {
          var outlineInnerElement = doc.pageItems.getByName("outlineInner");
          if (outlineInnerElement) {
            outlineInnerElement.strokeColor = outlineInnerColor;
          }
        } catch(e) {}

        // Target outlineOuter element
        try {
          var outlineOuterElement = doc.pageItems.getByName("outlineOuter");
          if (outlineOuterElement) {
            outlineOuterElement.strokeColor = outlineOuterColor;
          }
        } catch(e) {}
      }

      var signatureLayer = doc.layers.getByName("signature");
      if (signatureLayer) {
        for (var i = 0; i < signatureLayer.pageItems.length; i++) {
          signatureLayer.pageItems[i].filled = true;
          signatureLayer.pageItems[i].fillColor = textColor;
        }
        for (var i = 0; i < signatureLayer.compoundPathItems.length; i++) {
          signatureLayer.compoundPathItems[i].filled = true;
          signatureLayer.compoundPathItems[i].fillColor = textColor;
          var cp = signatureLayer.compoundPathItems[i];
          if (cp.pathItems.length > 0) {
            cp.pathItems[0].filled = true;
            cp.pathItems[0].fillColor = textColor;
          }
        }
        for (var k = 0; k < signatureLayer.pathItems.length; k++) {
          signatureLayer.pathItems[k].filled = true;
          signatureLayer.pathItems[k].fillColor = textColor;
        }
      }

      var navigationPosition = "${navigationPosition}";
      var compassLeftLayer = doc.layers.getByName("compasLeft");
      var compassRightLayer = doc.layers.getByName("compasRight");
      if (compassLeftLayer) compassLeftLayer.visible = (navigationPosition === "right");
      if (compassRightLayer) compassRightLayer.visible = (navigationPosition === "left");

      var compassLayerName = navigationPosition === "right" ? "compasLeft" : "compasRight";
      var compassLayer = doc.layers.getByName(compassLayerName);
      if (compassLayer) {
        for (var i = 0; i < compassLayer.compoundPathItems.length; i++) {
          var cp = compassLayer.compoundPathItems[i];
          if (cp.pathItems.length > 0) {
            cp.pathItems[0].filled = true;
            cp.pathItems[0].fillColor = compassColor;
          }
        }
        for (var j = 0; j < compassLayer.pageItems.length; j++) {
          var element = compassLayer.pageItems[j];
          element.fillColor = compassColor;
        }
      }
      
      var scorecardPosition = "${scorecardPosition}";
      var showScorecard = ${showScorecard};

      var scorecardLayers = [
        "scorecard9Left", "scorecard9Right",
        "scorecard18Left", "scorecard18Right",
        "scorecard27Left", "scorecard27Right",
        "scorecard9LeftOwnScore", "scorecard9RightOwnScore",
        "scorecard18LeftOwnScore", "scorecard18RightOwnScore"
      ];

      for (var i = 0; i < scorecardLayers.length; i++) {
        var layer = doc.layers.getByName(scorecardLayers[i]);
        if (layer) layer.visible = false;
      }

      var selectedScorecardLayer = "";
      if (showScorecard) {
        var holeCount = ${courseData ? courseData.length : 18};
        var userScores = ${scores ? JSON.stringify(scores) : "[]"};
        var hasUserScores = userScores.length > 0;
        if (holeCount <= 9) {
          selectedScorecardLayer = scorecardPosition === "left" ? "scorecard9Left" : "scorecard9Right";
          if (hasUserScores) selectedScorecardLayer = scorecardPosition === "left" ? "scorecard9LeftOwnScore" : "scorecard9RightOwnScore";
        } else if (holeCount <= 18) {
          selectedScorecardLayer = scorecardPosition === "left" ? "scorecard18Left" : "scorecard18Right";
          if (hasUserScores) selectedScorecardLayer = scorecardPosition === "left" ? "scorecard18LeftOwnScore" : "scorecard18RightOwnScore";
        } else {
          selectedScorecardLayer = scorecardPosition === "left" ? "scorecard27Left" : "scorecard27Right";
        }
        var selectedLayer = doc.layers.getByName(selectedScorecardLayer);
        if (selectedLayer) selectedLayer.visible = true;
      }

      try {
        var scorecardLayer = doc.layers.getByName(selectedScorecardLayer);
        if (scorecardLayer) {
          var courseData = ${JSON.stringify(courseData)};
          var userScores = ${scores ? JSON.stringify(scores) : "[]"};
          var frontNineParTotal = 0, backNineParTotal = 0, overallParTotal = 0;
          var frontNineDistanceTotal = 0, backNineDistanceTotal = 0, overallDistanceTotal = 0;
          var frontNineScoreTotal = 0, backNineScoreTotal = 0, overallScoreTotal = 0;
          
          var holeCount = courseData.length;
          var maxHoles = holeCount <= 9 ? 9 : (holeCount <= 18 ? 18 : 27);

          for (var i = 0; i < courseData.length && i < maxHoles; i++) {
            var hole = courseData[i];
            var par = hole.par || 4;
            var distance = hole.white || hole.blue || hole.black || hole.yellow || hole.red || hole.gold || hole.green || hole.purple || hole.orange || hole.silver || 0;
            var userScore = userScores[i] || "";

            if (i < 9) {
              frontNineParTotal += par; frontNineDistanceTotal += distance;
              if (userScore !== "") frontNineScoreTotal += parseInt(userScore, 10) || 0;
            } else if (i < 18) {
              backNineParTotal += par; backNineDistanceTotal += distance;
              if (userScore !== "") backNineScoreTotal += parseInt(userScore, 10) || 0;
            }
            overallParTotal += par; overallDistanceTotal += distance;
            if (userScore !== "") overallScoreTotal += parseInt(userScore, 10) || 0;

            for (var j = 0; j < scorecardLayer.textFrames.length; j++) {
              var frame = scorecardLayer.textFrames[j];
              if (frame.contents === "m" + (i + 1)) frame.contents = distance.toString();
              if (frame.contents === "p" + (i + 1)) frame.contents = par.toString();
              if (frame.contents === "s" + (i + 1)) {
                // Persist a stable name so we can reference this exact score later
                try { frame.name = "s" + (i + 1); } catch(e) {}
                frame.contents = userScore.toString();
              }
            }
          }

          // Only Eagle / Birdie get circles; others stay/revert to squares
          for (var k = scorecardLayer.pageItems.length - 1; k >= 0; k--) {
            var item = scorecardLayer.pageItems[k];
            var itemName = item.name;
            if (itemName && itemName.indexOf("bg") !== -1 && itemName.indexOf("s") === 0) {
              var holeNumber = parseInt(itemName.replace("s","").replace("bg",""), 10);
              var holeIndex = holeNumber - 1;
              if (holeIndex < courseData.length) {
                var hole = courseData[holeIndex];
                var par = hole.par || 4;
                var userScore = userScores[holeIndex] || "";

                var shouldFill = false;
                var color = null;
                var makeCircleShape = false;

                if (userScore !== "" && userScore !== null) {
                  var score = parseInt(userScore, 10);
                  var difference = score - par;

                  if (difference <= -2) { shouldFill = true; color = makeRGB(255,107,53); makeCircleShape = true; } // Eagle+
                  else if (difference === -1) { shouldFill = true; color = makeRGB(239,68,68); makeCircleShape = true; } // Birdie
                  else if (difference === 1)  { shouldFill = true; color = makeRGB(26,26,26);  makeCircleShape = false; } // Bogey
                  else if (difference >= 2)   { shouldFill = true; color = makeRGB(59,130,246); makeCircleShape = false; } // Double+
                  else { shouldFill = false; makeCircleShape = false; } // Par
                } else {
                  shouldFill = false; makeCircleShape = false; // No score
                }

                item.filled = shouldFill;
                if (shouldFill) item.fillColor = color;

                // ensure correct shape
                if (makeCircleShape) item = replaceWithCircle(item);
                else item = replaceWithRect(item);

              }
            }
          }

          // Totals
          for (var j = 0; j < scorecardLayer.textFrames.length; j++) {
            var frame = scorecardLayer.textFrames[j];
            if (frame.contents === "mt1")  frame.contents = frontNineDistanceTotal.toString();
            if (frame.contents === "mt2")  frame.contents = backNineDistanceTotal.toString();
            if (frame.contents === "mt12") frame.contents = overallDistanceTotal.toString();
            if (frame.contents === "pt1")  frame.contents = frontNineParTotal.toString();
            if (frame.contents === "pt2")  frame.contents = backNineParTotal.toString();
            if (frame.contents === "pt12") frame.contents = overallParTotal.toString();
            if (frame.contents === "st1")  frame.contents = frontNineScoreTotal > 0 ? frontNineScoreTotal.toString() : "";
            if (frame.contents === "st2")  frame.contents = backNineScoreTotal > 0 ? backNineScoreTotal.toString() : "";
            if (frame.contents === "st12") frame.contents = overallScoreTotal > 0 ? overallScoreTotal.toString() : "";
          }

          // Text color for scorecard
          for (var j = 0; j < scorecardLayer.textFrames.length; j++) {
            scorecardLayer.textFrames[j].textRange.fillColor = textColor;
          }

          // Now set white text for scores that have indicators - use exact same logic as background
          for (var k = scorecardLayer.pageItems.length - 1; k >= 0; k--) {
            var item = scorecardLayer.pageItems[k];
            var itemName = item.name;
            if (itemName && itemName.indexOf("bg") !== -1 && itemName.indexOf("s") === 0) {
              var holeNumber = parseInt(itemName.replace("s","").replace("bg",""), 10);
              var holeIndex = holeNumber - 1;
              if (holeIndex < courseData.length) {
                var hole = courseData[holeIndex];
                var par = hole.par || 4;
                var userScore = userScores[holeIndex] || "";

                var shouldFill = false;
                var color = null;
                var makeCircleShape = false;

                if (userScore !== "" && userScore !== null) {
                  var score = parseInt(userScore, 10);
                  var difference = score - par;

                  if (difference <= -2) { shouldFill = true; color = makeRGB(255,107,53); makeCircleShape = true; } // Eagle+
                  else if (difference === -1) { shouldFill = true; color = makeRGB(239,68,68); makeCircleShape = true; } // Birdie
                  else if (difference === 1)  { shouldFill = true; color = makeRGB(26,26,26);  makeCircleShape = false; } // Bogey
                  else if (difference >= 2)   { shouldFill = true; color = makeRGB(59,130,246); makeCircleShape = false; } // Double+
                  else { shouldFill = false; makeCircleShape = false; } // Par
                } else {
                  shouldFill = false; makeCircleShape = false; // No score
                }

                // If this background has an indicator, make the corresponding score text white
                if (shouldFill) {
                  try {
                    var scoreTextFrame = scorecardLayer.textFrames.getByName("s" + holeNumber);
                    scoreTextFrame.textRange.fillColor = makeRGB(255, 255, 255);
                  } catch(e) {
                    // Fallback to contents matching if named frame is not found
                    for (var l = 0; l < scorecardLayer.textFrames.length; l++) {
                      var textFrame = scorecardLayer.textFrames[l];
                      if (textFrame.contents === userScore) {
                        textFrame.textRange.fillColor = makeRGB(255, 255, 255);
                        break;
                      }
                    }
                  }
                }
              }
            }
          }

          // Update distance unit text (e.g., "Meters" -> distanceUnit value)
          for (var j = 0; j < scorecardLayer.textFrames.length; j++) {
            var frame = scorecardLayer.textFrames[j];
            if (frame.contents === "Meters") {
              var distanceUnit = "${distanceUnit || 'Meters'}";
              // Handle specific cases: yards -> Yards, default to Meters
              var displayUnit;
              if (distanceUnit.toLowerCase() === "yards") {
                displayUnit = "Yards";
              } else {
                displayUnit = "Meters"; // Default/standard
              }
              frame.contents = displayUnit;
            }
          }

          // Strokes
          for (var j = 0; j < scorecardLayer.pageItems.length; j++) {
            try { if (scorecardLayer.pageItems[j].stroked) scorecardLayer.pageItems[j].strokeColor = textColor; } catch(e) {}
          }
        }
      } catch(e) {}

      // Paste recolored SVG into map placeholder
      var svgFile = new File("/Users/redmarwoest/cp-automation-script/temp/selected-course-map.svg");
      var svgDoc = app.open(svgFile);
      svgDoc.selection = null; svgDoc.selectObjectsOnActiveArtboard(); app.copy();
      svgDoc.close(SaveOptions.DONOTSAVECHANGES);

      try {
        var mapLayer = doc.layers.getByName("map");
        var mapElement = doc.pageItems.getByName("map");
        if (mapElement) {
          doc.activate(); doc.selection = null;
          try { mapElement.selected = true; app.paste(); } catch(e) {}
        }
      } catch(e) {}

      try {
        var pastedItems = doc.selection;
        if (pastedItems.length > 0) {
          try {
            app.executeMenuCommand('group');
            var groupedMap = doc.selection[0];

            var mapBounds = groupedMap.geometricBounds;
            var mapWidth = mapBounds[2] - mapBounds[0];
            var mapHeight = mapBounds[1] - mapBounds[3];

            mapElement = doc.pageItems.getByName("map");
            if (mapElement) {
              mapElement.filled = false;
              var mapElementBounds = mapElement.geometricBounds;
              var mapElementWidth = mapElementBounds[2] - mapElementBounds[0];
              var mapElementHeight = mapElementBounds[1] - mapElementBounds[3];

              var scaleX = mapElementWidth / mapWidth;
              var scaleY = mapElementHeight / mapHeight;
              var scale = Math.min(scaleX, scaleY);
              groupedMap.resize(scale * 100, scale * 100);

              var mapElementCenterX = (mapElementBounds[0] + mapElementBounds[2]) / 2;
              var mapElementCenterY = (mapElementBounds[1] + mapElementBounds[3]) / 2;

              var newBounds = groupedMap.geometricBounds;
              var newWidth = newBounds[2] - newBounds[0];
              var newHeight = newBounds[1] - newBounds[3];

              var centerX = mapElementCenterX - (newWidth / 2);
              var centerY = mapElementCenterY + (newHeight / 2);
              groupedMap.position = [centerX, centerY];
            }
          } catch(e) {}
        }
      } catch(e) {}

      var exportFolder = Folder("/Users/redmarwoest/course-prints/exports");
      if (!exportFolder.exists) { exportFolder.create(); }
      var exportFile = new File(exportFolder.fsName + "/${posterFileName}");

      var saveOptions = new PDFSaveOptions();
      saveOptions.compatibility = PDFCompatibility.ACROBAT5;
      saveOptions.generateThumbnails = true;
      saveOptions.preserveEditability = false;
      saveOptions.viewAfterSaving = false;
      saveOptions.optimization = true;
      saveOptions.pDFPreset = "[High Quality Print]";

      doc.saveAs(exportFile, saveOptions);
      doc.close(SaveOptions.SAVECHANGES);
      $.sleep(2000);
    `;

    // Write JSX script and run it
    const jsxPath = path.resolve("./scripts/generatePoster.jsx");
    const scriptsDir = path.dirname(jsxPath);
    if (!fs.existsSync(scriptsDir)) {
      fs.mkdirSync(scriptsDir, { recursive: true });
    }
    fs.writeFileSync(jsxPath, jsxContent);

    console.log("🚀 Running Adobe Illustrator script...");
    const { stdout } = await runIllustratorScript(jsxPath);
    if (stdout) console.log("RunAI stdout:\n" + stdout);

    console.log("🧭 JSX path:", jsxPath);

    const localPosterPath = `/Users/redmarwoest/course-prints/exports/${posterFileName}`;
    console.log("✅ Poster generated successfully");
    console.log(`📄 Local file: ${localPosterPath}`);

    // Upload to Google Drive
    let driveUploadResult = null;
    try {
      driveUploadResult = await uploadToGoogleDrive(localPosterPath, posterFileName, queueItem.orderId);
      console.log("✅ Google Drive upload completed successfully");
    } catch (error) {
      console.error("⚠️ Google Drive upload failed, but poster was created locally:", error.message);
      // Continue execution - local file is still available
    }

    return {
      success: true,
      posterPath: localPosterPath,
      fileName: posterFileName,
      driveFile: driveUploadResult,
      stdout,
    };
  } catch (error) {
    console.error("❌ Poster generation failed:", error);
    throw error;
  }
}

module.exports = {
  generatePoster,
  runIllustratorScript,
  colorSchemes,
};
