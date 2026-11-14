import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Alert } from 'react-native';
import { api } from '../api/client';
import type { CreatorStats } from '../api/types';
import { COLORS } from '../theme';
import { Loading, Empty } from '../components/ui';
export default function CreatorDashboardScreen() {
  const [stats, setStats] = useState<CreatorStats | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getCreatorStats().then(setStats).catch((e) => Alert.alert('Creator Dashboard', e.message)).finally(() => setLoading(false)); }, []);
  if (loading) return <Loading />;
  if (!stats) return <Empty text="No creator stats yet — upload your first video!" />;
  const cards = [
    { l: 'Videos', v: stats.totalVideos }, { l: 'Views', v: stats.totalViews },
    { l: 'Likes', v: stats.totalLikes }, { l: 'Followers', v: stats.totalFollowers },
  ];
  return (<ScrollView style={s.wrap} contentContainerStyle={{ padding: 20, paddingTop: 56 }}>
    <Text style={s.title}>Creator Dashboard</Text>
    <View style={s.grid}>{cards.map((c) => (<View key={c.l} style={s.card}><Text style={s.num}>{c.v}</Text><Text style={s.lbl}>{c.l}</Text></View>))}</View>
    <Text style={s.h}>Views — last 7 days</Text>
    {(stats.viewsLast7Days || []).length === 0 ? <Text style={s.empty}>No views in the last 7 days yet.</Text> :
      (stats.viewsLast7Days || []).map((d) => (<View key={d.date} style={s.row}><Text style={s.date}>{d.date}</Text><Text style={s.num2}>{d.views} views</Text></View>))}
    <Text style={s.h}>Top videos</Text>
    {(stats.topVideos || []).length === 0 ? <Text style={s.empty}>No top videos yet.</Text> :
      (stats.topVideos || []).map((v) => (<View key={v.id} style={s.row}><Text style={s.date} numberOfLines={1}>{v.caption || v.id}</Text><Text style={s.num2}>{v.viewsCount} views</Text></View>))}
  </ScrollView>);
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  title: { color: COLORS.white, fontSize: 26, fontWeight: 'bold' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 },
  card: { width: '47%', backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, margin: '1.5%' },
  num: { color: COLORS.cyan, fontSize: 24, fontWeight: 'bold' }, lbl: { color: COLORS.gray, marginTop: 4 },
  h: { color: COLORS.white, fontSize: 18, fontWeight: 'bold', marginTop: 24, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  date: { color: COLORS.white, flex: 1 }, num2: { color: COLORS.gray }, empty: { color: COLORS.gray },
});
