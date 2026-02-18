import { Tabs } from "expo-router";
import { Home, PieChart } from "lucide-react-native";
import React from "react";

import Colors from "@/constants/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#000000", // Black for visibility on orange
        tabBarInactiveTintColor: "rgba(0, 0, 0, 0.5)", // Semi-transparent black
        headerShown: false,
        tabBarShowLabel: false, // Hide tab bar labels
        tabBarBackground: () => null, // Remove default background
        tabBarStyle: {
          backgroundColor: "transparent", // Transparent to show orange gradient
          borderTopWidth: 0,
          borderTopColor: "transparent",
          elevation: 0,
          shadowColor: "transparent",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0,
          shadowRadius: 0,
          height: 70,
          paddingBottom: 8,
          paddingTop: 8,
          paddingHorizontal: 0,
          margin: 0,
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600" as const,
          marginTop: 4,
          textAlign: "center",
          width: "100%",
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
        tabBarItemStyle: {
          backgroundColor: "transparent",
          padding: 0,
          margin: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, focused }) => (
            <Home 
              color={color} 
              size={focused ? 26 : 24} 
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="summary"
        options={{
          title: "Summary",
          tabBarIcon: ({ color, focused }) => (
            <PieChart 
              color={color} 
              size={focused ? 26 : 24}
              strokeWidth={focused ? 2.5 : 2}
            />
          ),
        }}
      />
    </Tabs>
  );
}
