import { Tabs } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useAppColors } from "../../src/ui/theme";

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (active: IconName, inactive: IconName) =>
  ({ color, size, focused }: { color: string; size: number; focused: boolean }) => <Ionicons name={focused ? active : inactive} size={size} color={color} />;

export default function TabsLayout() {
  // كان الشريط فاتحاً دائماً فيظهر شريط ساطع أسفل المنصة في الوضع الليلي.
  const colors = useAppColors();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.tabActive,
      tabBarInactiveTintColor: colors.tabInactive,
      tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
      sceneStyle: { backgroundColor: colors.background },
      tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
    }}>
      <Tabs.Screen name="index" options={{ title: "المنصة", tabBarIcon: icon("school", "school-outline") }} />
      <Tabs.Screen name="quran" options={{ title: "المصحف", tabBarIcon: icon("book", "book-outline") }} />
      <Tabs.Screen name="settings" options={{ title: "الإعدادات", tabBarIcon: icon("settings", "settings-outline") }} />
    </Tabs>
  );
}
