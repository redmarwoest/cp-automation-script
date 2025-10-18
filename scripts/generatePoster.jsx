
      var file = new File("/Users/redmarwoest/Documents/cp-canvas__horizontal__210x297.ai");
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

      var textColor = makeRGB(0,0,0);
      var backgroundColor = makeRGB(255,255,255);
      var outlineColor = makeRGB(0,0,0);
      var compassColor = makeRGB(136,136,136);

      var textLayer = doc.layers.getByName("text");
      if (textLayer) {
        textLayer.textFrames[0].contents = "The Dutch Golf Club";
        textLayer.textFrames[0].textRange.fillColor = textColor;
        textLayer.textFrames[1].contents = "4212 KJ Spijk, North Holland, Netherlands";
        textLayer.textFrames[1].textRange.fillColor = textColor;
        textLayer.textFrames[2].contents = "Est. 2011";
        textLayer.textFrames[2].textRange.fillColor = textColor;
        textLayer.textFrames[3].contents = "Championship Course";
        textLayer.textFrames[3].textRange.fillColor = textColor;
      }

      try { doc.pageItems.getByName("background").fillColor = backgroundColor; } catch(e) {}

      for (var i = 0; i < doc.pageItems.length; i++) {
        if (doc.pageItems[i].name.indexOf("outline") !== -1) {
          doc.pageItems[i].strokeColor = outlineColor;
        }
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

      var navigationPosition = "left";
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
      
      var scorecardPosition = "right";
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
        var userScores = [4,3,5,4,3,4,4,3,4,5,4,3,4,4,3,4,4,4];
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
          var courseData = [{"number":1,"par":4,"white":380,"yellow":350,"red":320},{"number":2,"par":3,"white":150,"yellow":140,"red":120},{"number":3,"par":5,"white":520,"yellow":480,"red":440},{"number":4,"par":4,"white":420,"yellow":390,"red":360},{"number":5,"par":3,"white":180,"yellow":160,"red":140},{"number":6,"par":4,"white":400,"yellow":370,"red":340},{"number":7,"par":4,"white":380,"yellow":350,"red":320},{"number":8,"par":3,"white":160,"yellow":150,"red":130},{"number":9,"par":4,"white":410,"yellow":380,"red":350},{"number":10,"par":5,"white":540,"yellow":500,"red":460},{"number":11,"par":4,"white":390,"yellow":360,"red":330},{"number":12,"par":3,"white":170,"yellow":155,"red":135},{"number":13,"par":4,"white":430,"yellow":400,"red":370},{"number":14,"par":4,"white":380,"yellow":350,"red":320},{"number":15,"par":3,"white":190,"yellow":170,"red":150},{"number":16,"par":4,"white":400,"yellow":370,"red":340},{"number":17,"par":4,"white":420,"yellow":390,"red":360},{"number":18,"par":4,"white":410,"yellow":380,"red":350}];
          var userScores = [4,3,5,4,3,4,4,3,4,5,4,3,4,4,3,4,4,4];
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
              if (frame.contents === "s" + (i + 1)) frame.contents = userScore.toString();
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
                  for (var l = 0; l < scorecardLayer.textFrames.length; l++) {
                    var textFrame = scorecardLayer.textFrames[l];
                    if (textFrame.contents === userScore) {
                      textFrame.textRange.fillColor = makeRGB(255, 255, 255); // White text
                      break;
                    }
                  }
                }
              }
            }
          }

          // Strokes
          for (var j = 0; j < scorecardLayer.pageItems.length; j++) {
            try { if (scorecardLayer.pageItems[j].stroked) scorecardLayer.pageItems[j].strokeColor = textColor; } catch(e) {}
          }
        }
      } catch(e) {}

      // Paste recolored SVG into map placeholder
      var svgFile = new File("/Users/redmarwoest/Documents/selected-course-map.svg");
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
      var exportFile = new File(exportFolder.fsName + "/ORDER_ORDER-TEST-001_The_Dutch_Golf_Club_poster.pdf");

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
    