import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { api } from '../api/client';
import { COLORS } from '../theme';
import { Loading } from '../components/ui';
// Honest state: live streaming is unavailable until a streaming provider
// is configured in the Admin Panel. Never fake a live stream.
export default function LiveScreen() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [reason, setReason] = useState('');
  useEffect(() => { api.liveAvailability().then((r) => { setAvailable(r.available); setReason(r.reason || ''); }).catch(() => setAvailable(false)); }, []);
  if (available === null) return <Loading />;
  return (<View style={s.wrap}>
    <Text style={s.icon}>📺</Text>
    <Text style={s.title}>Live streaming is unavailable</Text>
    <Text style={s.body}>Live streaming is not available yet. A streaming provider has not been configured for this platform.</Text>
    {reason ? <Text style={s.body}>{reason}</Text> : null}
    <Text style={s.body}>The owner can configure a live-streaming provider in the Admin Panel (Live / Streaming settings), after which this screen will offer Go Live.</Text>
    <TouchableOpacity onPress={() => Linking.openURL('https://github.com/alizain536837-lgtm/alizain-tiktok')}><Text style={s.link}>Admin config instructions (project repo)</Text></TouchableOpacity>
  </View>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 24, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 48 }, title: { color: COLORS.white, fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginTop: 16 },
  body: { color: COLORS.gray, textAlign: 'center', marginTop: 12, lineHeight: 22 },
  link: { color: COLORS.cyan, marginTop: 24, textAlign: 'center' },
});
