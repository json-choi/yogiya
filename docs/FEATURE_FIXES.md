# Feature Fixes & Improvements

> 현재 동작하지 않거나 미구현된 5가지 핵심 기능의 분석과 구현 스펙
> Last Updated: 2026-04-02

---

## 1. 목표지점 설정 (Destination Setting)

### 현재 상태: 부분 동작

### 문제 분석

| 위치 | 문제 |
|------|------|
| [map.tsx:219-232](apps/mobile/app/(tabs)/map.tsx) | `saveDestination`이 HTTP PATCH만 호출, WS broadcast 없음 |
| [api/index.ts:315-327](packages/api/src/index.ts) | PATCH 엔드포인트가 DB만 업데이트, WS 서버에 알리지 않음 |
| [ws-server/index.ts:302-318](packages/ws-server/src/index.ts) | `set_destination` WS 핸들러는 존재하지만 모바일이 호출하지 않음 |

**근본 원인:** 모바일 → HTTP API → DB 저장까지는 되지만, **다른 유저에게 실시간 전파가 안 됨**. WS broadcast 경로가 끊겨있음.

### 수정 스펙

```
모바일 클라이언트:
  1. 지도 롱프레스 → saveDestination(lat, lng) 호출
  2. HTTP PATCH /api/rooms/:code/destination → DB 저장
  3. 성공 후 WS로 set_destination 메시지 전송 ← 추가 필요
  4. 로컬 roomInfo 상태 즉시 업데이트 ← 추가 필요

WS 서버 (이미 구현됨):
  1. set_destination 메시지 수신
  2. DB 업데이트 (이미 구현)
  3. destination_updated를 방 전체에 broadcast (이미 구현)

모바일 클라이언트 수신:
  1. destination_updated 메시지 수신 시 roomInfo 상태 업데이트 ← 확인 필요
```

### 변경 대상 파일

| 파일 | 변경 |
|------|------|
| `apps/mobile/app/(tabs)/map.tsx` | `saveDestination` 후 WS 메시지 전송 추가 |
| `apps/mobile/contexts/WebSocketContext.tsx` | `destination_updated` 수신 시 roomInfo 업데이트 확인 |

### E2E 테스트 시나리오

```yaml
# destination_set.yaml
- 방 생성
- "목표지점" FAB 탭
- "지도를 길게 눌러 목표지점을 찍어주세요" 안내 확인
- 지도 롱프레스
- 목적지 마커 표시 확인
- ETA 카드 표시 확인 ("목표까지" 텍스트)
- "목표 삭제" FAB으로 전환 확인
```

---

## 2. 캐릭터 방향 전환 (Character Direction)

### 현재 상태: 부분 동작

### 문제 분석

| 위치 | 문제 |
|------|------|
| [map.tsx:342-346](apps/mobile/app/(tabs)/map.tsx) | 내 캐릭터 방향: dx/dy로 계산 → 정상 |
| [WebSocketContext.tsx:61-92](apps/mobile/contexts/WebSocketContext.tsx) | 친구 캐릭터 방향: 이전 위치와 비교해서 클라이언트가 계산 → 첫 업데이트에 방향 없음 |
| [direction.ts:7-19](apps/mobile/lib/direction.ts) | `calcDirection`: atan2(dy, dx) 사용 → 수학적으로 정상 |
| WS 메시지 타입 | `room_location_update`에 direction 필드 없음 |

**근본 원인:**
1. 서버가 direction을 전달하지 않아 클라이언트가 이전 위치 기반으로 재계산
2. **첫 번째 위치 업데이트**에서는 이전 위치가 없으므로 항상 "south" 기본값
3. dx/dy 계산에서 **위도/경도 차이가 너무 작을 때** 방향이 안 바뀜 (threshold: 0.00001 ≈ 1m)
4. 속도가 0.5m/s 이하면 isMoving=false → idle 애니메이션만 재생 (방향은 변하지만 보이지 않음)

### 수정 스펙

```
Option A (서버에서 방향 전달 - 권장):
  1. shared WSMessage에 direction 필드 추가
  2. WS 서버: location_update 수신 시 이전 위치와 비교하여 direction 계산
  3. room_location_update broadcast에 direction 포함
  4. 클라이언트: 수신된 direction 직접 사용

Option B (클라이언트 계산 개선 - 최소 변경):
  1. 방향 전환 threshold를 0.00001 → 0.000005로 낮춤 (약 0.5m)
  2. isMoving 판단을 speed 뿐 아니라 위치 변화량으로도 체크
  3. 첫 업데이트에 기본 direction을 "south" 대신 마지막 알려진 방향 유지
```

### 변경 대상 파일

**Option A:**

| 파일 | 변경 |
|------|------|
| `packages/shared/src/index.ts` | `room_location_update` 타입에 `direction?` 필드 추가 |
| `packages/ws-server/src/index.ts` | `handleLocationUpdate`에서 direction 계산 후 broadcast에 포함 |
| `apps/mobile/contexts/WebSocketContext.tsx` | 수신된 direction 직접 사용 |

### E2E 테스트 시나리오

```yaml
# character_direction.yaml
- 방 생성, 위치 공유 시작
- GPS 시뮬레이션: 북쪽으로 이동 (lat 증가)
- 캐릭터 스프라이트가 north 방향 표시 확인
- GPS 시뮬레이션: 동쪽으로 이동 (lng 증가)
- 캐릭터 스프라이트가 east 방향 표시 확인
```

> Note: Maestro에서 GPS 시뮬레이션은 `setLocation` 커맨드로 가능

---

## 3. 백그라운드 위치 공유 (Background Location Sharing)

### 현재 상태: 불안정

### 문제 분석

| 위치 | 문제 |
|------|------|
| [LocationContext.tsx:27-65](apps/mobile/contexts/LocationContext.tsx) | 백그라운드 태스크가 localStorage에서 roomCode 읽음 → 앱 킬 후 복원 불확실 |
| [LocationContext.tsx:143-144](apps/mobile/contexts/LocationContext.tsx) | 방 전환 시 기존 태스크 중지 없이 새 태스크 시작 시도 |
| [ws-server/index.ts:43-75](packages/ws-server/src/index.ts) | POST /location에 룸 멤버십 검증 없음 |
| [LocationContext.tsx:115-162](apps/mobile/contexts/LocationContext.tsx) | `startRoomTracking`에서 이전 태스크 정리 로직 부족 |

**근본 원인:**
1. **방 전환 시 race condition**: 이전 방의 백그라운드 태스크가 아직 실행 중인데 새 방 코드로 localStorage만 업데이트
2. **앱 종료 후 복원 불가**: expo-sqlite localStorage는 앱 프로세스 내에서만 유효, 백그라운드 태스크에서 접근 가능 여부 불확실
3. **서버 검증 없음**: POST /location이 roomCode만 받고 실제 해당 방 멤버인지 확인하지 않음

### 수정 스펙

```
startRoomTracking 수정:
  1. 기존 백그라운드 태스크가 실행 중이면 먼저 중지
  2. localStorage에 새 방 정보 저장
  3. 포그라운드 위치 감시 시작
  4. 백그라운드 태스크 시작

stopRoomTracking 수정:
  1. 포그라운드 감시 중지
  2. 백그라운드 태스크 중지
  3. localStorage 정리
  4. isTracking = false

서버 POST /location 수정:
  1. roomCode로 방 존재 확인 (선택)
  2. userId가 해당 방 멤버인지 확인 (선택, 성능 트레이드오프)
  3. 또는 최소한 rooms Map에 해당 roomCode가 있는지 확인

백그라운드 태스크 안정화:
  1. fetch 실패 시 retry 로직 추가 (최대 3회)
  2. 연속 실패 시 태스크 자동 중지 고려
```

### 변경 대상 파일

| 파일 | 변경 |
|------|------|
| `apps/mobile/contexts/LocationContext.tsx` | startRoomTracking에 기존 태스크 중지 추가, retry 로직 |
| `packages/ws-server/src/index.ts` | POST /location에 기본 검증 추가 |

### E2E 테스트 시나리오

```yaml
# background_location.yaml
- 방 생성, 위치 공유 시작
- 앱을 백그라운드로 전환 (홈 버튼)
- 3-5초 대기
- 앱을 다시 포그라운드로 전환
- 위치 공유 아이콘/상태가 여전히 활성인지 확인
- "위치 공유 중" 알림이 표시되는지 확인 (Android)
```

---

## 4. 목표지점 도착 알림 (Arrival Notification)

### 현재 상태: 동작하지 않음

### 문제 분석

| 위치 | 문제 |
|------|------|
| [map.tsx:102-134](apps/mobile/app/(tabs)/map.tsx) | **1m 이내** 도달 조건 → GPS 오차(5-10m)로 인해 절대 달성 불가 |
| [map.tsx:110-113](apps/mobile/app/(tabs)/map.tsx) | **내 위치 기준**으로 다른 멤버 거리 비교 → **목적지** 기준이 아님 |
| [map.tsx:116-133](apps/mobile/app/(tabs)/map.tsx) | Alert 1번만 확인 가능, 취소 불가 (확인만 있음) |

**근본 원인:**
1. threshold 1m은 GPS로 달성 불가능 (실외 5-10m, 실내 20-50m)
2. 목적지(destination)가 아닌 내 위치 기준으로 다른 멤버 간 거리를 측정
3. 내 위치가 업데이트될 때만 체크 → 내가 가만히 있으면 친구가 도착해도 감지 안 됨

### 수정 스펙

```
도착 감지 로직 재설계:

조건:
  - 목적지가 설정되어 있어야 함 (roomInfo.destinationLat/Lng)
  - 모든 멤버가 목적지 반경 내에 있어야 함

판단 기준:
  - 각 멤버의 위치 → 목적지 거리 < ARRIVAL_RADIUS (50m)
  - 자신도 목적지 반경 내에 있어야 함
  - 최소 2명 이상의 멤버가 반경 내에 있어야 함

알림 로직:
  - 조건 충족 시 Alert 표시: "🎉 모두 도착했어요!"
  - "위치 공유 종료" / "계속 공유" 두 옵션
  - 한 번 표시 후 다시 표시되지 않도록 debounce (isArrivalAlertShownRef)

검증 주기:
  - 내 위치 업데이트 OR 친구 위치 업데이트 시마다 체크
  - 즉, useEffect 의존성에 currentLocation + friendLocations 모두 포함
```

### 코드 스펙

```typescript
// map.tsx — 수정된 도착 감지
const ARRIVAL_RADIUS_METERS = 50
const isArrivalAlertShownRef = useRef(false)

useEffect(() => {
  if (!currentRoom || !currentLocation || !roomInfo) return
  if (!roomInfo.destinationLat || !roomInfo.destinationLng) return
  if (isArrivalAlertShownRef.current) return

  const destLat = roomInfo.destinationLat
  const destLng = roomInfo.destinationLng

  // 내가 목적지 반경 내인지
  const myDist = calculateDistance(
    currentLocation.coords.latitude,
    currentLocation.coords.longitude,
    destLat, destLng
  ) * 1000 // km → m
  if (myDist > ARRIVAL_RADIUS_METERS) return

  // 다른 멤버들이 모두 목적지 반경 내인지
  const otherMembers = roomInfo.members.filter(m => m.userId !== user?.id)
  if (otherMembers.length === 0) return

  const allArrived = otherMembers.every(member => {
    const loc = friendLocations[member.userId]
    if (!loc) return false
    const dist = calculateDistance(loc.lat, loc.lng, destLat, destLng) * 1000
    return dist <= ARRIVAL_RADIUS_METERS
  })

  if (allArrived) {
    isArrivalAlertShownRef.current = true
    Alert.alert(
      '🎉 모두 도착했어요!',
      '모든 멤버가 목표지점에 도착했습니다.',
      [
        { text: '계속 공유', style: 'cancel' },
        { text: '위치 공유 종료', style: 'destructive', onPress: handleLeaveRoom },
      ]
    )
  }
}, [currentLocation, friendLocations, roomInfo])
```

### 변경 대상 파일

| 파일 | 변경 |
|------|------|
| `apps/mobile/app/(tabs)/map.tsx` | 도착 감지 useEffect 전면 재작성 |

### E2E 테스트 시나리오

```yaml
# arrival_notification.yaml
- 방 생성
- 목적지 설정 (lat: 37.5665, lng: 126.978)
- GPS를 목적지 근처로 시뮬레이션 (37.5666, 126.978)
- (다른 멤버도 근처에 있다고 가정)
- "모두 도착했어요!" Alert 표시 확인
- "위치 공유 종료" / "계속 공유" 옵션 확인
```

---

## 5. 만남 시 자동 위치 공유 정지 (Auto-stop on Arrival)

### 현재 상태: 불완전

### 문제 분석

| 위치 | 문제 |
|------|------|
| [map.tsx:120-132](apps/mobile/app/(tabs)/map.tsx) | `setCurrentRoom(null)` → useEffect로 `stopRoomTracking` 트리거 |
| [WebSocketContext.tsx:209-217](apps/mobile/contexts/WebSocketContext.tsx) | `leaveRoom`이 WS 메시지만 보내고 disconnect하지 않음 |
| [LocationContext.tsx:164-176](apps/mobile/contexts/LocationContext.tsx) | `stopRoomTracking`과 `leaveRoom` 사이 race condition |
| [ws-server/index.ts:207-232](packages/ws-server/src/index.ts) | 서버가 leave_room 메시지로만 정리, HTTP leave와 별도 |

**근본 원인:**
1. 정리 순서가 보장되지 않음: HTTP leave → WS leaveRoom → setCurrentRoom(null) → stopRoomTracking
2. 백그라운드 태스크가 아직 실행 중일 수 있음 (중지 명령과 실행 사이 딜레이)
3. WS 연결은 유지됨 → 좀비 커넥션

### 수정 스펙

```
정리 순서 (handleLeaveRoom):

1. isTracking이면 stopRoomTracking() 호출 → 백그라운드 태스크 중지
2. HTTP POST /api/rooms/:code/leave → 서버 DB에서 멤버십 업데이트
3. WS leaveRoom() 호출 → 서버에 leave_room 메시지 전송 → 다른 멤버에게 broadcast
4. clearMessages() → 채팅 메시지 초기화
5. setCurrentRoom(null) → 로컬 상태 초기화
6. isArrivalAlertShownRef.current = false → 알림 상태 초기화

stopRoomTracking 보강:
1. 포그라운드 위치 감시 중지
2. 백그라운드 태스크 중지 (await)
3. localStorage 키 삭제
4. isTracking = false

방 나가기 useEffect 제거:
- 현재 currentRoom?.code 변경에 따른 자동 시작/중지는
  handleLeaveRoom에서 명시적으로 호출하므로 불필요
- 방 생성/참여 시에만 startRoomTracking 호출
```

### 코드 스펙

```typescript
// map.tsx — 통합 방 나가기 함수
const handleLeaveRoom = async () => {
  if (!currentRoom || !user) return

  // 1. 위치 추적 중지 (백그라운드 태스크 포함)
  await stopRoomTracking()

  // 2. 서버에 나가기 알림
  try {
    await fetch(`${API_URL}/api/rooms/${currentRoom.code}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    })
  } catch (error) {
    console.error('Failed to leave room:', error)
  }

  // 3. WebSocket에서 방 나가기
  leaveRoom(user.id, currentRoom.code)

  // 4. 로컬 상태 초기화
  clearMessages()
  setCurrentRoom(null)
  isArrivalAlertShownRef.current = false
}
```

### 변경 대상 파일

| 파일 | 변경 |
|------|------|
| `apps/mobile/app/(tabs)/map.tsx` | handleLeaveRoom 통합 함수, leaveCurrentRoom에서도 사용 |
| `apps/mobile/contexts/LocationContext.tsx` | stopRoomTracking에서 태스크 중지 await 보장 |

### E2E 테스트 시나리오

```yaml
# auto_stop_sharing.yaml
- 방 생성
- 위치 공유 시작 확인 (추적 아이콘 활성)
- 도착 알림에서 "위치 공유 종료" 탭
- "새 방 만들기" 버튼 복원 확인
- 위치 추적 아이콘이 비활성인지 확인
- 다시 지도 화면에서 방 UI가 없는지 확인
```

---

## Implementation Priority

```
1. [HIGH] 도착 알림 재설계 (#4)         — 핵심 UX, 로직만 수정
2. [HIGH] 자동 정지 통합 (#5)           — #4와 연결, 정리 순서만 수정
3. [HIGH] 목표지점 실시간 전파 (#1)      — WS 메시지 1줄 추가
4. [MEDIUM] 백그라운드 위치 안정화 (#3)  — race condition 수정
5. [LOW] 캐릭터 방향 개선 (#2)          — 서버 direction 필드 추가
```

### 변경 파일 요약

| 파일 | Feature |
|------|---------|
| `apps/mobile/app/(tabs)/map.tsx` | #1, #4, #5 |
| `apps/mobile/contexts/WebSocketContext.tsx` | #1, #2 |
| `apps/mobile/contexts/LocationContext.tsx` | #3, #5 |
| `packages/shared/src/index.ts` | #2 (direction 필드) |
| `packages/ws-server/src/index.ts` | #2, #3 |
