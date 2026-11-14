import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../theme';
// Original text-based logo — no TikTok trademark assets.
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <View style={styles.mark}><Text style={[styles.play, { fontSize: size * 0.55 }]}>▶</Text></View>
      <Text style={[styles.text, { fontSize: size }]}>ALIZAIN <Text style={styles.accent}>TIKTOK</Text></Text>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  mark: { width: 34, height: 34, borderRadius: 8, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', marginRight: 8, borderBottomWidth: 3, borderBottomColor: COLORS.cyan },
  play: { color: COLORS.white, fontWeight: 'bold' },
  text: { color: COLORS.white, fontWeight: '900', letterSpacing: 1 },
  accent: { color: COLORS.cyan },
});
