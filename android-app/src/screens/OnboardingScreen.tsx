import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Logo from '../components/Logo';
import { COLORS } from '../theme';
import { Btn } from '../components/ui';
const PAGES = [
  { t: 'Watch short videos', d: 'Swipe through a full-screen feed of videos up to 30 seconds — made by creators like you.' },
  { t: 'Create in seconds', d: 'Upload a video, trim it, add a caption, hashtags and a sound from the Music Library.' },
  { t: 'Connect & chat', d: 'Follow creators, comment, reply and send direct messages in real time.' },
];
export default function OnboardingScreen() {
  const nav = useNavigation<any>(); const [i, setI] = useState(0);
  return (<View style={s.wrap}><Logo size={26} />
    <View style={s.card}><Text style={s.title}>{PAGES[i].t}</Text><Text style={s.desc}>{PAGES[i].d}</Text></View>
    <View style={s.dots}>{PAGES.map((_, k) => <View key={k} style={[s.dot, k === i && s.dotOn]} />)}</View>
    <Btn title={i < 2 ? 'Next' : 'Get Started'} onPress={() => i < 2 ? setI(i + 1) : nav.navigate('Login')} />
    <TouchableOpacity onPress={() => nav.navigate('SignUp')}><Text style={s.link}>Create a new account</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => nav.navigate('Login')}><Text style={s.link}>I already have an account</Text></TouchableOpacity>
  </View>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 24, justifyContent: 'center' },
  card: { marginTop: 48, minHeight: 140 }, title: { color: COLORS.white, fontSize: 28, fontWeight: 'bold' },
  desc: { color: COLORS.gray, fontSize: 16, marginTop: 12, lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', marginVertical: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border, marginHorizontal: 4 },
  dotOn: { backgroundColor: COLORS.red, width: 24 }, link: { color: COLORS.cyan, textAlign: 'center', marginTop: 16 },
});
