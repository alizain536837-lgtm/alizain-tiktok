import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api, isApiConfigured } from '../api/client';
import { useAuth } from '../store/AuthContext';
import Logo from '../components/Logo';
import { Btn, Input, Err } from '../components/ui';
import { COLORS } from '../theme';
export default function SignUpScreen() {
  const nav = useNavigation<any>(); const { signIn } = useAuth();
  const [displayName, setDisplayName] = useState(''); const [username, setUsername] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!isApiConfigured()) { setErr('API is not configured yet. Set EXPO_PUBLIC_API_URL (see README).'); return; }
    if (!displayName.trim() || !username.trim() || !email.trim() || password.length < 6) { setErr('Fill in all fields. Password must be at least 6 characters.'); return; }
    setBusy(true); setErr('');
    try { const r = await api.register({ username: username.trim(), email: email.trim(), password, displayName: displayName.trim() }); signIn(r.user); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (<ScrollView style={s.wrap} contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
    <Logo size={26} /><Text style={s.title}>Create your account</Text>
    <Input placeholder="Display name" value={displayName} onChangeText={setDisplayName} />
    <Input placeholder="Username (no spaces)" value={username} onChangeText={setUsername} />
    <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
    <Input placeholder="Password (min 6 characters)" value={password} onChangeText={setPassword} secureTextEntry />
    <Err text={err} /><Btn title={busy ? 'Creating…' : 'Sign Up'} onPress={submit} disabled={busy} />
    <TouchableOpacity onPress={() => nav.navigate('Login')}><Text style={s.link}>Already have an account? Log in</Text></TouchableOpacity>
  </ScrollView>);
}
const s = StyleSheet.create({ wrap: { flex: 1, backgroundColor: COLORS.bg }, title: { color: COLORS.white, fontSize: 26, fontWeight: 'bold', marginTop: 24 }, link: { color: COLORS.cyan, textAlign: 'center', marginTop: 16 } });
