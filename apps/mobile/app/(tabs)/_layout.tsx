import { Tabs } from 'expo-router'
import { StyleSheet } from 'react-native'
import { Map, Users, MessageSquare, User } from 'lucide-react-native'

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#52525B',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: '지도',
          tabBarTestID: 'tab_map',
          tabBarIcon: ({ color, size }) => (
            <Map size={size - 2} color={color} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: '친구',
          tabBarTestID: 'tab_friends',
          tabBarIcon: ({ color, size }) => (
            <Users size={size - 2} color={color} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: '채팅',
          tabBarTestID: 'tab_chats',
          tabBarIcon: ({ color, size }) => (
            <MessageSquare size={size - 2} color={color} strokeWidth={1.75} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '내정보',
          tabBarTestID: 'tab_profile',
          tabBarIcon: ({ color, size }) => (
            <User size={size - 2} color={color} strokeWidth={1.75} />
          ),
        }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#09090B',
    height: 60,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    elevation: 0,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
})
