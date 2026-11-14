import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../api/client';
import { COLORS } from '../theme';
import { Btn, Err } from '../components/ui';
const REASONS = ['Spam', 'Harassment or bullying', 'Violence', 'Sexual content', 'Hate speech', 'Misinformation', 'Copyright violation', 'Other'];
export default function ReportScreen() {
  const nav = useNavigation<any>(); const route = useRoute<any>();
  const { videoId, userId, username } = (route.params || {}) as { videoId?: string; userId?: string; username?: string };
  const [reason, setReason] = useState(REASONS[0]); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true); setErr('');
    try {
      if (videoId) await api.reportVideo(videoId, reason);
      else if (userId) await api.reportUser(userId, reason);
      else throw new Error('Nothing to report — open this screen from a video or a profile.');
      Alert.alert('Report sent', 'Thanks — our team will review this report.'); nav.goBack();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (<ScrollView style={s.wrap} contentContainerStyle={{ padding: 24, paddingTop: 56 }}>
    <Text style={s.title}>Report Content</Text>
    <Text style={s.sub}>Reporting {videoId ? 'a video' : userId ? `user @${username || ''}` : 'content'}.</Text>
    {REASONS.map((r) => (<TouchableOpacity key={r} style={[s.opt, reason === r && s.optOn]} onPress={() => setReason(r)}><Text style={s.optTxt}>{r}</Text></TouchableOpacity>))}
    <Err text={err} /><Btn title={busy ? 'Sending…' : 'Submit Report'} onPress={submit} disabled={busy} />
  </ScrollView>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.white, fontSize: 24, fontWeight: 'bold' }, sub: { color: COLORS.gray, marginTop: 6, marginBottom: 16 },
  opt: { padding: 14, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, marginBottom: 10 },
  optOn: { borderColor: COLORS.red, backgroundColor: COLORS.surface },
  optTxt: { color: COLORS.white },
});
