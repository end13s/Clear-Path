import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, Modal, ScrollView, TouchableOpacity, Dimensions, TouchableWithoutFeedback, LayoutAnimation, UIManager, Platform } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function HelpModal({ visible, onClose, isElderly, theme }) {
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
    { color: theme.boxSignal, title: 'Traffic light detection', desc: 'The app announces red or green lights out loud. A large colored label also appears.' },
    { color: theme.boxSignal, title: 'Why is there a box on screen?', desc: 'The box shows exactly which light the app sees. The text inside tells you the color.' },
    { color: theme.boxSigns, title: 'Road sign reading', desc: 'The app reads stop signs and speed limits out loud as you approach.' },
    { color: theme.boxHazards, title: 'Hazard alerts', desc: 'The app warns you when people or bikes enter the road.' }
  ];

  const elderlyItems = [
    { color: theme.boxSignal, title: 'It watches traffic lights', desc: 'ClearPath says "Red light" or "Green light" out loud. You can always hear the signal.' },
    { color: theme.boxSignal, title: 'Why do I see a box?', desc: 'The box shows which light the app watches. It says RED, YELLOW, or GREEN.' },
    { color: theme.boxSigns, title: 'It reads road signs', desc: 'It speaks stop signs and speed limits to you. You hear them before you arrive.' },
    { color: theme.boxHazards, title: 'It warns about people', desc: 'It says "Pedestrian" right away if someone blocks you. A huge warning appears.' },
    { color: theme.accentBlue, title: 'What are the switches?', desc: 'The switches turn features on or off. When a switch says ON, it is running.' },
    { color: theme.accentBlue, title: 'Does it use the internet?', desc: 'No. The app runs fully on your phone.' }
  ];

  const moreHelpItems = [
    { title: "How to change your settings", desc: "Tap the small gear icon in the top right corner of the home screen. That opens your profile page where you can change everything." },
    { title: "How to turn a feature on or off", desc: "Each feature has a switch next to it. Tap the switch to turn it off — it will say OFF. Tap it again to turn it back on — it will say ON." },
    { title: "How to make the voice louder", desc: "Go to settings using the gear icon. Scroll down to Voice announcements and drag the volume slider to the right." },
    { title: "How to make the text bigger", desc: "Go to settings and select 'Age-related changes' under your needs. This makes all text and buttons bigger throughout the app." },
    { title: "What if the app stops talking?", desc: "Check that your phone volume is turned up. Then check that the feature switcher is set to ON." },
    { title: "How to go back to the home screen", desc: "While driving, tap the house icon in the bottom left corner of the screen to return home." }
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
          <Text style={[styles.title, { fontSize: currentTitleSize }]}>How ClearPath Works</Text>
          
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
                  <Text style={styles.expandTitle}>More help — using this app</Text>
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
              <Text style={styles.scrollHintText}>↓ Scroll to see more</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.gotItBtn, { paddingVertical: buttonPad }]} onPress={onClose}>
            <Text style={[styles.gotItText, { fontSize: buttonFontSize }]}>Got it</Text>
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
