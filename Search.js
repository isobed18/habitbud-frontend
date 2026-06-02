import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import axiosInstance from './services/axiosInstance';
import { unwrapPagination } from './utils/api';
import { haptics } from './utils/feedback';
import Avatar from './components/Avatar';
import EmptyState from './components/EmptyState';
let NOTFOUND_SRC = null;
try { NOTFOUND_SRC = require('./assets/lottie/notfound_sadscope.json'); } catch (_) {}

export default function Search({ navigation }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef(null);

  const runSearch = async (q) => {
    if (q.trim().length < 2) { setResults([]); setSearched(false); return; }
    setLoading(true);
    try {
      const r = await axiosInstance.get(`users/api/search/?q=${encodeURIComponent(q.trim())}`);
      setResults(unwrapPagination(r.data));
      setSearched(true);
    } catch (e) {
      setResults([]); setSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const onChange = (text) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(text), 350);
  };

  const openProfile = (id) => {
    haptics.selection();
    navigation.navigate('FriendProfile', { userId: id });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </Pressable>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#999" />
          <TextInput
            style={styles.input}
            placeholder="Kullanıcı ara..."
            value={query}
            onChangeText={onChange}
            autoFocus
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={18} color="#bbb" />
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} color="#8b5cf6" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(i) => i.id.toString()}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => openProfile(item.id)}>
              <Avatar user={item} size={48} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.sub}>Seviye {item.level} · {item.xp} XP</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </Pressable>
          )}
          ListEmptyComponent={
            searched ? (
              <EmptyState lottie={NOTFOUND_SRC} icon="search-outline" title="Sonuç yok"
                          message="Bu isimde kullanıcı bulamadık." lottieSize={180} />
            ) : (
              <Text style={styles.empty}>En az 2 harf yaz, kullanıcıları ara.</Text>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backBtn: { padding: 4 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 14, height: 44, gap: 8 },
  input: { flex: 1, fontSize: 16 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#8b5cf6', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },
  username: { fontSize: 16, fontWeight: '700', color: '#222' },
  sub: { fontSize: 13, color: '#999', marginTop: 2 },
  empty: { textAlign: 'center', color: '#999', marginTop: 40 },
});
