import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Dimensions, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { api } from '../api/client';
import type { VideoItem } from '../api/types';
import VideoCard from '../components/VideoCard';
import CommentSheet from '../components/CommentSheet';
import { COLORS } from '../theme';
import { Empty, Loading } from '../components/ui';

const { height } = Dimensions.get('window');
export default function HomeScreen() {
  const nav = useNavigation<any>();
  const [tab, setTab] = useState<'for_you' | 'following'>('for_you');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentVideo, setCommentVideo] = useState<VideoItem | null>(null);

  const load = useCallback(async (reset = false) => {
    try {
      if (reset) setLoading(true);
      const page = await api.getFeed(tab, 10, reset ? undefined : cursor);
      setVideos((p) => reset ? page.videos : [...p, ...page.videos]);
      setCursor(page.nextCursor || undefined);
    } catch (e: any) { Alert.alert('Feed', e.message); }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab, cursor]);

  useEffect(() => { setVideos([]); setCursor(undefined); setActive(0); load(true); }, [tab]);
  useFocusEffect(useCallback(() => { if (videos.length === 0) load(true); return () => {}; }, []));

  const onViewable = useRef(({ viewableItems }: any) => { if (viewableItems.length) setActive(viewableItems[0].index ?? 0); }).current;
  if (loading && videos.length === 0) return <Loading />;
  return (
    <View style={s.wrap}>
      <View style={s.top}>
        <TouchableOpacity onPress={() => nav.navigate('Live')}><Text style={s.live}>● LIVE</Text></TouchableOpacity>
        <View style={s.tabs}>
          <TouchableOpacity onPress={() => setTab('following')}><Text style={[s.tab, tab === 'following' && s.tabOn]}>Following</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setTab('for_you')}><Text style={[s.tab, tab === 'for_you' && s.tabOn]}>For You</Text></TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => nav.navigate('Search')}><Text style={s.search}>🔍</Text></TouchableOpacity>
      </View>
      <FlatList data={videos} keyExtractor={(v) => v.id} pagingEnabled snapToInterval={height} decelerationRate="fast"
        showsVerticalScrollIndicator={false} onViewableItemsChanged={onViewable} viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onEndReached={() => { if (cursor) load(false); }} onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(true); }} tintColor={COLORS.red} />}
        ListEmptyComponent={<Empty text={tab === 'following' ? 'No videos from people you follow yet — follow creators to fill this feed!' : 'No videos yet — be the first to upload!'} />}
        renderItem={({ item, index }) => <VideoCard item={item} active={index === active} onOpenComments={setCommentVideo} />} />
      <CommentSheet video={commentVideo} visible={!!commentVideo} onClose={() => setCommentVideo(null)} />
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.bg },
  top: { position: 'absolute', top: 48, left: 0, right: 0, zIndex: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16 },
  live: { color: COLORS.red, fontWeight: 'bold' }, search: { fontSize: 20 },
  tabs: { flexDirection: 'row' }, tab: { color: COLORS.gray, fontSize: 16, marginHorizontal: 10, fontWeight: 'bold' }, tabOn: { color: COLORS.white, borderBottomWidth: 2, borderBottomColor: COLORS.red },
});
