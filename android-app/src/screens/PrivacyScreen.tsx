import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { api } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { COLORS } from '../theme';
import { Btn } from '../components/ui';
// Privacy preferences are stored on the server profile where the backend
// supports them; toggles below are sent via PATCH /api/users/me.
export default function PrivacyScreen() {
  const { user, refreshUser } = useAuth();
  const [privateAccount, setPrivateAccount] = useState((user as any)?.privateAccount === true);
  const [allowComments, setAllowComments] = useState((user as any)?.allowComments !== false);
  const [allowDms, setAllowDms] = useState((user as any)?.allowDms !== false);
  const [busy, setBusy] = useState(false);
  const toggle = (label: string, value: boolean, set: (v: boolean) => void) => (
    <View style={s.row}><View style={{ flex: 1 }}><Text style={s.label}>{label}</Text></View>
    <TouchableOpacity style={[s.switch, value && s.switchOn]} onPress={() => set(!value)}><Text style={s.switchTxt}>{value ? 'ON' : 'OFF'}</Text></TouchableOpacity></View>
  );
  const save = async () => {
    setBusy(true);
    try { await api.updateMe({ privateAccount, allowComments, allowDms } as any); await refreshUser(); Alert.alert('Saved', 'Privacy settings updated.'); }
    catch (e: any) { Alert.alert('Could not save', e.message + '\n\nIf the server does not support these fields yet, the toggles are kept locally for this session only.'); }
    finally { setBusy(false); }
  };
  return (<ScrollView style={s.wrap} contentContainerStyle={{ padding: 20, paddingTop: 56 }}>
    <Text style={s.title}>Privacy Settings</Text>
    <Text style={s.note}>Control who can find you, comment, and message you.</Text>
    {toggle('Private account', privateAccount, setPrivateAccount)}
    {toggle('Allow comments on my videos', allowComments, setAllowComments)}
    {toggle('Allow direct messages', allowDms, setAllowDms)}
    <Btn title={busy ? 'Saving…' : 'Save Privacy Settings'} onPress={save} disabled={busy} />
  </ScrollView>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.white, fontSize: 26, fontWeight: 'bold' },
  note: { color: COLORS.gray, marginTop: 8, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  label: { color: COLORS.white, fontSize: 16 },
  switch: { backgroundColor: COLORS.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border },
  switchOn: { backgroundColor: COLORS.cyan, borderColor: COLORS.cyan },
  switchTxt: { color: COLORS.white, fontWeight: 'bold' },
});
