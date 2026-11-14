import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import { COLORS } from '../theme';
import { Empty } from '../components/ui';
export default function SearchScreen() {
  const nav = useNavigation<any>();
  const [q, setQ] = useState(''); const [users, setUsers] = useState<any[]>([]);
  const search = async (text: string) => { setQ(text); if (text.trim().length < 2) { setUsers([]); return; } try { setUsers(await api.searchUsers(text.trim())); } catch {} };
  return (<View style={s.wrap}>
    <TextInput style={s.input} placeholder="Search users…" placeholderTextColor={COLORS.muted} value={q} onChangeText={search} autoFocus />
    <FlatList data={users} keyExtractor={(u) => u.id} ListEmptyComponent={<Empty text={q.trim().length < 2 ? 'Type at least 2 characters to search users.' : 'No users found for that search.'} />}
      renderItem={({ item }) => (<TouchableOpacity style={s.row} onPress={() => nav.navigate('Profile', { username: item.username })}>
        <View style={s.av}><Text style={s.avTxt}>{(item.displayName || item.username)[0].toUpperCase()}</Text></View>
        <View><Text style={s.name}>{item.displayName}</Text><Text style={s.sub}>@{item.username}</Text></View>
      </TouchableOpacity>)} />
  </View>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 16, paddingTop: 8 },
  input: { backgroundColor: COLORS.surface, color: COLORS.white, borderRadius: 10, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: COLORS.border },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  av: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avTxt: { color: COLORS.white, fontWeight: 'bold', fontSize: 18 },
  name: { color: COLORS.white, fontWeight: 'bold' }, sub: { color: COLORS.gray, fontSize: 12 },
});
