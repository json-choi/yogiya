import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import { ScrollView, KeyboardAvoidingView, Share, Alert, View, Text as RNText, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import MapView, { Marker, Circle, PROVIDER_GOOGLE, Region } from 'react-native-maps'
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated'
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler'
import { Link2, LogOut, MapPin, Navigation, Send, X } from 'lucide-react-native'
import { MapMarker, calculateDistance, calculateETA, formatETA } from '@yogiya/shared'
import { useUser, useWebSocket, useLocation } from '../../contexts'
import CharacterMarker from '../../components/CharacterMarker'
import { calcDirection } from '../../lib/direction'
import { colors } from '../../constants/design'
import { naverMapStyle } from '../../constants/mapStyle'

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

const DRAG_BAR_HEIGHT = 24;
const MIN_CHAT_HEIGHT = 80;
const MAX_CHAT_HEIGHT = 400;

export default function MapScreen() {
    const router = useRouter();
    const { user, currentRoom, setCurrentRoom, verifyUser } = useUser();
    const {
        friendLocations,
        roomInfo,
        roomMessages,
        isConnected,
        connect,
        joinRoom,
        leaveRoom,
        sendRoomChat,
    } = useWebSocket();
    const { currentLocation, isTracking, startRoomTracking, stopRoomTracking } = useLocation();

    const [chatInput, setChatInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSelectingDestination, setIsSelectingDestination] = useState(false);

    const chatHeight = useSharedValue(MIN_CHAT_HEIGHT);
    const scrollViewRef = useRef<ScrollView>(null);
    const mapRef = useRef<MapView>(null);
    const prevLocationRef = useRef<{ lat: number; lng: number } | null>(null);
    const myDirectionRef = useRef<import("@yogiya/shared").CharacterDirection>("south");



    useEffect(() => {
        if (user && !isConnected) {
            connect(user.id);
        }
    }, [user, isConnected]);

    useEffect(() => {
        if (currentRoom) {
            startRoomTracking(currentRoom.code)
        } else {
            stopRoomTracking()
        }
    }, [currentRoom?.code]);

    useEffect(() => {
        if (roomMessages.length > 0 && scrollViewRef.current) {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }
    }, [roomMessages]);

    const region: Region | undefined = useMemo(() => {
        if (!currentLocation) return undefined;
        return {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
        };
    }, [currentLocation]);

    const markers: MapMarker[] = useMemo(() => {
        const roomMembers = roomInfo?.members || [];
        return roomMembers
            .filter((member) => member.userId !== user?.id)
            .map((member) => {
                const location = friendLocations[member.userId];
                if (!location) return null;
                return {
                    id: `marker-${member.userId}`,
                    userId: member.userId,
                    lat: location.lat,
                    lng: location.lng,
                    characterType: member.user?.characterType || "boy_casual",
                    characterColor: member.user?.characterColor || "#FF6B6B",
                    name: member.user?.name || "익명",
                    isOnline: true,
                    lastSeen: location.timestamp,
                    direction: location.direction,
                    isMoving: location.isMoving && Date.now() - (location.timestamp || 0) < 5000,
                };
            })
            .filter((m): m is NonNullable<typeof m> => m !== null);
    }, [roomInfo, friendLocations, user?.id]);

    useEffect(() => {
        if (!currentRoom || !currentLocation || !roomInfo) return;
        const members = roomInfo.members.filter((m) => m.userId !== user?.id);
        if (members.length === 0) return;

        const myLat = currentLocation.coords.latitude;
        const myLng = currentLocation.coords.longitude;

        const allMet = members.every((member) => {
            const loc = friendLocations[member.userId];
            if (!loc) return false;
            return calculateDistance(myLat, myLng, loc.lat, loc.lng) * 1000 <= 1;
        });

        if (allMet) {
            Alert.alert('🎉 만났어요!', '모든 멤버가 같은 위치에 모였습니다. 위치 공유를 종료합니다.', [
                {
                    text: '확인',
                    onPress: async () => {
                        try {
                            await fetch(`${API_URL}/api/rooms/${currentRoom.code}/leave`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ userId: user!.id }),
                            });
                        } catch {}
                        leaveRoom(user!.id, currentRoom.code);
                        setCurrentRoom(null);
                    },
                },
            ]);
        }
    }, [currentLocation, friendLocations]);

    const getMemberName = useCallback(
        (senderId: string) => {
            const member = roomInfo?.members.find((m) => m.userId === senderId);
            return member?.user?.name || senderId.substring(0, 4);
        },
        [roomInfo],
    );

    const myEta = useMemo(() => {
        if (!currentLocation || !roomInfo?.destinationLat || !roomInfo?.destinationLng) return null;
        const distance = calculateDistance(
            currentLocation.coords.latitude,
            currentLocation.coords.longitude,
            roomInfo.destinationLat,
            roomInfo.destinationLng,
        );
        const speed = currentLocation.coords.speed || 0;
        return {
            distance: distance.toFixed(2),
            eta: formatETA(calculateETA(distance, speed)),
        };
    }, [currentLocation, roomInfo]);

    const createRoom = async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const isValid = await verifyUser();
            if (!isValid) {
                Alert.alert("오류", "사용자 정보가 유효하지 않습니다. 다시 시작해주세요.", [
                    { text: "확인", onPress: () => router.replace("/onboarding") },
                ]);
                return;
            }

            const response = await fetch(`${API_URL}/api/rooms`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id }),
            });
            const data = await response.json();

            if (!response.ok) {
                console.error("API error:", data);
                Alert.alert("오류", data.error || "방 생성에 실패했습니다.");
                return;
            }

            setCurrentRoom({
                code: data.room.code,
                members: data.room.members.map((m: any) => ({
                    userId: m.userId,
                    user: m.user,
                })),
            });
            joinRoom(user.id, data.room.code);
        } catch (error) {
            console.error("Failed to create room:", error);
            Alert.alert("오류", "방 생성에 실패했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    const shareRoomLink = async () => {
        if (!currentRoom) return;
        const link = `locationmessenger://room/${currentRoom.code}`;
        try {
            await Share.share({
                message: `내 위치를 확인하세요!\n\n${link}`,
                title: "위치 공유 초대",
            });
        } catch (error) {
            console.error("Failed to share:", error);
        }
    };

    const sendMessage = () => {
        if (!chatInput.trim() || !currentRoom) return;
        sendRoomChat(currentRoom.code, chatInput.trim());
        setChatInput("");
    };

    const saveDestination = async (lat: number, lng: number) => {
        if (!currentRoom) return;
        setIsSelectingDestination(false);
        try {
            await fetch(`${API_URL}/api/rooms/${currentRoom.code}/destination`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat, lng, name: "목표지점" }),
            });
        } catch (error) {
            console.error("Failed to set destination:", error);
            Alert.alert("오류", "목표지점 설정에 실패했습니다.");
        }
    };

    const leaveCurrentRoom = async () => {
        if (!currentRoom || !user) return;

        Alert.alert("방 나가기", "정말 방을 나가시겠어요?", [
            { text: "취소", style: "cancel" },
            {
                text: "나가기",
                style: "destructive",
                onPress: async () => {
                    try {
                        await fetch(`${API_URL}/api/rooms/${currentRoom.code}/leave`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ userId: user.id }),
                        });
                    } catch (error) {
                        console.error("Failed to leave room:", error);
                    }
                    leaveRoom(user.id, currentRoom.code);
                    setCurrentRoom(null);
                },
            },
        ]);
    };

    const clearDestination = async () => {
        if (!currentRoom) return;

        try {
            await fetch(`${API_URL}/api/rooms/${currentRoom.code}/destination`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ lat: null, lng: null, name: null }),
            });
        } catch (error) {
            console.error("Failed to clear destination:", error);
        }
    };

    const handleMapLongPress = (event: any) => {
        if (!currentRoom || !isSelectingDestination) return;
        const { latitude, longitude } = event.nativeEvent.coordinate || {};
        if (latitude && longitude) {
            saveDestination(latitude, longitude);
        }
    };

    const gesture = Gesture.Pan()
        .onUpdate((e) => {
            const newHeight = Math.max(
                MIN_CHAT_HEIGHT,
                Math.min(MAX_CHAT_HEIGHT, chatHeight.value - e.translationY),
            );
            chatHeight.value = newHeight;
        })
        .onEnd(() => {
            if (chatHeight.value > (MAX_CHAT_HEIGHT + MIN_CHAT_HEIGHT) / 2) {
                chatHeight.value = withSpring(MAX_CHAT_HEIGHT);
            } else {
                chatHeight.value = withSpring(MIN_CHAT_HEIGHT);
            }
        });

    const animatedStyle = useAnimatedStyle(() => ({
        height: chatHeight.value,
    }));

    return (
        <GestureHandlerRootView testID="map_screen" style={{ flex: 1, backgroundColor: '#09090B' }}>
            <MapView
                ref={mapRef}
                style={{ flex: 1 }}
                provider={process.env.EXPO_OS === 'android' ? PROVIDER_GOOGLE : undefined}
                customMapStyle={naverMapStyle}
                initialRegion={{
                    latitude: region?.latitude || 37.5665,
                    longitude: region?.longitude || 126.978,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
                showsUserLocation={false}
                onLongPress={handleMapLongPress}
            >
                {roomInfo?.destinationLat && roomInfo?.destinationLng && (
                    <>
                        <Marker
                            coordinate={{ latitude: roomInfo.destinationLat, longitude: roomInfo.destinationLng }}
                            title={roomInfo.destinationName || '목표지점'}
                        >
                            <View style={ms.destMarker}>
                                <MapPin size={28} color={colors.error} fill={colors.error} strokeWidth={1} />
                            </View>
                        </Marker>
                        <Circle
                            center={{ latitude: roomInfo.destinationLat, longitude: roomInfo.destinationLng }}
                            radius={100}
                            fillColor="rgba(59,130,246,0.1)"
                            strokeColor="rgba(59,130,246,0.4)"
                        />
                    </>
                )}

                {currentLocation && user && (() => {
                    const lat = currentLocation.coords.latitude
                    const lng = currentLocation.coords.longitude
                    const speed = currentLocation.coords.speed || 0
                    const prev = prevLocationRef.current
                    if (prev) {
                        const dx = lng - prev.lng
                        const dy = lat - prev.lat
                        if (Math.sqrt(dx * dx + dy * dy) > 0.00001) {
                            myDirectionRef.current = calcDirection(dx, dy)
                        }
                    }
                    prevLocationRef.current = { lat, lng }
                    return (
                        <Marker coordinate={{ latitude: lat, longitude: lng }} title="내 위치" zIndex={999}>
                            <CharacterMarker
                                type={user.characterType}
                                color={user.characterColor}
                                name="나"
                                isOnline={true}
                                direction={myDirectionRef.current}
                                isMoving={speed > 0.5}
                            />
                        </Marker>
                    )
                })()}

                {markers.map((marker) => (
                    <Marker key={marker.id} coordinate={{ latitude: marker.lat, longitude: marker.lng }} title={marker.name}>
                        <CharacterMarker
                            type={marker.characterType}
                            color={marker.characterColor}
                            name={marker.name}
                            isOnline={marker.isOnline}
                            direction={marker.direction}
                            isMoving={marker.isMoving}
                        />
                    </Marker>
                ))}
            </MapView>

            {!currentLocation && (
                <View style={ms.loadingOverlay}>
                    <View style={ms.loadingCard}>
                        <ActivityIndicator size="small" color={colors.accent.DEFAULT} />
                        <RNText style={ms.loadingText}>위치 불러오는 중...</RNText>
                    </View>
                </View>
            )}

            {isSelectingDestination && (
                <View style={ms.destinationHint} pointerEvents="none">
                    <View style={ms.destinationHintCard}>
                        <Navigation size={16} color="#FAFAFA" strokeWidth={2} style={{ marginRight: 8 }} />
                        <RNText style={ms.destinationHintText}>지도를 길게 눌러 목표지점을 찍어주세요</RNText>
                    </View>
                </View>
            )}

            <View style={ms.topBar} pointerEvents="box-none">
                {currentRoom && (
                    <View style={ms.roomCard}>
                        <View style={ms.roomInfo}>
                            <RNText style={ms.roomCode}>방 코드: {currentRoom.code}</RNText>
                            <RNText style={ms.roomCount}>
                                참여 {roomInfo?.members.length ?? currentRoom.members?.length ?? 1}명
                            </RNText>
                        </View>
                        <TouchableOpacity onPress={shareRoomLink} style={ms.topBarBtn} activeOpacity={0.7}>
                            <Link2 size={15} color={colors.text.secondary} strokeWidth={1.75} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={leaveCurrentRoom} style={ms.topBarBtn} activeOpacity={0.7}>
                            <LogOut size={15} color={colors.error} strokeWidth={1.75} />
                        </TouchableOpacity>
                    </View>
                )}
                {myEta && (
                    <View style={ms.etaCard}>
                        <RNText style={ms.etaLabel}>목표까지</RNText>
                        <RNText style={ms.etaDistance}>{myEta.distance}km</RNText>
                        <RNText style={ms.etaTime}>약 {myEta.eta}</RNText>
                    </View>
                )}
            </View>

            {!currentRoom && (
                <View style={ms.createRoomWrap}>
                    <TouchableOpacity
                        style={[ms.createRoomBtn, isLoading && { opacity: 0.5 }]}
                        onPress={createRoom}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <RNText style={ms.createRoomText}>새 방 만들기</RNText>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {currentRoom && (
                <View style={ms.fabWrap} pointerEvents="box-none">
                    {!roomInfo?.destinationLat ? (
                        <TouchableOpacity
                            style={[ms.fab, isSelectingDestination && ms.fabActive]}
                            onPress={() => setIsSelectingDestination((v) => !v)}
                            activeOpacity={0.8}
                        >
                            <MapPin size={16} color="#FFFFFF" strokeWidth={2} style={{ marginRight: 6 }} />
                            <RNText style={ms.fabText}>{isSelectingDestination ? '취소' : '목표지점'}</RNText>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity style={ms.fabClear} onPress={clearDestination} activeOpacity={0.8}>
                            <X size={16} color={colors.text.secondary} strokeWidth={1.75} style={{ marginRight: 6 }} />
                            <RNText style={ms.fabClearText}>목표 삭제</RNText>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            <Animated.View style={[animatedStyle, ms.chatPanel]}>
                <GestureDetector gesture={gesture}>
                    <View style={ms.dragHandle}>
                        <View style={ms.dragBar} />
                    </View>
                </GestureDetector>

                {currentRoom ? (
                    <>
                        <ScrollView ref={scrollViewRef} style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                            {roomMessages.map((msg) => (
                                <View
                                    key={msg.id}
                                    style={[
                                        ms.msgBubble,
                                        msg.isMine ? ms.msgBubbleMine : ms.msgBubbleTheirs,
                                    ]}
                                >
                                    {!msg.isMine && (
                                        <RNText style={ms.msgSender}>{getMemberName(msg.senderId)}</RNText>
                                    )}
                                    <RNText style={msg.isMine ? ms.msgTextMine : ms.msgTextTheirs}>
                                        {msg.content}
                                    </RNText>
                                </View>
                            ))}
                        </ScrollView>

                        <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
                            <View style={ms.chatInputBar}>
                                <TextInput
                                    style={ms.chatInput}
                                    value={chatInput}
                                    onChangeText={setChatInput}
                                    placeholder="메시지 입력..."
                                    placeholderTextColor={colors.text.disabled}
                                    onSubmitEditing={sendMessage}
                                    returnKeyType="send"
                                    selectionColor={colors.accent.DEFAULT}
                                />
                                <TouchableOpacity
                                    style={[ms.chatSendBtn, !chatInput.trim() && ms.chatSendBtnInactive]}
                                    onPress={sendMessage}
                                    disabled={!chatInput.trim()}
                                    activeOpacity={0.8}
                                >
                                    <Send size={15} color={chatInput.trim() ? '#FFFFFF' : colors.text.disabled} strokeWidth={2} />
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </>
                ) : (
                    <View style={ms.chatEmpty}>
                        <RNText style={ms.chatEmptyText}>방을 만들어 위치를 공유해보세요</RNText>
                    </View>
                )}
            </Animated.View>
        </GestureHandlerRootView>
    );
}

const ms = StyleSheet.create({
    destMarker: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
    loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
    loadingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 12,
        backgroundColor: 'rgba(17,17,19,0.95)',
        borderRadius: 12,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: '#27272A',
        gap: 10,
    },
    loadingText: { fontSize: 14, color: '#A1A1AA' },
    destinationHint: { position: 'absolute', top: 120, left: 20, right: 20, alignItems: 'center' },
    destinationHintCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 10,
        backgroundColor: 'rgba(245,158,11,0.95)',
        borderRadius: 10,
        borderCurve: 'continuous',
    },
    destinationHintText: { fontSize: 13, fontWeight: '600', color: '#FFFFFF' },
    topBar: { position: 'absolute', top: 50, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    roomCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: 14,
        paddingRight: 8,
        paddingVertical: 10,
        backgroundColor: 'rgba(17,17,19,0.95)',
        borderRadius: 12,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: '#27272A',
        gap: 6,
    },
    roomInfo: { marginRight: 6 },
    roomCode: { fontSize: 13, fontWeight: '600', color: '#FAFAFA' },
    roomCount: { fontSize: 11, color: '#71717A', marginTop: 1 },
    topBarBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        borderCurve: 'continuous',
        backgroundColor: '#18181B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    etaCard: {
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        backgroundColor: 'rgba(37,99,235,0.92)',
        borderRadius: 12,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: 'rgba(59,130,246,0.5)',
    },
    etaLabel: { fontSize: 11, color: 'rgba(255,255,255,0.7)' },
    etaDistance: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginTop: 1 },
    etaTime: { fontSize: 11, color: 'rgba(255,255,255,0.85)', marginTop: 1 },
    createRoomWrap: { position: 'absolute', bottom: 100, left: 20, right: 20 },
    createRoomBtn: {
        backgroundColor: '#3B82F6',
        paddingVertical: 15,
        borderRadius: 12,
        borderCurve: 'continuous',
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    createRoomText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
    fabWrap: { position: 'absolute', bottom: 120, right: 20, alignItems: 'flex-end' },
    fab: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 22,
        backgroundColor: '#3B82F6',
    },
    fabActive: { backgroundColor: '#D97706' },
    fabText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
    fabClear: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 44,
        paddingHorizontal: 16,
        borderRadius: 22,
        backgroundColor: 'rgba(17,17,19,0.95)',
        borderWidth: 1,
        borderColor: '#27272A',
    },
    fabClearText: { fontSize: 14, fontWeight: '500', color: '#A1A1AA' },
    chatPanel: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#0D0D0F',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        borderCurve: 'continuous',
        borderTopWidth: 1,
        borderLeftWidth: 1,
        borderRightWidth: 1,
        borderColor: '#27272A',
    },
    dragHandle: { height: 24, justifyContent: 'center', alignItems: 'center' },
    dragBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#3F3F46' },
    msgBubble: { maxWidth: '80%', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderCurve: 'continuous', marginVertical: 2 },
    msgBubbleMine: { alignSelf: 'flex-end', backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
    msgBubbleTheirs: { alignSelf: 'flex-start', backgroundColor: '#18181B', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#27272A' },
    msgSender: { fontSize: 11, color: '#71717A', marginBottom: 2 },
    msgTextMine: { fontSize: 14, color: '#FFFFFF', lineHeight: 20 },
    msgTextTheirs: { fontSize: 14, color: '#F4F4F5', lineHeight: 20 },
    chatInputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingBottom: 16,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#27272A',
        gap: 10,
    },
    chatInput: {
        flex: 1,
        backgroundColor: '#18181B',
        borderWidth: 1,
        borderColor: '#27272A',
        borderRadius: 20,
        borderCurve: 'continuous',
        paddingHorizontal: 14,
        paddingVertical: 9,
        fontSize: 14,
        color: '#FAFAFA',
    },
    chatSendBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    chatSendBtnInactive: { backgroundColor: '#27272A' },
    chatEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    chatEmptyText: { fontSize: 14, color: '#52525B', textAlign: 'center' },
})
