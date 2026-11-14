import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { api } from '../api/client';
import type { Conversation } from '../api/types';
import { COLORS } from '../theme';
import { Empty, Loading } from '../components/ui';
export default function MessagesScreen() {
  const nav = useNavigation<any>();
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false);
  const load = async () => { try { setItems(await api.getConversations()); } catch (e: any) { Alert.alert('Messages', e.message); } finally { setLoading(false); setRefreshing(false); } };
  useFocusEffect(useCallback(() => { load(); }, []));
  if (loading) return <Loading />;
  return (<View style={s.wrap}>
    <FlatList data={items} keyExtractor={(c) => c.id} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.red} />}
      ListEmptyComponent={<Empty text="No conversations yet — message a creator from their profile!" />}
      renderItem={({ item }) => (
        <TouchableOpacity style={s.row} onPress={() => nav.navigate('Chat', { conversationId: item.id, username: item.otherUser.username })}>
          <View style={s.av}><Text style={s.avTxt}>{(item.otherUser.displayName || item.otherUser.username)[0].toUpperCase()}</Text></View>
          <View style={{ flex: 1 }}><Text style={s.name}>{item.otherUser.displayName} @{item.otherUser.username}</Text>
          <Text style={s.last} numberOfLines={1}>{item.lastMessage || 'No messages yet'}</Text></View>
          {item.unreadCount ? <View style={s.badge}><Text style={s.badgeTxt}>{item.unreadCount}</Text></View> : null}
        </TouchableOpacity>)} />
  </View>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  av: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.red, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avTxt: { color: COLORS.white, fontWeight: 'bold', fontSize: 18 },
  name: { color: COLORS.white, fontWeight: 'bold' }, last: { color: COLORS.gray, marginTop: 2 },
  badge: { backgroundColor: COLORS.red, borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  badgeTxt: { color: COLORS.white, fontSize: 12, fontWeight: 'bold' },
});
