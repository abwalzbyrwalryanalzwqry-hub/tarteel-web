import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors } from "../../src/ui/theme";

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (active: IconName, inactive: IconName) =>
  ({ color, size, focused }: { color: string; size: number; focused: boolean }) => <Ionicons name={focused ? active : inactive} size={size} color={color} />;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.subtle,
      tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
    }}>
      <Tabs.Screen name="index" options={{ title: "المنصة", tabBarIcon: icon("school", "school-outline") }} />
      <Tabs.Screen name="quran" options={{ title: "المصحف", tabBarIcon: icon("book", "book-outline") }} />
      <Tabs.Screen name="settings" options={{ title: "الإعدادات", tabBarIcon: icon("settings", "settings-outline") }} />
    </Tabs>
  );
}
