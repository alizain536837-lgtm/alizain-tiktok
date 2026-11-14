import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { api } from '../api/client';
import { connectSocket, getSocket } from '../store/socket';
import { useAuth } from '../store/AuthContext';
import type { ChatMessage } from '../api/types';
import { COLORS } from '../theme';
import { Empty, Loading } from '../components/ui';
export default function ChatScreen() {
  const route = useRoute<any>(); const { conversationId, username } = route.params as { conversationId: string; username: string };
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [text, setText] = useState(''); const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const listRef = useRef<FlatList>(null);
  useEffect(() => {
    api.getMessages(conversationId).then(setMsgs).catch((e) => Alert.alert('Chat', e.message)).finally(() => setLoading(false));
    api.markConversationRead(conversationId);
    let sock: any;
    connectSocket().then((s) => { sock = s; s.emit('join', { conversationId }); s.on('message:new', (m: ChatMessage) => { if (m.conversationId === conversationId) setMsgs((p) => [...p, m]); }); s.on('typing', (d: any) => { if (d.conversationId === conversationId) { setTyping(true); setTimeout(() => setTyping(false), 2000); } }); });
    return () => { sock?.off('message:new'); sock?.off('typing'); };
  }, [conversationId]);
  const send = async () => {
    if (!text.trim()) return;
    const t = text.trim(); setText('');
    try { const m = await api.sendMessage(conversationId, t); setMsgs((p) => [...p, m]); getSocket()?.emit('message:send', { conversationId, text: t }); }
    catch (e: any) { Alert.alert('Could not send', e.message); }
  };
  const onType = (v: string) => { setText(v); getSocket()?.emit('typing', { conversationId }); };
  if (loading) return <Loading />;
  return (<View style={s.wrap}>
    <Text style={s.head}>Chat with @{username}{typing ? ' — typing…' : ''}</Text>
    <FlatList ref={listRef} data={msgs} keyExtractor={(m) => m.id} style={{ flex: 1 }} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      ListEmptyComponent={<Empty text="No messages yet — say hello!" />}
      renderItem={({ item }) => { const mine = item.senderId === user?.id; return (
        <View style={[s.bubble, mine ? s.mine : s.theirs]}><Text style={s.txt}>{item.text}</Text><Text style={s.time}>{new Date(item.createdAt).toLocaleTimeString()}</Text></View>); }} />
    <View style={s.inputRow}><TextInput style={s.input} value={text} onChangeText={onType} placeholder="Message…" placeholderTextColor={COLORS.muted} />
    <TouchableOpacity style={s.send} onPress={send}><Text style={{ color: COLORS.white, fontWeight: 'bold' }}>Send</Text></TouchableOpacity></View>
  </View>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg, padding: 12 },
  head: { color: COLORS.white, fontWeight: 'bold', padding: 8 },
  bubble: { maxWidth: '80%', borderRadius: 14, padding: 10, marginVertical: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: COLORS.red }, theirs: { alignSelf: 'flex-start', backgroundColor: COLORS.surface },
  txt: { color: COLORS.white }, time: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4 },
  inputRow: { flexDirection: 'row', marginTop: 8 },
  input: { flex: 1, backgroundColor: COLORS.surface, color: COLORS.white, borderRadius: 20, paddingHorizontal: 14, height: 42 },
  send: { backgroundColor: COLORS.red, borderRadius: 20, paddingHorizontal: 16, justifyContent: 'center', marginLeft: 8 },
});
