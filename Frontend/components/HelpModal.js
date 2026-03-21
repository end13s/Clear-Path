import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, Modal, ScrollView, TouchableOpacity, Dimensions, TouchableWithoutFeedback, LayoutAnimation, UIManager, Platform } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HelpModal({ visible, onClose, isElderly, theme, t }) {
  const [expanded, setExpanded] = useState(false);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const scrollRef = useRef(null);

  if (!theme) return null;

  const currentTitleSize = isElderly ? 24 : 20;
  const itemTitleSize = isElderly ? 21 : 18;
  const itemDescSize = isElderly ? 18 : 16;
  const itemLineHeight = isElderly ? 26 : 22; 
  const buttonPad = isElderly ? 14 : 11;
  const buttonFontSize = isElderly ? 23 : 20;

  const standardItems = [
    { color: theme.boxSignal, title: t('help_std_1_title'), desc: t('help_std_1_desc') },
    { color: theme.boxSignal, title: t('help_std_2_title'), desc: t('help_std_2_desc') },
    { color: theme.boxSigns, title: t('help_std_3_title'), desc: t('help_std_3_desc') },
    { color: theme.boxHazards, title: t('help_std_4_title'), desc: t('help_std_4_desc') }
  ];

  const elderlyItems = [
    { color: theme.boxSignal, title: t('help_eld_1_title'), desc: t('help_eld_1_desc') },
    { color: theme.boxSignal, title: t('help_eld_2_title'), desc: t('help_eld_2_desc') },
    { color: theme.boxSigns, title: t('help_eld_3_title'), desc: t('help_eld_3_desc') },
    { color: theme.boxHazards, title: t('help_eld_4_title'), desc: t('help_eld_4_desc') },
    { color: theme.accentBlue, title: t('help_eld_5_title'), desc: t('help_eld_5_desc') },
    { color: theme.accentBlue, title: t('help_eld_6_title'), desc: t('help_eld_6_desc') }
  ];

  const moreHelpItems = [
    { title: t('help_more_1_title'), desc: t('help_more_1_desc') },
    { title: t('help_more_2_title'), desc: t('help_more_2_desc') },
    { title: t('help_more_3_title'), desc: t('help_more_3_desc') },
    { title: t('help_more_4_title'), desc: t('help_more_4_desc') },
    { title: t('help_more_5_title'), desc: t('help_more_5_desc') },
    { title: t('help_more_6_title'), desc: t('help_more_6_desc') }
  ];

  const items = isElderly ? elderlyItems : standardItems;
  const styles = getStyles(theme, isElderly);

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const willExpand = !expanded;
    setExpanded(willExpand);
    
    if (willExpand) {
      setShowScrollHint(true);
    } else {
      setShowScrollHint(false);
    }
  };

  const handleScroll = (event) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    // Hide the hint specifically if the user scrolls exactly to the bottom
    const isBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (isBottom && showScrollHint) {
      setShowScrollHint(false);
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        
        <View style={styles.panel}>
          <Text style={[styles.title, { fontSize: currentTitleSize }]}>{t('help_title')}</Text>
          
          <ScrollView 
            ref={scrollRef} 
            style={styles.scroll} 
            showsVerticalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
                {items.map((item, idx) => (
                  <View key={`core-${idx}`} style={styles.itemRow}>
                    <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                    <View style={styles.itemTextCol}>
                      <Text style={[styles.itemTitle, { fontSize: itemTitleSize }]}>{item.title}</Text>
                      <Text style={[styles.itemDesc, { fontSize: itemDescSize, lineHeight: itemLineHeight }]}>
                        {item.desc}
                      </Text>
                    </View>
                  </View>
                ))}

                {/* Expandable Meta Section */}
                <TouchableOpacity style={[styles.expandHeader, { marginBottom: expanded ? 16 : 0 }]} onPress={toggleExpand} activeOpacity={0.8}>
                  <Text style={styles.expandTitle}>{t('help_expand_title')}</Text>
                  <Text style={[styles.expandChevron, { transform: [{ rotate: expanded ? '90deg' : '0deg' }] }]}>{'>'}</Text>
                </TouchableOpacity>

                {expanded && (
                  <View style={styles.expandedContent}>
                    {moreHelpItems.map((item, idx) => (
                      <View key={`faq-${idx}`} style={styles.expandedItemRow}>
                        <View style={styles.itemTextCol}>
                          <Text style={[styles.itemTitle, { fontSize: itemTitleSize, marginBottom: 6 }]}>{item.title}</Text>
                          <Text style={[styles.itemDesc, { fontSize: itemDescSize, lineHeight: itemLineHeight }]}>
                            {item.desc}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

          </ScrollView>

          {showScrollHint && (
            <View style={styles.scrollHint} pointerEvents="none">
              <Text style={styles.scrollHintText}>{t('help_scroll_hint')}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.gotItBtn, { paddingVertical: buttonPad }]} onPress={onClose}>
            <Text style={[styles.gotItText, { fontSize: buttonFontSize }]}>{t('help_got_it')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const getStyles = (theme, isElderly) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  },
  panel: {
    backgroundColor: theme.bgPrimary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: SCREEN_HEIGHT * 0.85,
    padding: 20,
    paddingBottom: 30,
    borderWidth: 1.5,
    borderColor: theme.border,
  },
  title: {
    color: theme.textPrimary,
    fontWeight: 'bold',
    marginBottom: 20
  },
  scroll: {
    maxHeight: SCREEN_HEIGHT * 0.6
  },
  itemRow: {
    flexDirection: 'row',
    marginBottom: 16,
    backgroundColor: theme.bgCard,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 4,
    marginRight: 14
  },
  itemTextCol: {
    flex: 1
  },
  itemTitle: {
    color: theme.textPrimary,
    fontWeight: 'bold',
    marginBottom: 4
  },
  itemDesc: {
    color: theme.textSecondary,
  },
  expandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: isElderly ? theme.accentBlue : theme.bgHero,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: isElderly ? theme.accentBlue : theme.border,
  },
  expandTitle: {
    color: isElderly ? theme.bgPrimary : theme.textPrimary,
    fontWeight: 'bold',
    fontSize: isElderly ? 20 : 17, // Made it more prominent per user request
  },
  expandChevron: {
    color: isElderly ? theme.bgPrimary : theme.textPrimary,
    fontWeight: 'bold',
    fontSize: 20,
  },
  expandedContent: {
    marginTop: 16,
  },
  expandedItemRow: {
    backgroundColor: theme.bgCard,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderLeftWidth: 6,
    borderLeftColor: '#4a7aaa',
    marginBottom: 16,
  },
  gotItBtn: {
    backgroundColor: theme.accentBlue,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10
  },
  gotItText: {
    color: theme.bgPrimary,
    fontWeight: 'bold'
  },
  scrollHint: {
    position: 'absolute',
    bottom: 85, // Float right above the "Got it" button safely
    alignSelf: 'center',
    backgroundColor: theme.bgHero,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  scrollHintText: {
    color: theme.textSecondary,
    fontWeight: 'bold',
    fontSize: isElderly ? 14 : 12,
  }
});
