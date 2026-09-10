import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useFocusEffect, router } from "expo-router";
import { ScreenContainer } from "../../components/screen-container";
import { listPendingConflicts, type LocalSyncConflict } from "../../src/sync/conflicts";

export default function SyncScreen() {
  const [conflicts, setConflicts] = useState<LocalSyncConflict[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    setLoading(true);
    void listPendingConflicts()
      .then((items) => { if (mounted) setConflicts(items); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []));

  return (
    <ScreenContainer className="px-4 pt-4" containerClassName="bg-[#F6F3EA]">
      <View className="flex-1 gap-4">
        <View className="flex-row items-center justify-between">
          <Pressable accessibilityRole="button" accessibilityLabel="العودة" onPress={() => router.back()}>
            <Text className="text-base font-bold text-[#123D2A]">رجوع</Text>
          </Pressable>
          <Text className="text-right text-2xl font-bold text-[#123D2A]">المزامنة</Text>
        </View>
        <Text className="text-right text-sm leading-6 text-[#5D665E]">
          تبقى السجلات المحلية محفوظة عند انقطاع الشبكة. تظهر التعارضات هنا للمراجعة قبل اعتماد النسخة المحلية أو البعيدة.
        </Text>
        {loading && <ActivityIndicator color="#123D2A" />}
        {!loading && conflicts.length === 0 && <Text className="text-center text-[#5D665E]">لا توجد تعارضات معلقة</Text>}
        <FlatList
          data={conflicts}
          keyExtractor={(item) => item.conflictId}
          contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
          renderItem={({ item }) => (
            <View className="rounded-2xl border border-[#E8C46A] bg-white p-4">
              <Text className="text-right font-bold text-[#123D2A]">{item.entity} / {item.entityId}</Text>
              <Text className="mt-2 text-right text-xs text-[#7B847C]">بانتظار قرار المراجعة — {item.detectedAt}</Text>
            </View>
          )}
        />
      </View>
    </ScreenContainer>
  );
}
