import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Dimensions, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api } from '../api/client';
import type { VideoItem } from '../api/types';
import { COLORS } from '../theme';
import { Empty, Loading } from '../components/ui';
const W = Dimensions.get('window').width / 3;
export default function HashtagScreen() {
  const nav = useNavigation<any>(); const route = useRoute<any>(); const tag = route.params?.tag as string;
  const [videos, setVideos] = useState<VideoItem[]>([]); const [loading, setLoading] = useState(true);
  useEffect(() => { api.hashtagVideos(tag).then(setVideos).catch(() => setVideos([])).finally(() => setLoading(false)); }, [tag]);
  if (loading) return <Loading />;
  return (<View style={s.wrap}>
    <Text style={s.title}>#{tag}</Text><Text style={s.sub}>{videos.length} videos</Text>
    <FlatList data={videos} numColumns={3} keyExtractor={(v) => v.id} ListEmptyComponent={<Empty text={`No videos with #${tag} yet.`} />}
      renderItem={({ item }) => (<TouchableOpacity style={{ width: W, height: W * 1.4, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.bg, alignItems: 'center', justifyContent: 'center' }} onPress={() => nav.navigate('Comments', { videoId: item.id })}>
        {item.thumbnailUrl ? <Image source={{ uri: item.thumbnailUrl }} style={{ width: '100%', height: '100%' }} /> : <Text style={{ color: COLORS.white }}>▶</Text>}
      </TouchableOpacity>)} />
  </View>);
}
const s = StyleSheet.create({ wrap: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 8 }, title: { color: COLORS.white, fontSize: 24, fontWeight: 'bold', paddingHorizontal: 16 }, sub: { color: COLORS.gray, paddingHorizontal: 16, marginBottom: 12 } });
