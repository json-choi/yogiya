import React, { useState, useEffect, useCallback } from 'react'
import { FlatList, View, Text as RNText, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { PenSquare, MessageSquare, Users } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUser, useWebSocket } from '../../contexts'
import { CharacterType } from '@yogiya/shared'
import { api, ApiChat } from '../../lib/api'
import { colors } from '../../constants/design'
import CharacterSprite from '../../components/CharacterSprite'

function formatTime(timestamp: number): string {
  const now = new Date()
  const date = new Date(timestamp)
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) {
    const h = date.getHours()
    const m = date.getMinutes()
    const period = h >= 12 ? '오후' : '오전'
    const dh = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${period} ${dh}:${m.toString().padStart(2, '0')}`
  }
  if (diffDays === 1) return '어제'
  if (diffDays < 7) return ['일', '월', '화', '수', '목', '금', '토'][date.getDay()] + '요일'
  return `${date.getMonth() + 1}월 ${date.getDate()}일`
}

export default function ChatsScreen() {
  const { user } = useUser()
  const { isConnected, onlineStatus } = useWebSocket()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [chatRooms, setChatRooms] = useState<ApiChat[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadChatRooms = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const data = await api.getChats(user.id)
      setChatRooms(data)
    } catch (error) {
      console.error('Failed to load chats:', error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadChatRooms()
  }, [loadChatRooms])

  const handleChatPress = (chat: ApiChat) => {
    if (chat.type === 'direct' && chat.friend) router.push(`/chat/${chat.friend.id}`)
    else if (chat.type === 'room') router.push(`/room/${chat.id}`)
  }

  const renderChatRoom = ({ item, index }: { item: ApiChat; index: number }) => {
    const isDirect = item.type === 'direct'
    const characterType = item.friend?.characterType || 'boy_casual'
    const characterColor = item.friend?.characterColor || colors.border.default
    const name = isDirect ? item.friend?.name || '익명' : item.name || `방 ${item.id}`
    const isOnline = isDirect && item.friend && onlineStatus[item.friend.id]
    const isLast = index === chatRooms.length - 1

    return (
      <TouchableOpacity
        style={[s.chatItem, !isLast && s.chatItemBorder]}
        onPress={() => handleChatPress(item)}
        activeOpacity={0.6}
      >
        <View style={s.avatarWrap}>
          <View style={[s.avatar, { borderColor: characterColor }]}>
            <CharacterSprite type={characterType as CharacterType} size={44} />
          </View>
          {isDirect && (
            <View style={[s.onlineDot, { backgroundColor: isOnline ? colors.success : colors.border.default }]} />
          )}
          {!isDirect && (
            <View style={s.groupBadge}>
              <Users size={9} color="#FAFAFA" strokeWidth={2} />
            </View>
          )}
        </View>

        <View style={s.chatContent}>
          <View style={s.chatTopRow}>
            <RNText style={s.chatName} numberOfLines={1}>{name}</RNText>
            {item.lastMessage && (
              <RNText style={s.chatTime}>{formatTime(item.lastMessage.timestamp)}</RNText>
            )}
          </View>
          <View style={s.chatBottomRow}>
            <RNText style={s.chatPreview} numberOfLines={1}>
              {item.lastMessage?.content || '새로운 대화를 시작하세요'}
            </RNText>
            {item.unreadCount > 0 && (
              <View style={s.unreadBadge}>
                <RNText style={s.unreadText}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </RNText>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  if (isLoading) {
    return (
      <View style={[s.screen, s.centered]}>
        <ActivityIndicator color={colors.accent.DEFAULT} />
      </View>
    )
  }

  return (
    <View testID="chats_screen" style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.headerLeft}>
          <RNText style={s.headerTitle}>채팅</RNText>
          <View style={[s.connDot, { backgroundColor: isConnected ? colors.success : colors.warning }]} />
        </View>
        <TouchableOpacity style={s.headerBtn} activeOpacity={0.7}>
          <PenSquare size={20} color={colors.text.secondary} strokeWidth={1.75} />
        </TouchableOpacity>
      </View>

      {chatRooms.length === 0 ? (
        <View style={[s.centered, { flex: 1 }]}>
          <MessageSquare size={44} color={colors.text.disabled} strokeWidth={1.25} />
          <RNText style={s.emptyTitle}>채팅이 없습니다</RNText>
          <RNText style={s.emptyBody}>친구와 대화를 시작해보세요</RNText>
        </View>
      ) : (
        <FlatList
          data={chatRooms}
          renderItem={renderChatRoom}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          onRefresh={loadChatRooms}
          refreshing={isLoading}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingTop: 8 }}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09090B' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#27272A',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#FAFAFA', letterSpacing: -0.4 },
  connDot: { width: 7, height: 7, borderRadius: 4 },
  headerBtn: { padding: 4 },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
  },
  chatItemBorder: { borderBottomWidth: 1, borderBottomColor: '#18181B' },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    backgroundColor: '#111113',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#09090B',
  },
  groupBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#09090B',
  },
  chatContent: { flex: 1 },
  chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  chatName: { fontSize: 15, fontWeight: '600', color: '#FAFAFA', flex: 1, marginRight: 8 },
  chatTime: { fontSize: 12, color: '#52525B' },
  chatBottomRow: { flexDirection: 'row', alignItems: 'center' },
  chatPreview: { fontSize: 13, color: '#71717A', flex: 1, marginRight: 8 },
  unreadBadge: {
    backgroundColor: '#3B82F6',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { fontSize: 11, fontWeight: '700', color: '#FFFFFF' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#A1A1AA', marginTop: 16, marginBottom: 4 },
  emptyBody: { fontSize: 14, color: '#52525B' },
})
