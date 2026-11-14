import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import Logo from '../components/Logo';
import { Btn, Input, Err } from '../components/ui';
import { COLORS } from '../theme';
// In-app reset-code flow: no email provider is configured, so the server
// returns the code and the app shows it on screen.
export default function ForgotPasswordScreen() {
  const nav = useNavigation<any>();
  const [email, setEmail] = useState(''); const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState(''); const [shownCode, setShownCode] = useState('');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const requestCode = async () => {
    if (!email.trim()) { setErr('Enter your account email.'); return; }
    setBusy(true); setErr('');
    try { const r = await api.forgotPassword(email.trim()); setShownCode(r.resetCode); Alert.alert('Your reset code', `Your reset code is: ${r.resetCode}\n\nNo email provider is configured, so the code is shown here instead of emailed.`); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!code.trim() || newPassword.length < 6) { setErr('Enter the code and a new password (min 6 characters).'); return; }
    setBusy(true); setErr('');
    try { await api.resetPassword({ email: email.trim(), code: code.trim(), newPassword }); Alert.alert('Done', 'Password reset. Log in with your new password.'); nav.navigate('Login'); }
    catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  return (<ScrollView style={s.wrap} contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'center' }}>
    <Logo size={26} /><Text style={s.title}>Reset password</Text>
    <Text style={s.note}>No email provider is configured, so your reset code is shown in the app instead of emailed.</Text>
    <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
    <Btn title={busy ? 'Sending…' : 'Get Reset Code'} onPress={requestCode} disabled={busy} />
    {shownCode ? <Text style={s.code}>Your code: {shownCode}</Text> : null}
    <Input placeholder="Reset code" value={code} onChangeText={setCode} />
    <Input placeholder="New password (min 6 characters)" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
    <Err text={err} /><Btn title={busy ? 'Resetting…' : 'Reset Password'} onPress={reset} disabled={busy} color={COLORS.cyan} />
    <TouchableOpacity onPress={() => nav.navigate('Login')}><Text style={s.link}>Back to log in</Text></TouchableOpacity>
  </ScrollView>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg }, title: { color: COLORS.white, fontSize: 26, fontWeight: 'bold', marginTop: 24 },
  note: { color: COLORS.gray, marginTop: 10 }, link: { color: COLORS.cyan, textAlign: 'center', marginTop: 16 },
  code: { color: COLORS.cyan, fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 16 },
});
