import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api, isApiConfigured, API_URL } from '../api/client';
import { useAuth } from '../store/AuthContext';
import Logo from '../components/Logo';
import { Btn, Input, Err } from '../components/ui';
import { COLORS } from '../theme';
export default function LoginScreen() {
  const nav = useNavigation<any>(); const { signIn } = useAuth();
  const [identifier, setIdentifier] = useState(''); const [password, setPassword] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!isApiConfigured()) { setErr('API is not configured yet. Set EXPO_PUBLIC_API_URL (see README).'); return; }
    if (!identifier.trim() || !password) { setErr('Enter your username/email and password.'); return; }
    setBusy(true); setErr('');
    try { const r = await api.login({ identifier: identifier.trim(), password }); signIn(r.user); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (<ScrollView style={s.wrap} contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
    <Logo size={26} /><Text style={s.title}>Welcome back</Text>
    <Input placeholder="Username or email" value={identifier} onChangeText={setIdentifier} />
    <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
    <Err text={err} /><Btn title={busy ? 'Logging in…' : 'Log In'} onPress={submit} disabled={busy} />
    <TouchableOpacity onPress={() => nav.navigate('ForgotPassword')}><Text style={s.link}>Forgot password?</Text></TouchableOpacity>
    <TouchableOpacity onPress={() => nav.navigate('SignUp')}><Text style={s.link}>No account yet? Sign up</Text></TouchableOpacity>
    {!isApiConfigured() && <Text style={s.note}>API URL is not set (currently {API_URL}). Set EXPO_PUBLIC_API_URL before logging in.</Text>}
  </ScrollView>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg }, title: { color: COLORS.white, fontSize: 26, fontWeight: 'bold', marginTop: 24 },
  link: { color: COLORS.cyan, textAlign: 'center', marginTop: 16 },
  note: { color: COLORS.gray, textAlign: 'center', marginTop: 24, fontSize: 12 },
});
