import React, { createContext, useState, useEffect, useRef, useCallback } from "react";
import { WSMessage, UserLocation, RoomInfo } from "@yogiya/shared";
import { calcDirection } from "../lib/direction";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL || "wss://localhost:3000/ws";

interface OnlineStatus {
    [userId: string]: boolean;
}
interface FriendLocations {
    [userId: string]: UserLocation;
}

interface WebSocketContextType {
    isConnected: boolean;
    isConnecting: boolean;
    onlineStatus: OnlineStatus;
    friendLocations: FriendLocations;
    roomInfo: RoomInfo | null;
    roomMessages: RoomChatMessage[];
    connect: (userId: string) => void;
    disconnect: () => void;
    joinRoom: (userId: string, roomCode: string) => void;
    leaveRoom: (userId: string, roomCode: string) => void;
    sendLocation: (lat: number, lng: number, accuracy?: number, speed?: number) => void;
    sendRoomChat: (roomCode: string, content: string) => void;
    sendChat: (to: string, content: string) => void;
    sendSetDestination: (roomCode: string, lat: number, lng: number, name?: string) => void;
    clearMessages: () => void;
}

interface RoomChatMessage {
    id: string;
    senderId: string;
    content: string;
    timestamp: number;
    isMine: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [onlineStatus, setOnlineStatus] = useState<OnlineStatus>({});
    const [friendLocations, setFriendLocations] = useState<FriendLocations>({});
    const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
    const [roomMessages, setRoomMessages] = useState<RoomChatMessage[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const currentUserIdRef = useRef<string>("");
    const currentRoomCodeRef = useRef<string>("");
    const pendingRoomJoinRef = useRef<{ userId: string; roomCode: string } | null>(null);

    const handleMessage = useCallback((msg: WSMessage) => {
        switch (msg.type) {
            case "user_joined":
                setOnlineStatus((prev) => ({ ...prev, [msg.userId]: true }));
                break;
            case "user_left":
                setOnlineStatus((prev) => ({ ...prev, [msg.userId]: false }));
                break;
            case "friend_location":
            case "room_location_update":
                setFriendLocations((prev) => {
                    const prevLoc = prev[msg.userId];
                    let direction = prevLoc?.direction || "south";
                    let isMoving = false;

                    // 서버가 direction을 보내면 우선 사용
                    if ("direction" in msg && msg.direction) {
                        direction = msg.direction;
                        isMoving = true;
                    } else if (prevLoc) {
                        const dx = msg.lng - prevLoc.lng;
                        const dy = msg.lat - prevLoc.lat;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance > 0.000005) {
                            isMoving = true;
                            direction = calcDirection(dx, dy);
                        }
                    }

                    return {
                        ...prev,
                        [msg.userId]: {
                            lat: msg.lat,
                            lng: msg.lng,
                            accuracy: msg.accuracy,
                            timestamp:
                                "timestamp" in msg && msg.timestamp ? msg.timestamp : Date.now(),
                            direction,
                            isMoving,
                        },
                    };
                });
                break;
            case "room_info":
                setRoomInfo(msg.room);
                break;
            case "user_joined_room":
                setRoomInfo((prev) => {
                    if (!prev) return null;
                    const exists = prev.members.some((m) => m.userId === msg.userId);
                    if (exists) return prev;
                    return {
                        ...prev,
                        members: [...prev.members, { userId: msg.userId, user: msg.user }],
                    };
                });
                break;
            case "user_left_room":
                setRoomInfo((prev) => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        members: prev.members.filter((m) => m.userId !== msg.userId),
                    };
                });
                break;
            case "room_chat":
                setRoomMessages((prev) => [
                    ...prev,
                    {
                        id: `msg-${Date.now()}`,
                        senderId: msg.senderId,
                        content: msg.content,
                        timestamp: msg.timestamp,
                        isMine: msg.senderId === currentUserIdRef.current,
                    },
                ]);
                break;
            case "destination_updated":
                setRoomInfo((prev) => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        destinationLat: msg.lat,
                        destinationLng: msg.lng,
                        destinationName: msg.name,
                    };
                });
                break;
            case "friend_status":
                setOnlineStatus((prev) => ({
                    ...prev,
                    [msg.userId]: msg.online,
                }));
                break;
        }
    }, []);

    const connect = useCallback(
        (userId: string) => {
            const state = wsRef.current?.readyState;
            if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;

            currentUserIdRef.current = userId;
            setIsConnecting(true);

            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                setIsConnected(true);
                setIsConnecting(false);
                ws.send(JSON.stringify({ type: "join", userId }));
                if (pendingRoomJoinRef.current) {
                    const { userId: pendingUserId, roomCode } = pendingRoomJoinRef.current;
                    pendingRoomJoinRef.current = null;
                    ws.send(JSON.stringify({ type: "join_room", userId: pendingUserId, roomCode }));
                }
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data) as WSMessage;
                    handleMessage(msg);
                } catch (e) {
                    console.error("Failed to parse message:", e);
                }
            };

            ws.onclose = () => {
                setIsConnected(false);
                setIsConnecting(false);
                wsRef.current = null;
            };

            ws.onerror = (error) => {
                console.error("WebSocket error:", error);
                setIsConnecting(false);
            };
        },
        [handleMessage],
    );

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const joinRoom = useCallback((userId: string, roomCode: string) => {
        currentRoomCodeRef.current = roomCode;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "join_room", userId, roomCode }));
        } else {
            pendingRoomJoinRef.current = { userId, roomCode };
        }
    }, []);

    const leaveRoom = useCallback((userId: string, roomCode: string) => {
        currentRoomCodeRef.current = "";
        pendingRoomJoinRef.current = null;
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: "leave_room", userId, roomCode }));
        }
        setRoomInfo(null);
        setRoomMessages([]);
    }, []);

    const sendLocation = useCallback(
        (lat: number, lng: number, accuracy?: number, speed?: number) => {
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(
                    JSON.stringify({
                        type: "location_update",
                        userId: currentUserIdRef.current,
                        lat,
                        lng,
                        accuracy,
                        speed,
                    }),
                );
            }
        },
        [],
    );

    const sendRoomChat = useCallback((roomCode: string, content: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    type: "room_chat",
                    roomCode,
                    senderId: currentUserIdRef.current,
                    content,
                }),
            );
        }
    }, []);

    const sendChat = useCallback((to: string, content: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({
                    type: "chat",
                    from: currentUserIdRef.current,
                    to,
                    content,
                    timestamp: Date.now(),
                }),
            );
        }
    }, []);

    const sendSetDestination = useCallback((roomCode: string, lat: number, lng: number, name?: string) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(
                JSON.stringify({ type: "set_destination", roomCode, lat, lng, name }),
            );
        }
    }, []);

    const clearMessages = useCallback(() => {
        setRoomMessages([]);
    }, []);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return (
        <WebSocketContext.Provider
            value={{
                isConnected,
                isConnecting,
                onlineStatus,
                friendLocations,
                roomInfo,
                roomMessages,
                connect,
                disconnect,
                joinRoom,
                leaveRoom,
                sendLocation,
                sendRoomChat,
                sendChat,
                sendSetDestination,
                clearMessages,
            }}
        >
            {children}
        </WebSocketContext.Provider>
    );
}

export function useWebSocket() {
    const context = React.use(WebSocketContext);
    if (!context) {
        throw new Error("useWebSocket must be used within a WebSocketProvider");
    }
    return context;
}
