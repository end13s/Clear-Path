import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

const SignalDot = ({ color, active, isColorBlind, shape, isHighContrast, theme }) => {
  const size = 32;
  const baseStyle = {
    width: size,
    height: size,
    marginVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  };

  const activeOpacity = 1;
  const inactiveOpacity = 0.2;

  if (isColorBlind) {
    if (shape === 'circle') {
      return (
        <View style={[baseStyle, { 
          borderRadius: size/2, 
          backgroundColor: active ? color : 'transparent',
          borderColor: color,
          borderWidth: 2,
          opacity: active ? activeOpacity : inactiveOpacity
        }]} />
      );
    } else if (shape === 'diamond') {
      return (
        <View style={[baseStyle, { 
          backgroundColor: active ? color : 'transparent',
          borderColor: color,
          borderWidth: 2,
          transform: [{ rotate: '45deg' }],
          opacity: active ? activeOpacity : inactiveOpacity
        }]} />
      );
    } else if (shape === 'triangle') {
      return (
        <View style={[baseStyle, {
          backgroundColor: 'transparent',
          borderStyle: 'solid',
          borderLeftWidth: size/2,
          borderRightWidth: size/2,
          borderBottomWidth: size,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: active ? color : theme.border,
          opacity: active ? activeOpacity : inactiveOpacity
        }]} />
      );
    }
  }

  return (
    <View style={[baseStyle, { 
      borderRadius: size/2, 
      backgroundColor: color,
      opacity: active ? activeOpacity : inactiveOpacity
    }]} />
  );
};

export default function TrafficLightIndicator({ signal, confidence, profile, themeKey, theme }) {
  const isElderly = profile?.elderly || profile?.lowVision;
  const isColorBlind = profile?.colorBlind && !isElderly;
  const indicatorHeight = isElderly ? 110 : 92;
  const indicatorFontSize = isElderly ? 36 : 30;
  const confidenceFontSize = isElderly ? 15 : 13;
  const isHighContrast = themeKey === 'highContrast';

  if (!theme) return null;

  const styles = getStyles(theme, isHighContrast);
  const pct = confidence > 0 ? `${Math.round(confidence * 100)}%` : null;

  return (
    <View style={[styles.container, { height: indicatorHeight }]} pointerEvents="none">
      <View style={styles.colorStrip}>
        <SignalDot
          color={theme.signalRed}
          active={signal === 'red'}
          isColorBlind={isColorBlind}
          shape="circle"
          isHighContrast={isHighContrast}
          theme={theme}
        />
        <SignalDot
          color={theme.signalYellow}
          active={signal === 'yellow'}
          isColorBlind={isColorBlind}
          shape="triangle"
          isHighContrast={isHighContrast}
          theme={theme}
        />
        <SignalDot
          color={theme.signalGreen}
          active={signal === 'green'}
          isColorBlind={isColorBlind}
          shape="diamond"
          isHighContrast={isHighContrast}
          theme={theme}
        />
      </View>
      <View style={styles.textStrip}>
        <Text style={[styles.statusText, { fontSize: indicatorFontSize, color: theme.textPrimary }]}>
          {signal === 'red' ? 'STOP' : signal === 'green' ? 'GO' : signal === 'yellow' ? 'SLOW' : '---'}
        </Text>
        {pct && (
          <Text style={[styles.confidenceText, { fontSize: confidenceFontSize }]}>
            {pct}
          </Text>
        )}
      </View>
    </View>
  );
}

const getStyles = (theme, isHighContrast) => StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 140,
    backgroundColor: theme.bgCard,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    borderColor: isHighContrast ? '#FFFFFF' : theme.border,
    borderWidth: isHighContrast ? 3 : 2,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  colorStrip: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.border,
    paddingVertical: 4,
  },
  textStrip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    fontWeight: '900',
  },
  confidenceText: {
    color: '#AAAAAA',
    fontWeight: '600',
    marginTop: 2,
  },
});
