/**
 * صنف جذر القسم للنوافذ المنبثقة: النوافذ تُرسم في body خارج جذر القسم، فتحمل الصنف نفسه لتبقى أنماطه
 * وألوانه سارية فيها («tq-mushaf» للمصحف، و«tq-mushaf tq-daily» للسجل اليومي والتقارير بألوان المنصة).
 */
import { createContext, useContext } from "react";

export const MushafScope = createContext("tq-mushaf");
export const useMushafScope = () => useContext(MushafScope);
