import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * الإشعارات المنبثقة بسمة ترتيل نفسها (فاتح/داكن). كانت تقرأ السمة من next-themes دون مزوّد،
 * فتتبع إعداد الجهاز لا اختيار المستخدم، وتشير إلى متغيرات غير موجودة (--popover بدل --color-popover).
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      dir="rtl"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--color-popover)",
          "--normal-text": "var(--color-popover-foreground)",
          "--normal-border": "var(--color-border)",
          fontFamily: "var(--font-body)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
