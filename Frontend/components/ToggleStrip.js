import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

const TOGGLE_ITEMS = [
  { id: 'trafficLights', label: 'Traffic\nLights', iconName: 'traffic', iconSet: 'MaterialIcons', iconSize: 22 },
  { id: 'signs', label: 'Signs', iconName: 'stop-circle-outline', iconSet: 'Ionicons', iconSize: 22 },
  { id: 'hazards', label: 'Hazards', iconName: 'walk-outline', iconSet: 'Ionicons', iconSize: 22 },
];

const CustomSwitch = ({ value, onValueChange, width, height, activeColor, inactiveColor, thumbColor }) => {
  const padding = 2;
  const dotSize = height - padding * 2;
  const translateX = value ? width - dotSize - padding * 2 : 0;
  const textFontSize = Math.max(10, height * 0.45);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={{
        width,
        height,
        borderRadius: height / 2,
        backgroundColor: value ? activeColor : inactiveColor,
        padding,
        justifyContent: 'center',
      }}
    >
      {value ? (
        <Text style={{ position: 'absolute', left: padding * 3, color: '#FFFFFF', fontFamily: 'Lexend_700Bold', fontSize: textFontSize }}>ON</Text>
      ) : (
        <Text style={{ position: 'absolute', right: padding * 3, color: '#FFFFFF', fontFamily: 'Lexend_700Bold', fontSize: textFontSize }}>OFF</Text>
      )}
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: thumbColor,
          transform: [{ translateX }],
        }}
      />
    </TouchableOpacity>
  );
};

export default function ToggleStrip({ toggles, onToggle, profile, theme }) {
  const isElderly = profile?.elderly || profile?.lowVision;
  const headerFontSize = isElderly ? 18 : 16;
  const labelFontSize = isElderly ? 20 : 17;
  const panelWidth = isElderly ? 145 : 125; 

  const [isVisible, setIsVisible] = useState(true);
  const slideAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isVisible ? 0 : 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [isVisible]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, panelWidth],
  });

  if (!theme) return null;

  const styles = getStyles(theme);

  return (
    <Animated.View style={[styles.container, { transform: [{ translateX }] }]} pointerEvents="box-none">
      {/* Chevron Tab */}
      <TouchableOpacity
        style={styles.chevronTab}
        onPress={() => setIsVisible(!isVisible)}
        activeOpacity={0.7}
      >
        <Text style={styles.chevronText}>{isVisible ? '▶' : '◀'}</Text>
      </TouchableOpacity>

      {/* Main Panel */}
      <View style={[styles.panel, { minWidth: panelWidth }]}>
        <Text style={[styles.headerText, { fontSize: headerFontSize }]}>Toggle{"\n"}Features:</Text>
        {TOGGLE_ITEMS.map((item) => (
          <View style={styles.row} key={item.id}>
            <View style={styles.iconContainer}>
              {item.iconSet === 'MaterialIcons' ? (
                <MaterialIcons name={item.iconName} size={item.iconSize} color={theme.textPrimary} />
              ) : (
                <Ionicons name={item.iconName} size={item.iconSize} color={theme.textPrimary} />
              )}
            </View>
            <Text style={[styles.label, { fontSize: labelFontSize }]}>{item.label}</Text>
            <CustomSwitch
              value={toggles[item.id]}
              onValueChange={(val) => onToggle(item.id, val)}
              width={isElderly ? 60 : 50}
              height={isElderly ? 28 : 24}
              activeColor={theme.accentBlue}
              inactiveColor={theme.border}
              thumbColor={theme.textPrimary}
            />
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const getStyles = (theme) => StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    top: '25%',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  chevronTab: {
    backgroundColor: theme.bgHeader,
    borderColor: theme.border,
    borderWidth: 1.5,
    borderRightWidth: 0,
    paddingVertical: 24, 
    paddingHorizontal: 12,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chevronText: {
    color: theme.textPrimary,
    fontFamily: 'Lexend_700Bold',
    fontSize: 20,
  },
  panel: {
    backgroundColor: theme.bgCard,
    borderColor: theme.border,
    borderLeftWidth: 1.5,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    paddingVertical: 20,
    paddingHorizontal: 8,
  },
  headerText: {
    color: theme.textMuted,
    fontFamily: 'Lexend_700Bold',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 18,
  },
  row: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  iconContainer: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  label: {
    color: theme.textPrimary,
    fontFamily: 'Lexend_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  switch: {
    transform: [{ scale: 1.1 }], 
    alignSelf: 'center',
  },
});
