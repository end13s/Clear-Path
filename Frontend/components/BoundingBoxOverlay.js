import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

const STROKE_COLORS = {
  signal: '#FFD700',
  signs: '#FF4444',
  hazards: '#FF8800',
};

export default function BoundingBoxOverlay({ detections, toggles }) {
  const { width: screenW, height: screenH } = useWindowDimensions();

  // Helper to render a single bounding box
  const renderBox = (key, box, label, type) => {
    if (!box || box.length !== 4) return null;
    const [x, y, w, h] = box;
    const absX = x * screenW;
    const absY = y * screenH;
    const absW = w * screenW;
    const absH = h * screenH;
    const strokeColor = STROKE_COLORS[type];

    return (
      <React.Fragment key={key}>
        {/* The bounding box */}
        <Rect
          x={absX}
          y={absY}
          width={absW}
          height={absH}
          stroke={strokeColor}
          strokeWidth="3"
          fill="none"
        />
        {/* Label Background Pill */}
        <Rect
          x={absX}
          y={Math.max(0, absY - 24)} // Adjust so label stays inside screen
          width={label.length * 8 + 16} // Estimate width based on characters
          height={24}
          fill={strokeColor}
        />
        {/* Label Text */}
        <SvgText
          x={absX + 8}
          y={Math.max(0, absY - 24) + 16}
          fill="#FFFFFF"
          fontSize="13"
          fontWeight="bold"
        >
          {label}
        </SvgText>
      </React.Fragment>
    );
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        {/* Signals */}
        {toggles.trafficLights && detections?.signal &&
          renderBox('signal', detections.signal_box, `${detections.signal.charAt(0).toUpperCase() + detections.signal.slice(1)} Light`, 'signal')}
        
        {/* Signs */}
        {toggles.signs && detections?.signs?.map((sign, i) =>
          renderBox(`sign_${i}`, sign.box, sign.label, 'signs')
        )}

        {/* Hazards */}
        {toggles.hazards && detections?.hazards?.map((hazard, i) =>
          renderBox(`hazard_${i}`, hazard.box, hazard.label, 'hazards')
        )}
      </Svg>
    </View>
  );
}
