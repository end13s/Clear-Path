import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

export default function BoundingBoxOverlay({ detections, toggles, profile, themeKey, theme }) {
  if (!detections || detections.length === 0 || !theme) return null;

  const isElderly = profile?.elderly || profile?.lowVision;
  const isColorBlind = profile?.colorBlind && !isElderly;
  
  const isHighContrast = themeKey === 'highContrast';
  const strokeW = isHighContrast ? "5" : (isColorBlind ? "4" : "3");
  const fontSize = isElderly ? "21" : "17";

  const pillBorderStroke = isHighContrast ? theme.border : "none";
  const pillBorderWidth = isHighContrast ? "2" : "0";

  // Use a slight multiplier for pill width to ensure full text fits perfectly based on size
  const charWidthMultiplier = isElderly ? 12 : 10;
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Helper to render a single bounding box
  const renderBox = (item, idx) => {
    const { bbox, class_name } = item;
    if (!bbox || bbox.length !== 4) return null;

    // Convert normalized coordinates [x1, y1, x2, y2] to screen coordinates
    const sx1 = bbox[0] * screenW;
    const sy1 = bbox[1] * screenH;
    const sx2 = bbox[2] * screenW;
    const sy2 = bbox[3] * screenH;

    const w = sx2 - sx1;
    const h = sy2 - sy1;

    let color = theme.accentBlue;
    const lowerName = class_name.toLowerCase();
    
    // Filter based on toggles and assign color from theme
    if (lowerName.includes('light')) {
      if (!toggles.trafficLights) return null;
      color = theme.boxSignal;
    } else if (lowerName.includes('sign')) {
      if (!toggles.signs) return null;
      color = theme.boxSigns;
    } else if (lowerName.includes('person') || lowerName.includes('bicycle')) {
      if (!toggles.hazards) return null;
      color = theme.boxHazards;
    } else {
      // Ignore other objects if they aren't toggled mapping
      return null;
    }

    const displayText = isColorBlind ? class_name.toUpperCase() : class_name;
    
    const pWidth = displayText.length * charWidthMultiplier + 16;
    const pHeight = isElderly ? 34 : 26;
    
    let py = sy1 - pHeight - 4;
    if (py < 0) {
      py = sy1 + 4; // draw inside if clipping occurs
    }
    
    let px = sx1;
    if (px + pWidth > screenW) {
      px = screenW - pWidth - 4;
    }

    return (
      <React.Fragment key={`bbox-${idx}`}>
        <Rect
          x={sx1} y={sy1} width={w} height={h}
          stroke={color} strokeWidth={strokeW} fill="none"
        />
        <Rect
          x={px} y={py} width={pWidth} height={pHeight}
          fill={theme.bgHeader}
          stroke={pillBorderStroke} strokeWidth={pillBorderWidth}
          opacity={0.85} rx="4"
        />
        <SvgText
          x={px + 8} y={py + (isElderly ? 24 : 18)}
          fill={theme.textPrimary}
          fontSize={fontSize}
          fontWeight="bold"
        >
          {displayText}
        </SvgText>
      </React.Fragment>
    );
  };

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {detections.map((item, idx) => renderBox(item, idx))}
    </Svg>
  );
}
