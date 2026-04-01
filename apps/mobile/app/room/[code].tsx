import React, { useEffect, useState } from "react";
import { KeyboardAvoidingView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useUser } from "../../contexts";
import { useWebSocket } from "../../contexts/WebSocketContext";
import {
    Box,
    VStack,
    Text,
    Heading,
    Input,
    InputField,
    Button,
    ButtonText,
    ButtonSpinner,
    Spinner,
} from "../../components/ui";
import { colors } from "../../constants/design";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

export default function RoomScreen() {
    const { code } = useLocalSearchParams<{ code: string }>();
    const router = useRouter();
    const { user, isLoading: userLoading, isOnboarded, onboard, setCurrentRoom } = useUser();
    const { connect, joinRoom, isConnected, roomInfo } = useWebSocket();

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [name, setName] = useState("");
    const [needsOnboarding, setNeedsOnboarding] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

    useEffect(() => {
        if (!code) {
            setError("잘못된 링크입니다.");
            setIsLoading(false);
            return;
        }

        if (userLoading) return;

        if (!isOnboarded) {
            setNeedsOnboarding(true);
            setIsLoading(false);
            return;
        }

        joinExistingRoom();
    }, [code, userLoading, isOnboarded]);

    useEffect(() => {
        if (user && isConnected) {
            joinRoom(user.id, code!.toUpperCase());
        }
    }, [user, isConnected]);

    useEffect(() => {
        if (roomInfo) {
            setCurrentRoom(roomInfo);
            router.replace("/(tabs)/map");
        }
    }, [roomInfo]);

    const joinExistingRoom = async () => {
        if (!user) return;

        setIsLoading(true);
        try {
            const response = await fetch(`${API_URL}/api/rooms/code/${code}`);
            if (!response.ok) {
                setError("존재하지 않는 방입니다.");
                return;
            }

            const joinResponse = await fetch(`${API_URL}/api/rooms/${code}/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: user.id }),
            });

            if (!joinResponse.ok) {
                setError("방 참여에 실패했습니다.");
                return;
            }

            connect(user.id);
        } catch (err) {
            console.error("Failed to join room:", err);
            setError("연결에 실패했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOnboard = async () => {
        if (!name.trim()) return;
        setIsJoining(true);
        try {
            await onboard(name.trim(), "boy_casual", "#FF6B6B");
            setNeedsOnboarding(false);
        } catch (err) {
            console.error("Failed to onboard:", err);
        } finally {
            setIsJoining(false);
        }
    };

    if (isLoading || userLoading) {
        return (
            <Box className="flex-1 justify-center items-center bg-background-0 p-6">
                <Spinner size="large" color={colors.secondary.DEFAULT} />
                <Text size="lg" className="mt-4 text-typography-600">
                    방에 연결 중...
                </Text>
            </Box>
        );
    }

    if (error) {
        return (
            <Box className="flex-1 justify-center items-center bg-background-0 p-6">
                <Text size="xl" className="text-error-500 text-center mb-6">
                    {error}
                </Text>
                <Button
                    size="xl"
                    className="w-full bg-secondary-500"
                    onPress={() => router.replace("/")}
                >
                    <ButtonText>홈으로 이동</ButtonText>
                </Button>
            </Box>
        );
    }

    if (needsOnboarding) {
        return (
            <KeyboardAvoidingView
                testID="room_join_screen"
                className="flex-1 bg-background-0"
                behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
            >
                <VStack className="flex-1 justify-center items-center p-6" space="xl">
                    <VStack space="sm" className="items-center mb-4">
                        <Heading size="3xl" className="text-center">
                            방에 초대되었어요!
                        </Heading>
                        <Text size="lg" className="text-typography-600 text-center">
                            이름을 입력하고 참여하세요
                        </Text>
                    </VStack>

                    <VStack className="items-center mb-6" space="xs">
                        <Text size="md" className="text-typography-600">
                            초대 코드
                        </Text>
                        <Text size="3xl" bold className="tracking-[4px] text-secondary-500">
                            {code}
                        </Text>
                    </VStack>

                    <Input size="lg" variant="outline" className="w-full mb-2">
                        <InputField
                            testID="room_name_input"
                            value={name}
                            onChangeText={setName}
                            placeholder="이름을 입력하세요"
                            maxLength={20}
                            autoFocus
                            className="text-center"
                        />
                    </Input>

                    <Button
                        testID="room_join_button"
                        size="xl"
                        className="w-full bg-secondary-500"
                        onPress={handleOnboard}
                        isDisabled={!name.trim() || isJoining}
                    >
                        {isJoining ? <ButtonSpinner /> : <ButtonText>참여하기</ButtonText>}
                    </Button>
                </VStack>
            </KeyboardAvoidingView>
        );
    }

    return (
        <Box className="flex-1 justify-center items-center bg-background-0 p-6">
            <Spinner size="large" color={colors.secondary.DEFAULT} />
            <Text size="lg" className="mt-4 text-typography-600">
                입장 중...
            </Text>
        </Box>
    );
}
