import 'expo-sqlite/localStorage/install'
import React, { createContext, useState, useEffect, useCallback, useRef } from 'react'
import { Alert, Linking } from 'react-native'
import * as Location from 'expo-location'
import * as TaskManager from 'expo-task-manager'
import { useWebSocket } from './WebSocketContext'
import { useUser } from './UserContext'

const LOCATION_TASK_NAME = 'background-location-task'
const WS_URL = process.env.EXPO_PUBLIC_WS_URL || 'ws://localhost:3000'

const BG_WS_URL_KEY = '@bg_ws_url'
const BG_USER_ID_KEY = '@bg_user_id'
const BG_ROOM_CODE_KEY = '@bg_room_code'
const DISCLOSURE_SHOWN_KEY = '@location_disclosure_shown'

interface LocationContextType {
  currentLocation: Location.LocationObject | null
  isTracking: boolean
  requestPermission: () => Promise<boolean>
  startRoomTracking: (roomCode: string) => Promise<void>
  stopRoomTracking: () => Promise<void>
}

const LocationContext = createContext<LocationContextType | undefined>(undefined)

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }: any) => {
  if (error) {
    console.error('Background location task error:', error)
    return
  }
  if (!data) return

  const { locations } = data as { locations: Location.LocationObject[] }
  const location = locations[0]
  if (!location) return

  try {
    const wsUrl = localStorage.getItem(BG_WS_URL_KEY)
    const userId = localStorage.getItem(BG_USER_ID_KEY)
    const roomCode = localStorage.getItem(BG_ROOM_CODE_KEY)

    if (!userId || !roomCode) return

    const baseUrl = (wsUrl || WS_URL)
      .replace(/^wss:\/\//, 'https://')
      .replace(/^ws:\/\//, 'http://')
      .replace(/\/ws$/, '')

    const payload = JSON.stringify({
      userId,
      roomCode,
      lat: location.coords.latitude,
      lng: location.coords.longitude,
      accuracy: location.coords.accuracy ?? undefined,
      speed: location.coords.speed ?? undefined,
    })

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await fetch(`${baseUrl}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        })
        break
      } catch (e) {
        if (attempt === 2) console.error('Background location send failed after 3 attempts:', e)
      }
    }
  } catch (e) {
    console.error('Background location task failed:', e)
  }
})

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const { sendLocation } = useWebSocket()
  const { user } = useUser()
  const foregroundSubRef = useRef<Location.LocationSubscription | null>(null)

  const requestPermission = useCallback(async () => {
    try {
      const disclosureShown = localStorage.getItem(DISCLOSURE_SHOWN_KEY)
      if (!disclosureShown) {
        await new Promise<void>((resolve) => {
          Alert.alert(
            '📍 위치 공유 안내',
            'Yogiya는 방 멤버들과의 만남을 위해 앱이 백그라운드에 있거나 사용 중이지 않을 때도 위치 정보를 수집합니다.\n\n수집된 위치 정보는 같은 방의 멤버에게만 공유되며, 모든 멤버가 만나면 자동으로 공유가 종료됩니다.',
            [{ text: '확인', onPress: () => resolve() }],
            { cancelable: false },
          )
        })
        localStorage.setItem(DISCLOSURE_SHOWN_KEY, 'true')
      }

      const { status: fg } = await Location.requestForegroundPermissionsAsync()
      if (fg !== 'granted') return false

      const { status: bg } = await Location.requestBackgroundPermissionsAsync()
      if (bg !== 'granted') {
        if (process.env.EXPO_OS === 'ios') {
          await new Promise<void>((resolve) => {
            Alert.alert(
              '백그라운드 위치 권한 필요',
              '백그라운드에서도 위치 공유가 되려면 설정에서 위치 권한을 "항상 허용"으로 변경해주세요.',
              [
                { text: '나중에', style: 'cancel', onPress: () => resolve() },
                { text: '설정 열기', onPress: () => { Linking.openURL('app-settings:'); resolve() } },
              ],
            )
          })
        }
        return false
      }
      return true
    } catch (e) {
      console.error('Location permission request failed:', e)
      return false
    }
  }, [])

  const startRoomTracking = useCallback(async (roomCode: string) => {
    if (!user) return

    const hasPermission = await requestPermission()
    if (!hasPermission) return

    // 기존 태스크가 실행 중이면 먼저 중지
    foregroundSubRef.current?.remove()
    foregroundSubRef.current = null
    const wasRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)
    if (wasRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
    }

    localStorage.setItem(BG_WS_URL_KEY, WS_URL)
    localStorage.setItem(BG_USER_ID_KEY, user.id)
    localStorage.setItem(BG_ROOM_CODE_KEY, roomCode)

    foregroundSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
        distanceInterval: 5,
      },
      (loc) => {
        setCurrentLocation(loc)
        sendLocation(
          loc.coords.latitude,
          loc.coords.longitude,
          loc.coords.accuracy ?? undefined,
          loc.coords.speed ?? undefined,
        )
      },
    )

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.High,
      timeInterval: 10000,
      distanceInterval: 5,
      foregroundService: {
        notificationTitle: 'Location Messenger - 위치 공유 중',
        notificationBody: '방 멤버들에게 위치를 공유하고 있습니다. 탭하여 앱으로 이동.',
        notificationColor: '#00A5CF',
        killServiceOnDestroy: false,
      },
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
    })

    setIsTracking(true)
  }, [user, requestPermission, sendLocation])

  const stopRoomTracking = useCallback(async () => {
    foregroundSubRef.current?.remove()
    foregroundSubRef.current = null

    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false)
    if (isRunning) {
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME)
    }

    localStorage.removeItem(BG_USER_ID_KEY)
    localStorage.removeItem(BG_ROOM_CODE_KEY)
    setIsTracking(false)
  }, [])

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null

    const init = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') return

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setCurrentLocation(loc)

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 10 },
        (newLoc) => setCurrentLocation(newLoc),
      )
    }

    init().catch(console.error)

    return () => { sub?.remove() }
  }, [])

  useEffect(() => {
    if (user?.id) {
      localStorage.setItem('@current_user_id', user.id)
    }
  }, [user?.id])

  return (
    <LocationContext.Provider value={{ currentLocation, isTracking, requestPermission, startRoomTracking, stopRoomTracking }}>
      {children}
    </LocationContext.Provider>
  )
}

export function useLocation() {
  const context = React.use(LocationContext)
  if (!context) throw new Error('useLocation must be used within a LocationProvider')
  return context
}
