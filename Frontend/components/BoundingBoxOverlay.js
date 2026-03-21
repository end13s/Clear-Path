import React from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect, Circle, Text as SvgText } from 'react-native-svg';

// Signal colors for focal point — independent of theme
const SIGNAL_COLORS = {
  red_light:     '#FF3B30',
  yellow_light:  '#FFD60A',
  green_light:   '#30D158',
  traffic_light: '#FFFFFF',  // unknown color, fallback
};

export default function BoundingBoxOverlay({ detections, toggles, profile, themeKey, theme }) {
  if (!detections || detections.length === 0 || !theme) return null;

  const isElderly = profile?.elderly || profile?.lowVision;
  const isColorBlind = profile?.colorBlind && !isElderly;
  const isHighContrast = themeKey === 'highContrast';

  const strokeW = isHighContrast ? 5 : (isColorBlind ? 4 : 3);
  const fontSize = isElderly ? "21" : "17";
  const pillBorderStroke = isHighContrast ? theme.border : "none";
  const pillBorderWidth = isHighContrast ? "2" : "0";
  const charWidthMultiplier = isElderly ? 12 : 10;

  const { width: screenW, height: screenH } = useWindowDimensions();

  const renderFocalPoint = (item, idx) => {
    const { bbox, class_name, confidence } = item;
    if (!bbox || bbox.length !== 4) return null;
    if (!toggles.trafficLights) return null;

    const sx1 = bbox[0] * screenW;
    const sy1 = bbox[1] * screenH;
    const sx2 = bbox[2] * screenW;
    const sy2 = bbox[3] * screenH;
    const w = sx2 - sx1;
    const h = sy2 - sy1;

    const cx = sx1 + w / 2;
    const cy = sy1 + h / 2;
    const r = Math.max(w, h) / 2 + (isElderly ? 14 : 10);

    const signalColor = SIGNAL_COLORS[class_name] || SIGNAL_COLORS.traffic_light;
    const ringStroke = isHighContrast ? strokeW + 2 : strokeW + 1;

    const pct = confidence ? ` ${Math.round(confidence * 100)}%` : '';
    const label = isColorBlind ? class_name.toUpperCase() : class_name;
    const displayText = label + pct;
    const pWidth = displayText.length * charWidthMultiplier + 16;
    const pHeight = isElderly ? 34 : 26;

    let py = sy1 - pHeight - 4;
    if (py < 0) py = sy1 + 4;
    let px = cx - pWidth / 2;
    if (px + pWidth > screenW) px = screenW - pWidth - 4;
    if (px < 0) px = 4;

    return (
      <React.Fragment key={`focal-${idx}`}>
        {/* Outer glow ring */}
        <Circle
          cx={cx} cy={cy} r={r + (isElderly ? 10 : 7)}
          stroke={signalColor} strokeWidth={ringStroke}
          fill="none" opacity={0.3}
        />
        {/* Inner focal ring */}
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={signalColor} strokeWidth={ringStroke + 1}
          fill="none" opacity={0.9}
        />
        {/* Label pill */}
        <Rect
          x={px} y={py} width={pWidth} height={pHeight}
          fill={theme.bgHeader}
          stroke={pillBorderStroke} strokeWidth={pillBorderWidth}
          opacity={0.85} rx="4"
        />
        <SvgText
          x={px + 8} y={py + (isElderly ? 24 : 18)}
          fill={signalColor}
          fontSize={fontSize}
          fontFamily="Lexend_700Bold"
        >
          {displayText}
        </SvgText>
      </React.Fragment>
    );
  };

  const renderBox = (item, idx) => {
    const { bbox, class_name, confidence } = item;
    if (!bbox || bbox.length !== 4) return null;

    const sx1 = bbox[0] * screenW;
    const sy1 = bbox[1] * screenH;
    const sx2 = bbox[2] * screenW;
    const sy2 = bbox[3] * screenH;
    const w = sx2 - sx1;
    const h = sy2 - sy1;

    const lowerName = class_name.toLowerCase();
    let color = theme.accentBlue;

    if (lowerName.includes('sign')) {
      if (!toggles.signs) return null;
      color = theme.boxSigns;
    } else if (lowerName.includes('person') || lowerName.includes('bicycle')) {
      if (!toggles.hazards) return null;
      color = theme.boxHazards;
    } else {
      return null;
    }

    const pct = confidence ? ` ${Math.round(confidence * 100)}%` : '';
    const displayText = (isColorBlind ? class_name.toUpperCase() : class_name) + pct;
    const pWidth = displayText.length * charWidthMultiplier + 16;
    const pHeight = isElderly ? 34 : 26;

    let py = sy1 - pHeight - 4;
    if (py < 0) py = sy1 + 4;
    let px = sx1;
    if (px + pWidth > screenW) px = screenW - pWidth - 4;

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
          fontFamily="Lexend_700Bold"
        >
          {displayText}
        </SvgText>
      </React.Fragment>
    );
  };

  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {detections.map((item, idx) => {
        const lowerName = item.class_name?.toLowerCase() || '';
        if (lowerName.includes('light')) return renderFocalPoint(item, idx);
        return renderBox(item, idx);
      })}
    </Svg>
  );
}
