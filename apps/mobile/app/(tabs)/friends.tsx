import React, { useState, useEffect, useCallback } from 'react'
import { FlatList, Switch, Alert, Modal, View, Text as RNText, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native'
import { UserPlus, Users, X } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUser, useWebSocket } from '../../contexts'
import { CHARACTER_NAMES, CharacterType } from '@yogiya/shared'
import { api, ApiFriend } from '../../lib/api'
import CharacterSprite from '../../components/CharacterSprite'
import { colors } from '../../constants/design'

export default function FriendsScreen() {
  const { user } = useUser()
  const { onlineStatus, friendLocations, isConnected } = useWebSocket()
  const insets = useSafeAreaInsets()
  const [friends, setFriends] = useState<ApiFriend[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [friendCode, setFriendCode] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const loadFriends = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const data = await api.getFriends(user.id)
      setFriends(data)
    } catch (error) {
      console.error('Failed to load friends:', error)
      Alert.alert('오류', '친구 목록을 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadFriends()
  }, [loadFriends])

  const handleAddFriend = async () => {
    if (!user || !friendCode.trim()) return
    setIsAdding(true)
    try {
      await api.addFriend(user.id, friendCode.trim())
      setShowAddModal(false)
      setFriendCode('')
      Alert.alert('성공', '친구 요청을 보냈습니다.')
    } catch (error) {
      Alert.alert('오류', '친구 요청에 실패했습니다.')
    } finally {
      setIsAdding(false)
    }
  }

  const toggleLocationSharing = (friendId: string, enabled: boolean) => {
    setFriends((prev) => prev.map((f) => f.userId === friendId ? { ...f, locationSharingEnabled: enabled } : f))
  }

  const renderFriend = ({ item, index }: { item: ApiFriend; index: number }) => {
    const characterName = CHARACTER_NAMES[item.characterType as keyof typeof CHARACTER_NAMES] || '캐릭터'
    const isOnline = onlineStatus[item.userId] || !!friendLocations[item.userId]
    const isLast = index === friends.length - 1

    return (
      <View style={[s.friendItem, !isLast && s.friendItemBorder]}>
        <View style={s.avatarWrap}>
          <View style={[s.avatar, { borderColor: item.characterColor }]}>
            <CharacterSprite type={item.characterType as CharacterType} size={38} />
          </View>
          <View style={[s.onlineDot, { backgroundColor: isOnline ? colors.success : colors.border.default }]} />
        </View>
        <View style={s.friendInfo}>
          <RNText style={s.friendName}>{item.name || '익명'}</RNText>
          <RNText style={s.friendSub}>{characterName}</RNText>
        </View>
        <Switch
          value={item.locationSharingEnabled}
          onValueChange={(v) => toggleLocationSharing(item.userId, v)}
          trackColor={{ false: colors.border.default, true: colors.accent.DEFAULT }}
          thumbColor={colors.white}
        />
      </View>
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
    <View testID="friends_screen" style={s.screen}>
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View style={s.headerLeft}>
          <RNText style={s.headerTitle}>친구</RNText>
          <View style={[s.connDot, { backgroundColor: isConnected ? colors.success : colors.warning }]} />
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.7}>
          <UserPlus size={20} color={colors.text.secondary} strokeWidth={1.75} />
        </TouchableOpacity>
      </View>

      {friends.length === 0 ? (
        <View style={[s.centered, { flex: 1 }]}>
          <Users size={44} color={colors.text.disabled} strokeWidth={1.25} />
          <RNText style={s.emptyTitle}>아직 친구가 없습니다</RNText>
          <RNText style={s.emptyBody}>친구 코드로 친구를 추가해보세요</RNText>
          <TouchableOpacity style={s.addBtn} onPress={() => setShowAddModal(true)} activeOpacity={0.8}>
            <RNText style={s.addBtnText}>친구 추가하기</RNText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={friends}
          renderItem={renderFriend}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          onRefresh={loadFriends}
          refreshing={isLoading}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingTop: 8 }}
        />
      )}

      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <RNText style={s.modalTitle}>친구 추가</RNText>
              <TouchableOpacity onPress={() => { setShowAddModal(false); setFriendCode('') }} activeOpacity={0.7}>
                <X size={20} color={colors.text.secondary} strokeWidth={1.75} />
              </TouchableOpacity>
            </View>
            <RNText style={s.modalSub}>친구의 사용자 ID를 입력하세요</RNText>
            <TextInput
              style={s.modalInput}
              value={friendCode}
              onChangeText={setFriendCode}
              placeholder="사용자 ID"
              placeholderTextColor={colors.text.disabled}
              autoFocus
              selectionColor={colors.accent.DEFAULT}
            />
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancel}
                onPress={() => { setShowAddModal(false); setFriendCode('') }}
                activeOpacity={0.7}
              >
                <RNText style={s.modalCancelText}>취소</RNText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirm, (!friendCode.trim() || isAdding) && s.modalConfirmDisabled]}
                onPress={handleAddFriend}
                disabled={!friendCode.trim() || isAdding}
                activeOpacity={0.8}
              >
                {isAdding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <RNText style={s.modalConfirmText}>추가</RNText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  friendItemBorder: { borderBottomWidth: 1, borderBottomColor: '#18181B' },
  avatarWrap: { position: 'relative', marginRight: 14 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  friendInfo: { flex: 1 },
  friendName: { fontSize: 15, fontWeight: '600', color: '#FAFAFA', marginBottom: 2 },
  friendSub: { fontSize: 13, color: '#71717A' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#A1A1AA', marginTop: 16, marginBottom: 4 },
  emptyBody: { fontSize: 14, color: '#52525B', marginBottom: 24 },
  addBtn: { backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 8, borderCurve: 'continuous' },
  addBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  modalCard: {
    width: '85%',
    maxWidth: 320,
    backgroundColor: '#111113',
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272A',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#FAFAFA' },
  modalSub: { fontSize: 13, color: '#71717A', marginBottom: 16 },
  modalInput: {
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 8,
    borderCurve: 'continuous',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    color: '#FAFAFA',
    marginBottom: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#27272A',
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 15, fontWeight: '500', color: '#A1A1AA' },
  modalConfirm: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  modalConfirmDisabled: { opacity: 0.4 },
  modalConfirmText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
})
