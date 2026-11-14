import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { COLORS } from '../theme';
export default function SettingsScreen() {
  const nav = useNavigation<any>(); const { user, signOut, refreshUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const row = (label: string, onPress: () => void, danger = false) => (
    <TouchableOpacity style={s.row} onPress={onPress}><Text style={[s.label, danger && { color: COLORS.red }]}>{label}</Text><Text style={s.chev}>›</Text></TouchableOpacity>
  );
  return (<ScrollView style={s.wrap} contentContainerStyle={{ padding: 20, paddingTop: 56 }}>
    <Text style={s.title}>Settings</Text>
    <Text style={s.me}>Signed in as @{user?.username}</Text>
    {row('Edit Profile', () => nav.navigate('EditProfile'))}
    {row('Privacy Settings', () => nav.navigate('Privacy'))}
    {row('Creator Dashboard', () => nav.navigate('CreatorDashboard'))}
    {row('Go Live', () => nav.navigate('Live'))}
    {row('Refresh my profile', async () => { setBusy(true); await refreshUser(); setBusy(false); Alert.alert('Refreshed', 'Profile data reloaded from the server.'); })}
    {row('Check server health', async () => { try { const h = await api.health(); Alert.alert('Server health', h.ok ? 'Server is reachable (ok: true).' : 'Server responded without ok: true.'); } catch (e: any) { Alert.alert('Server health', e.message); } })}
    {row('Log Out', () => Alert.alert('Log out?', 'You will need to log in again.', [{ text: 'Cancel' }, { text: 'Log Out', style: 'destructive', onPress: signOut }]), true)}
    <Text style={s.ver}>ALIZAIN TIKTOK v1.0.0 • Expo SDK 53</Text>
    {busy ? <Text style={s.ver}>Working…</Text> : null}
  </ScrollView>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.white, fontSize: 26, fontWeight: 'bold' },
  me: { color: COLORS.gray, marginTop: 6, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label: { color: COLORS.white, fontSize: 16 }, chev: { color: COLORS.gray, fontSize: 18 },
  ver: { color: COLORS.muted, textAlign: 'center', marginTop: 32, fontSize: 12 },
});
