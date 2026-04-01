import React, { useState } from 'react'
import { ScrollView, Switch, Alert, StyleSheet, View, Text as RNText, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native'
import { Check, LogOut, MapPin } from 'lucide-react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useUser, useLocation } from '../../contexts'
import { CharacterType, CHARACTER_TYPES, CHARACTER_NAMES, CHARACTER_GENDER } from '@yogiya/shared'
import { colors } from '../../constants/design'
import CharacterSprite from '../../components/CharacterSprite'

const MALE_TYPES = CHARACTER_TYPES.filter((t) => CHARACTER_GENDER[t] === 'male')
const FEMALE_TYPES = CHARACTER_TYPES.filter((t) => CHARACTER_GENDER[t] === 'female')

export default function ProfileScreen() {
  const { user, logout, updateCharacter, toggleLocationSharing, updateProfile } = useUser()
  const { isTracking, startRoomTracking, stopRoomTracking } = useLocation()
  const insets = useSafeAreaInsets()
  const [isEditing, setIsEditing] = useState(false)
  const [editedName, setEditedName] = useState(user?.name || '')

  const handleCharacterSelect = async (type: CharacterType) => {
    if (user) await updateCharacter(type, user.characterColor)
  }

  const handleLocationToggle = async (enabled: boolean) => {
    await toggleLocationSharing(enabled)
  }

  const handleLogout = async () => {
    Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await stopRoomTracking()
          await logout()
          router.replace('/')
        },
      },
    ])
  }

  const handleSaveName = async () => {
    if (editedName.trim()) {
      await updateProfile(editedName.trim())
      setIsEditing(false)
    }
  }

  if (!user) {
    return (
      <View style={[s.screen, s.centered]}>
        <ActivityIndicator color={colors.accent.DEFAULT} />
      </View>
    )
  }

  return (
    <ScrollView testID="profile_screen" style={s.screen} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: 48 }}>
      <View style={[s.pageHeader, { paddingTop: insets.top + 12 }]}>
        <RNText style={s.pageTitle}>내 정보</RNText>
      </View>

      <View style={s.card}>
        <View style={s.profileRow}>
          <CharacterSprite type={user.characterType} direction="south" animation="idle" size={68} />
          <View style={s.profileInfo}>
            {isEditing ? (
              <View style={s.editRow}>
                <TextInput
                  style={s.nameInput}
                  value={editedName}
                  onChangeText={setEditedName}
                  autoFocus
                  selectionColor={colors.accent.DEFAULT}
                />
                <TouchableOpacity onPress={handleSaveName} style={s.checkBtn} activeOpacity={0.7}>
                  <Check size={18} color={colors.accent.DEFAULT} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.7}>
                <RNText style={s.profileName}>{user.name || '이름 없음'}</RNText>
                <RNText style={s.profileEdit}>탭하여 수정</RNText>
              </TouchableOpacity>
            )}
            <RNText style={s.profileEmail}>{user.email}</RNText>
          </View>
        </View>
      </View>

      <View style={s.sectionHeader}>
        <RNText style={s.sectionTitle}>캐릭터</RNText>
      </View>
      <View style={s.card}>
        <RNText style={s.genderLabel}>남자</RNText>
        <View style={s.charRow}>
          {MALE_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[s.charCard, user.characterType === type && s.charCardSelected]}
              onPress={() => handleCharacterSelect(type)}
              activeOpacity={0.7}
            >
              <CharacterSprite type={type} direction="south" animation="idle" size={52} />
              <RNText style={[s.charName, user.characterType === type && s.charNameSelected]}>
                {CHARACTER_NAMES[type]}
              </RNText>
            </TouchableOpacity>
          ))}
        </View>
        <RNText style={[s.genderLabel, { marginTop: 12 }]}>여자</RNText>
        <View style={s.charRow}>
          {FEMALE_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[s.charCard, user.characterType === type && s.charCardSelected]}
              onPress={() => handleCharacterSelect(type)}
              activeOpacity={0.7}
            >
              <CharacterSprite type={type} direction="south" animation="idle" size={52} />
              <RNText style={[s.charName, user.characterType === type && s.charNameSelected]}>
                {CHARACTER_NAMES[type]}
              </RNText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.sectionHeader}>
        <RNText style={s.sectionTitle}>설정</RNText>
      </View>
      <View style={s.card}>
        <View style={s.settingRow}>
          <View style={s.settingLeft}>
            <View style={s.settingIconWrap}>
              <MapPin size={16} color={colors.accent.DEFAULT} strokeWidth={2} />
            </View>
            <View style={s.settingText}>
              <RNText style={s.settingLabel}>위치 공유</RNText>
              <RNText style={s.settingDesc}>
                {user.locationSharingEnabled ? '친구들에게 내 위치가 표시됩니다' : '위치 공유가 꺼져 있습니다'}
              </RNText>
            </View>
          </View>
          <Switch
            value={user.locationSharingEnabled}
            onValueChange={handleLocationToggle}
            trackColor={{ false: colors.border.default, true: colors.accent.DEFAULT }}
            thumbColor={colors.white}
          />
        </View>
        {isTracking && (
          <View style={s.trackingRow}>
            <View style={s.trackingDot} />
            <RNText style={s.trackingText}>위치 추적 중...</RNText>
          </View>
        )}
      </View>

      <View style={s.sectionHeader}>
        <RNText style={s.sectionTitle}>계정</RNText>
      </View>
      <View style={s.card}>
        <TouchableOpacity style={s.logoutRow} onPress={handleLogout} activeOpacity={0.7}>
          <LogOut size={17} color={colors.error} strokeWidth={1.75} />
          <RNText style={s.logoutText}>로그아웃</RNText>
        </TouchableOpacity>
      </View>

      <RNText style={s.version}>Yogiya v1.0.0</RNText>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#09090B' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  pageHeader: { paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#27272A' },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#FAFAFA', letterSpacing: -0.4 },
  card: {
    backgroundColor: '#111113',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#27272A',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 0,
    borderCurve: 'continuous',
  },
  sectionHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#52525B', letterSpacing: 0.5, textTransform: 'uppercase' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  profileInfo: { flex: 1 },
  editRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#3B82F6',
    paddingBottom: 2,
    paddingHorizontal: 0,
  },
  checkBtn: { padding: 6, marginLeft: 8 },
  profileName: { fontSize: 19, fontWeight: '700', color: '#FAFAFA', marginBottom: 2 },
  profileEdit: { fontSize: 12, color: '#3B82F6', marginBottom: 4 },
  profileEmail: { fontSize: 13, color: '#71717A' },
  genderLabel: { fontSize: 12, color: '#52525B', marginBottom: 8 },
  charRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  charCard: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#18181B',
    width: '30%',
  },
  charCardSelected: { borderColor: '#3B82F6', backgroundColor: '#0F1E3D' },
  charName: { fontSize: 11, color: '#71717A', marginTop: 4, textAlign: 'center' },
  charNameSelected: { color: '#60A5FA' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderCurve: 'continuous',
    backgroundColor: '#0F1E3D',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: '#FAFAFA' },
  settingDesc: { fontSize: 12, color: '#71717A', marginTop: 1 },
  trackingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#27272A' },
  trackingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E', marginRight: 8 },
  trackingText: { fontSize: 13, color: '#22C55E' },
  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  logoutText: { fontSize: 15, fontWeight: '500', color: '#EF4444' },
  version: { fontSize: 12, color: '#3F3F46', textAlign: 'center', marginTop: 28 },
})
