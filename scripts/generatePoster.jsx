
      var file = new File("/Users/redmarwoest/course-prints/templates/cp-canvas__vertical__400x500.ai");
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

      var textColor = makeRGB(255,255,255);
      var extraTitleColor = makeRGB(154,126,46);
      var backgroundColor = makeRGB(180,179,168);
      var outlineInnerColor = makeRGB(154,154,154);
      var outlineOuterColor = makeRGB(35,31,32);
      var compassColor = makeRGB(255,255,255);

      var textLayer = doc.layers.getByName("text");
      if (textLayer) {
        // Set text contents - JSON.stringify properly escapes quotes and preserves Unicode characters
        // The JSX file is saved with UTF-8 encoding, so Unicode characters should render correctly
        textLayer.textFrames[0].contents = "Bridgewater On Loddon Golf Club";
        textLayer.textFrames[0].textRange.fillColor = textColor;
        // Disable All Caps / Small Caps to preserve original capitalization
        try {
          textLayer.textFrames[0].textRange.characterAttributes.capitalization = TextCase.NORMAL;
        } catch(e) {}
        
        textLayer.textFrames[1].contents = "Bridgewater On Loddon Golf Club";
        textLayer.textFrames[1].textRange.fillColor = textColor;
        try {
          textLayer.textFrames[1].textRange.characterAttributes.capitalization = TextCase.NORMAL;
        } catch(e) {}
        
        textLayer.textFrames[2].contents = "3516 Yagoona, VIC";
        textLayer.textFrames[2].textRange.fillColor = textColor;
        try {
          textLayer.textFrames[2].textRange.characterAttributes.capitalization = TextCase.NORMAL;
        } catch(e) {}
        
        textLayer.textFrames[3].contents = "";
        textLayer.textFrames[3].textRange.fillColor = extraTitleColor;
        try {
          textLayer.textFrames[3].textRange.characterAttributes.capitalization = TextCase.NORMAL;
        } catch(e) {}
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

      var navigationPosition = "right";
      var compassLeftLayer = doc.layers.getByName("compasLeft");
      var compassRightLayer = doc.layers.getByName("compasRight");
      if (compassLeftLayer) compassLeftLayer.visible = (navigationPosition === "left");
      if (compassRightLayer) compassRightLayer.visible = (navigationPosition === "right");

      var compassLayerName = navigationPosition === "right" ? "compasRight" : "compasLeft";
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
      
      var scorecardPosition = "left";
      var showScorecard = true;

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
        var holeCount = 18;
        var userScores = [];
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
          var courseData = [{"holeNumber":1,"hole":1,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":2,"hole":2,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":3,"hole":3,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":4,"hole":4,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":5,"hole":5,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":6,"hole":6,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":7,"hole":7,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":8,"hole":8,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":9,"hole":9,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":10,"hole":10,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":11,"hole":11,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":12,"hole":12,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":13,"hole":13,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":14,"hole":14,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":15,"hole":15,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":16,"hole":16,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":17,"hole":17,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0},{"holeNumber":18,"hole":18,"par":4,"si":null,"white":0,"ladiesPar":null,"ladiesSi":null,"black":0,"blue":0,"yellow":0,"red":0,"gold":0,"green":0,"purple":0,"orange":0,"silver":0}];
          var userScores = [];
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
              var distanceUnit = "meters";
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

              // Apply svgMapSize scaling if provided (scale from center)
              // Use horizontal size if orientation is horizontal, vertical size otherwise
              var isHorizontal = false;
              var svgMapSizeHorizontal = null;
              var svgMapSizeVertical = null;
              var svgMapSize = isHorizontal ? svgMapSizeHorizontal : svgMapSizeVertical;
              if (svgMapSize !== null && svgMapSize > 0 && svgMapSize <= 100) {
                var scaleFactor = svgMapSize / 100;
                
                // Get current center point before scaling
                var currentBounds = groupedMap.geometricBounds;
                var currentCenterX = (currentBounds[0] + currentBounds[2]) / 2;
                var currentCenterY = (currentBounds[1] + currentBounds[3]) / 2;
                
                // Scale the map
                groupedMap.resize(scaleFactor * 100, scaleFactor * 100);
                
                // Re-center after scaling to maintain the same center point
                var scaledBounds = groupedMap.geometricBounds;
                var scaledWidth = scaledBounds[2] - scaledBounds[0];
                var scaledHeight = scaledBounds[1] - scaledBounds[3];
                
                var finalCenterX = currentCenterX - (scaledWidth / 2);
                var finalCenterY = currentCenterY + (scaledHeight / 2);
                groupedMap.position = [finalCenterX, finalCenterY];
              }
            }
          } catch(e) {}
        }
      } catch(e) {}

      var exportFolder = Folder("/Users/redmarwoest/course-prints/exports");
      if (!exportFolder.exists) { exportFolder.create(); }
      var exportFile = new File(exportFolder.fsName + "/ORDER_mockup-mockup-1768368863971-5bpeo9af5_Bridgewater_On_Loddon_Golf_Club_1768889279420_poster.pdf");

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
    