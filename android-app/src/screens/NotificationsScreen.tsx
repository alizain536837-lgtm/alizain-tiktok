import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { api } from '../api/client';
import type { NotificationItem } from '../api/types';
import { COLORS } from '../theme';
import { Empty, Loading } from '../components/ui';
export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const load = async () => { try { setItems(await api.getNotifications()); } catch (e: any) { Alert.alert('Notifications', e.message); } finally { setLoading(false); setRefreshing(false); } };
  useEffect(() => { load(); }, []);
  const markOne = async (n: NotificationItem) => { await api.markNotificationRead(n.id); setItems((p) => p.map((x) => x.id === n.id ? { ...x, read: true } : x)); };
  if (loading) return <Loading />;
  return (<View style={s.wrap}>
    <TouchableOpacity onPress={async () => { await api.markAllNotificationsRead(); setItems((p) => p.map((x) => ({ ...x, read: true }))); }}><Text style={s.mark}>Mark all as read</Text></TouchableOpacity>
    <FlatList data={items} keyExtractor={(n) => n.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.red} />}
      ListEmptyComponent={<Empty text="No notifications yet." />}
      renderItem={({ item }) => (
        <TouchableOpacity style={[s.row, !item.read && s.unread]} onPress={() => markOne(item)}>
          <Text style={s.title}>{item.title}</Text><Text style={s.body}>{item.body || ''}</Text>
          <Text style={s.meta}>{item.type} • {new Date(item.createdAt).toLocaleString()}</Text>
        </TouchableOpacity>)} />
  </View>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 8 },
  mark: { color: COLORS.cyan, textAlign: 'right', padding: 12 },
  row: { padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  unread: { backgroundColor: COLORS.surface },
  title: { color: COLORS.white, fontWeight: 'bold' }, body: { color: COLORS.gray, marginTop: 4 }, meta: { color: COLORS.muted, fontSize: 11, marginTop: 6 },
});
