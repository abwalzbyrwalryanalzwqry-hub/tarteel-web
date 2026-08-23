import { describe, expect, it } from "vitest";
import { DEVELOPER_INFO } from "../shared/developer";

describe("بيانات المطور", () => {
  it("تحتوي على البيانات الرسمية المطلوبة وروابط تفاعلية صالحة", () => {
    expect(DEVELOPER_INFO.name).toBe("أ. إدريس الزوقري");
    expect(DEVELOPER_INFO.phone).toBe("776343551");
    expect(DEVELOPER_INFO.email).toBe("zoqriidris@gmail.com");
    expect(DEVELOPER_INFO.links.phone).toBe("tel:776343551");
    expect(DEVELOPER_INFO.links.email).toBe("mailto:zoqriidris@gmail.com");
    expect(DEVELOPER_INFO.links.whatsapp).toMatch(/^https:\/\/wa\.me\//);
    expect(DEVELOPER_INFO.links.facebook).toContain("facebook.com");
    expect(DEVELOPER_INFO.links.telegram).toBe("https://t.me/rzleelzr");
  });

  it("لا تستخدم الروابط إلا البروتوكولات المناسبة للتواصل المحلي أو الخارجي", () => {
    expect(DEVELOPER_INFO.address).toBe("اليمن _ إب _ جوبلة");
    expect(DEVELOPER_INFO.whatsapp).toBe("@rzleelzr");
    expect(DEVELOPER_INFO.facebook).toBe("إدريس الزوقري");
    expect(DEVELOPER_INFO.telegram).toBe("@rzleelzr");

    const links = Object.values(DEVELOPER_INFO.links);
    expect(links.every((link) => /^(tel:|mailto:|https:\/\/)/.test(link))).toBe(true);
    expect(links.some((link) => link.includes("api/"))).toBe(false);
  });
});
