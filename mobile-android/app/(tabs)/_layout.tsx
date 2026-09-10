import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: "#123D2A",
      tabBarInactiveTintColor: "#7B847C",
      tabBarStyle: { backgroundColor: "#F6F3EA", borderTopColor: "#D7DDCF" },
    }}>
      <Tabs.Screen name="index" options={{ title: "الرئيسية" }} />
      <Tabs.Screen name="quran" options={{ title: "المصحف" }} />
      <Tabs.Screen name="sync" options={{ title: "المزامنة" }} />
    </Tabs>
  );
}
