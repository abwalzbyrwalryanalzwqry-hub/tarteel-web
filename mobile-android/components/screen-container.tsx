import { PropsWithChildren } from "react";
import { View, type ViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";

export interface ScreenContainerProps extends ViewProps {
  edges?: Edge[];
  className?: string;
  containerClassName?: string;
}

export function ScreenContainer({
  children,
  edges = ["top", "left", "right"],
  className,
  containerClassName,
  ...props
}: PropsWithChildren<ScreenContainerProps>) {
  return (
    <View className={`flex-1 ${containerClassName ?? "bg-background"}`} {...props}>
      <SafeAreaView className={`flex-1 ${className ?? ""}`} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}
