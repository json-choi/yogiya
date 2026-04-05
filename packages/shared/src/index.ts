export type WSMessage =
    | { type: "join"; userId: string }
    | { type: "join_room"; userId: string; roomCode: string }
    | { type: "leave_room"; userId: string; roomCode: string }
    | {
          type: "location_update";
          userId: string;
          lat: number;
          lng: number;
          accuracy?: number;
          speed?: number;
      }
    | {
          type: "room_location_update";
          userId: string;
          lat: number;
          lng: number;
          accuracy?: number;
          speed?: number;
          timestamp: number;
          direction?: CharacterDirection;
      }
    | { type: "chat"; from: string; to: string; content: string; timestamp: number }
    | { type: "group_chat"; from: string; groupId: string; content: string; timestamp: number }
    | { type: "room_chat"; roomCode: string; senderId: string; content: string; timestamp: number }
    | { type: "friend_location"; userId: string; lat: number; lng: number; accuracy?: number }
    | { type: "user_joined"; userId: string }
    | { type: "user_left"; userId: string }
    | { type: "user_joined_room"; userId: string; user: User; roomCode: string }
    | { type: "user_left_room"; userId: string; roomCode: string }
    | { type: "room_info"; room: RoomInfo }
    | { type: "set_destination"; roomCode: string; lat: number; lng: number; name?: string }
    | { type: "destination_updated"; roomCode: string; lat: number; lng: number; name?: string }
    | { type: "friend_status"; userId: string; online: boolean; locationSharingEnabled: boolean };

export const CHARACTER_TYPES = [
    "boy_casual",
    "boy_hiphop",
    "boy_formal",
    "girl_school",
    "girl_casual",
    "girl_career",
] as const;
export type CharacterType = (typeof CHARACTER_TYPES)[number];

export const CHARACTER_NAMES: Record<CharacterType, string> = {
    boy_casual: "캐주얼 소년",
    boy_hiphop: "힙합 소년",
    boy_formal: "정장 소년",
    girl_school: "교복 소녀",
    girl_casual: "캐주얼 소녀",
    girl_career: "커리어 소녀",
};

export const CHARACTER_GENDER: Record<CharacterType, "male" | "female"> = {
    boy_casual: "male",
    boy_hiphop: "male",
    boy_formal: "male",
    girl_school: "female",
    girl_casual: "female",
    girl_career: "female",
};

export const CHARACTER_COLORS = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
] as const;
export type CharacterColor = (typeof CHARACTER_COLORS)[number];

export type CharacterDirection =
    | "south"
    | "south-east"
    | "east"
    | "north-east"
    | "north"
    | "north-west"
    | "west"
    | "south-west";
export type CharacterAnimation = "idle" | "walking";

export interface User {
    id: string;
    email?: string;
    name: string;
    avatar?: string;
    characterType: CharacterType;
    characterColor: string;
    locationSharingEnabled: boolean;
    online?: boolean;
    lastLocation?: UserLocation;
    // Auth fields for future OAuth integration
    authProvider?: "google" | "apple" | "email" | null;
    authId?: string | null;
    createdAt?: string;
}

export interface UserLocation {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp: number;
    direction?: CharacterDirection;
    isMoving?: boolean;
}

export interface Friend {
    id: string;
    user: User;
    status: FriendshipStatus;
    createdAt: string;
}

export type FriendshipStatus = "PENDING" | "ACCEPTED" | "BLOCKED";

export interface FriendWithLocation extends Friend {
    isOnline: boolean;
    location?: UserLocation;
}

export interface Location {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp: number;
}

export interface Message {
    id: string;
    content: string;
    type: MessageType;
    senderId: string;
    receiverId?: string;
    groupId?: string;
    createdAt: string;
    sender?: User;
}

export type MessageType = "TEXT" | "LOCATION_SHARE" | "SYSTEM";

export interface ChatRoom {
    id: string;
    type: "direct" | "group";
    name?: string;
    participants: User[];
    lastMessage?: Message;
    unreadCount: number;
}

export interface CreateFriendRequestInput {
    requesterId: string;
    addresseeId: string;
}

export interface UpdateUserInput {
    name?: string;
    characterType?: CharacterType;
    characterColor?: string;
    locationSharingEnabled?: boolean;
}

export interface SendMessageInput {
    content: string;
    type: MessageType;
    senderId: string;
    receiverId?: string;
    groupId?: string;
}

export interface LocationSubscription {
    userId: string;
    isSharing: boolean;
    lastUpdate?: number;
}

export interface MapMarker {
    id: string;
    userId: string;
    lat: number;
    lng: number;
    characterType: CharacterType;
    characterColor: string;
    name?: string;
    isOnline: boolean;
    lastSeen?: number;
    direction?: CharacterDirection;
    isMoving?: boolean;
}

// MVP: Room types
export interface RoomInfo {
    code: string;
    name?: string;
    destinationLat?: number;
    destinationLng?: number;
    destinationName?: string;
    members: RoomMember[];
}

export interface RoomMember {
    userId: string;
    user: User;
    joinedAt?: string;
    lastLocation?: UserLocation;
}

export interface RoomMessage {
    id: string;
    roomId: string;
    senderId: string;
    content: string;
    type: MessageType;
    createdAt: string;
    sender?: User;
}

// 8방향 캐릭터 방향 계산
export function calcDirection(dx: number, dy: number): CharacterDirection {
    const angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle >= 67.5 && angle < 112.5) return "north";
    if (angle >= 22.5 && angle < 67.5) return "north-east";
    if (angle >= -22.5 && angle < 22.5) return "east";
    if (angle >= -67.5 && angle < -22.5) return "south-east";
    if (angle >= -112.5 && angle < -67.5) return "south";
    if (angle >= -157.5 && angle < -112.5) return "south-west";
    if (angle >= 112.5 && angle < 157.5) return "north-west";
    return "west";
}

// ETA 계산용 유틸리티
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    // Haversine 공식
    const R = 6371; // 지구 반지름 (km)
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function toRad(deg: number): number {
    return deg * (Math.PI / 180);
}

export function calculateETA(distanceKm: number, speedMps: number): number {
    // speedMps: meters per second
    // returns ETA in seconds
    if (speedMps <= 0) return Infinity;
    const distanceM = distanceKm * 1000;
    return distanceM / speedMps;
}

export function formatETA(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return "--";
    if (seconds < 60) return `${Math.round(seconds)}초`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}분`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.round((seconds % 3600) / 60);
    return `${hours}시간 ${mins}분`;
}
