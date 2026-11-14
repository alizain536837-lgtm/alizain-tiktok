import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { COLORS } from '../theme';
import { Btn } from '../components/ui';
export default function InboxScreen() {
  const nav = useNavigation<any>();
  return (<View style={s.wrap}>
    <Text style={s.title}>Inbox</Text>
    <Btn title="Notifications" onPress={() => nav.navigate('Notifications')} />
    <Btn title="Direct Messages" color={COLORS.surface} onPress={() => nav.navigate('Messages')} />
    <Btn title="Go Live" color={COLORS.cyan} onPress={() => nav.navigate('Live')} />
  </View>);
}
const s = StyleSheet.create({ wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 24, paddingTop: 56 }, title: { color: COLORS.white, fontSize: 26, fontWeight: 'bold', marginBottom: 12 } });
