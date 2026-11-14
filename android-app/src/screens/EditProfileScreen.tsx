import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { COLORS } from '../theme';
import { Btn, Input, Err } from '../components/ui';
export default function EditProfileScreen() {
  const nav = useNavigation<any>(); const { user, refreshUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true); setErr('');
    try { await api.updateMe({ displayName: displayName.trim(), bio: bio.trim(), avatarUrl: avatarUrl.trim() || null }); await refreshUser(); Alert.alert('Saved', 'Your profile was updated.'); nav.goBack(); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (<ScrollView style={s.wrap} contentContainerStyle={{ padding: 24, paddingTop: 56 }}>
    <Text style={s.title}>Edit Profile</Text>
    <Input placeholder="Display name" value={displayName} onChangeText={setDisplayName} />
    <Input placeholder="Bio" value={bio} onChangeText={setBio} multiline style={{ height: 90, paddingTop: 12 }} />
    <Input placeholder="Avatar image URL (optional)" value={avatarUrl} onChangeText={setAvatarUrl} />
    <Err text={err} /><Btn title={busy ? 'Saving…' : 'Save Changes'} onPress={save} disabled={busy} />
  </ScrollView>);
}
const s = StyleSheet.create({ wrap: { flex: 1, backgroundColor: COLORS.bg }, title: { color: COLORS.white, fontSize: 24, fontWeight: 'bold' } });
