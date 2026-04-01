import React, { useState } from 'react'
import { ScrollView, Alert, StyleSheet, TextInput, TouchableOpacity, View, Text as RNText } from 'react-native'
import { useRouter } from 'expo-router'
import {
  CharacterType,
  CHARACTER_TYPES,
  CHARACTER_NAMES,
  CHARACTER_GENDER,
} from '@yogiya/shared'
import { useUser } from '../contexts'
import { Spinner } from '../components/ui'
import CharacterSprite from '../components/CharacterSprite'
import { colors } from '../constants/design'

const MALE_TYPES = CHARACTER_TYPES.filter((t) => CHARACTER_GENDER[t] === 'male')
const FEMALE_TYPES = CHARACTER_TYPES.filter((t) => CHARACTER_GENDER[t] === 'female')

export default function OnboardingScreen() {
  const router = useRouter()
  const { onboard } = useUser()
  const [name, setName] = useState('')
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterType>('boy_casual')
  const [isLoading, setIsLoading] = useState(false)

  const handleStart = async () => {
    if (!name.trim()) return
    setIsLoading(true)
    try {
      await onboard(name.trim(), selectedCharacter, '#3B82F6')
      router.replace('/(tabs)/map')
    } catch (error) {
      console.error('Onboarding failed:', error)
      Alert.alert('오류', '서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해주세요.', [
        { text: '확인' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ScrollView testID="onboarding_screen" style={s.scroll} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={s.content}>
      <View style={s.header}>
        <RNText style={s.title}>시작하기</RNText>
        <RNText style={s.subtitle}>캐릭터를 선택하고 이름을 입력해주세요</RNText>
      </View>

      <View style={s.section}>
        <RNText style={s.label}>이름</RNText>
        <TextInput
          testID="name_input"
          style={s.input}
          value={name}
          onChangeText={setName}
          placeholder="친구들에게 보일 이름"
          placeholderTextColor={colors.text.disabled}
          maxLength={20}
          autoFocus
          selectionColor={colors.accent.DEFAULT}
        />
      </View>

      <View style={s.section}>
        <RNText style={s.label}>캐릭터 선택</RNText>
        <RNText style={s.genderLabel}>남자</RNText>
        <View style={s.row}>
          {MALE_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              testID={`character_${type}`}
              style={[s.characterCard, selectedCharacter === type && s.characterCardSelected]}
              onPress={() => setSelectedCharacter(type)}
              activeOpacity={0.7}
            >
              <CharacterSprite type={type} direction="south" animation="idle" size={60} />
              <RNText style={[s.characterName, selectedCharacter === type && s.characterNameSelected]}>
                {CHARACTER_NAMES[type]}
              </RNText>
            </TouchableOpacity>
          ))}
        </View>
        <RNText style={s.genderLabel}>여자</RNText>
        <View style={s.row}>
          {FEMALE_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              testID={`character_${type}`}
              style={[s.characterCard, selectedCharacter === type && s.characterCardSelected]}
              onPress={() => setSelectedCharacter(type)}
              activeOpacity={0.7}
            >
              <CharacterSprite type={type} direction="south" animation="idle" size={60} />
              <RNText style={[s.characterName, selectedCharacter === type && s.characterNameSelected]}>
                {CHARACTER_NAMES[type]}
              </RNText>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={s.preview}>
        <CharacterSprite type={selectedCharacter} direction="south" animation="idle" size={88} />
        <RNText style={s.previewName}>{name || '이름을 입력하세요'}</RNText>
      </View>

      <TouchableOpacity
        testID="start_button"
        style={[s.button, (!name.trim() || isLoading) && s.buttonDisabled]}
        onPress={handleStart}
        disabled={!name.trim() || isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <Spinner size="small" color={colors.white} />
        ) : (
          <RNText style={s.buttonText}>시작하기</RNText>
        )}
      </TouchableOpacity>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#09090B' },
  content: { paddingHorizontal: 24, paddingTop: 72, paddingBottom: 48 },
  header: { marginBottom: 40 },
  title: { fontSize: 28, fontWeight: '700', color: '#FAFAFA', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: '#71717A', lineHeight: 22 },
  section: { marginBottom: 32 },
  label: { fontSize: 13, fontWeight: '500', color: '#A1A1AA', marginBottom: 10, letterSpacing: 0.2 },
  input: {
    backgroundColor: '#111113',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: '#FAFAFA',
  },
  genderLabel: { fontSize: 12, color: '#52525B', marginBottom: 8, marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  characterCard: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#111113',
    width: '30%',
  },
  characterCardSelected: {
    borderColor: '#3B82F6',
    backgroundColor: '#0F1E3D',
  },
  characterName: { fontSize: 11, color: '#71717A', marginTop: 5, textAlign: 'center' },
  characterNameSelected: { color: '#60A5FA' },
  preview: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 32,
    backgroundColor: '#111113',
    borderRadius: 12,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: '#27272A',
  },
  previewName: { marginTop: 10, fontSize: 17, fontWeight: '600', color: '#FAFAFA' },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 15,
    borderRadius: 10,
    borderCurve: 'continuous',
    alignItems: 'center',
    marginBottom: 24,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.1 },
})
