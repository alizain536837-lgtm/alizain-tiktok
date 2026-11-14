import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, TextInputProps } from 'react-native';
import { COLORS } from '../theme';
export const Btn = ({ title, onPress, disabled, color }: { title: string; onPress: () => void; disabled?: boolean; color?: string }) => (
  <TouchableOpacity style={[s.btn, { backgroundColor: color || COLORS.red, opacity: disabled ? 0.5 : 1 }]} onPress={onPress} disabled={disabled}>
    <Text style={s.btnTxt}>{title}</Text>
  </TouchableOpacity>
);
export const Input = (p: TextInputProps) => (
  <TextInput {...p} style={[s.input, p.style as any]} placeholderTextColor={COLORS.muted} autoCapitalize="none" />
);
export const Empty = ({ text }: { text: string }) => (<View style={s.empty}><Text style={s.emptyTxt}>{text}</Text></View>);
export const Err = ({ text }: { text?: string | null }) => text ? <Text style={s.err}>{text}</Text> : null;
export const Loading = () => (<View style={s.empty}><ActivityIndicator color={COLORS.red} size="large" /></View>);
const s = StyleSheet.create({
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  btnTxt: { color: COLORS.white, fontWeight: 'bold', fontSize: 16 },
  input: { backgroundColor: COLORS.surface, color: COLORS.white, borderRadius: 10, paddingHorizontal: 14, height: 50, marginTop: 12, borderWidth: 1, borderColor: COLORS.border },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTxt: { color: COLORS.gray, fontSize: 15, textAlign: 'center' },
  err: { color: COLORS.red, marginTop: 10, textAlign: 'center' },
});
