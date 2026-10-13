import { forwardRef, useState } from "react";
import {
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type View,
  type ViewStyle,
} from "react-native";

type StyleInput =
  | StyleProp<ViewStyle>
  | ((state: PressableStateCallbackType) => StyleProp<ViewStyle>);

export type PressableProps = Omit<RNPressableProps, "style"> & { style?: StyleInput };

/**
 * Pressable آمن مع NativeWind: طبقة react-native-css-interop تُسقط نمط `style` حين يكون دالة
 * (`({ pressed }) => [...]`)، فتظهر الأزرار بلا خلفية ولا حدود (نص أبيض على خلفية فاتحة).
 * هنا نحسب حالة الضغط بأنفسنا ونمرر نمطاً ثابتاً دائماً.
 */
export const Pressable = forwardRef<View, PressableProps>(function Pressable(
  { style, onPressIn, onPressOut, ...rest },
  ref
) {
  const [pressed, setPressed] = useState(false);
  const resolved =
    typeof style === "function" ? style({ pressed, hovered: false } as PressableStateCallbackType) : style;
  return (
    <RNPressable
      ref={ref}
      {...rest}
      onPressIn={(event) => {
        setPressed(true);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        setPressed(false);
        onPressOut?.(event);
      }}
      style={resolved}
    />
  );
});
