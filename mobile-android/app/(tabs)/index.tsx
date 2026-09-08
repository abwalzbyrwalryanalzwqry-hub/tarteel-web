import { Text, View, Pressable } from "react-native";
import { ScreenContainer } from "../../components/screen-container";
import { useNetworkStatus } from "../../src/network/useNetworkStatus";

export default function HomeScreen() {
  const network = useNetworkStatus();

  return (
    <ScreenContainer className="px-5 pt-8" containerClassName="bg-[#F6F3EA]">
      <View className="gap-6">
        <View className="rounded-3xl bg-white p-6 shadow-sm">
          <Text className="text-right text-3xl font-bold text-[#123D2A]">ترتيل</Text>
          <Text className="mt-2 text-right text-base text-[#5D665E]">
            منصة إدارة حلقات القرآن الكريم، تعمل محلياً أولاً وتزامن بياناتك عند توفر الاتصال.
          </Text>
        </View>

        <View className="rounded-2xl border border-[#D7DDCF] bg-[#EEF4E8] p-5">
          <Text className="text-right text-sm font-semibold text-[#123D2A]">حالة التطبيق</Text>
          <Text className="mt-2 text-right text-base text-[#3D4D42]">
            {network.isConnected ? "متصل — ستتم المزامنة عند الطلب أو في الخلفية" : "غير متصل — البيانات المحلية متاحة"}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="فتح حالة المزامنة"
          style={({ pressed }) => ({
            borderRadius: 16,
            backgroundColor: "#E89B00",
            opacity: pressed ? 0.86 : 1,
            padding: 16,
          })}
          onPress={() => undefined}
        >
          <Text className="text-center text-base font-bold text-white">حالة المزامنة</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}
