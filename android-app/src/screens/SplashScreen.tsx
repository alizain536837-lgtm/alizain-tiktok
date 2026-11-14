import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Logo from '../components/Logo';
import { COLORS } from '../theme';
export default function SplashScreen() {
  const nav = useNavigation<any>();
  useEffect(() => { const t = setTimeout(() => { try { nav.replace('Onboarding'); } catch {} }, 1500); return () => clearTimeout(t); }, [nav]);
  return (<View style={s.wrap}><Logo size={30} /><Text style={s.sub}>Short videos. Big moments.</Text></View>);
}
const s = StyleSheet.create({ wrap: { flex: 1, backgroundColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }, sub: { color: COLORS.gray, marginTop: 14 } });
