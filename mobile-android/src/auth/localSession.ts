import * as SecureStore from "expo-secure-store";

const SESSION_KEY = "tarteel.local.session.v1";

export type LocalSession = {
  userId: string;
  displayName: string | null;
  roles: string[];
  scopes: Array<{ scopeType: string; scopeId: string | null }>;
  issuedAt: string;
  expiresAt: string;
  snapshotVersion: number;
};

export async function saveLocalSession(session: LocalSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadLocalSession(now = new Date()): Promise<LocalSession | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;

  try {
    const session = JSON.parse(raw) as LocalSession;
    if (!session.userId || !session.expiresAt || new Date(session.expiresAt).getTime() <= now.getTime()) {
      await clearLocalSession();
      return null;
    }
    return session;
  } catch {
    await clearLocalSession();
    return null;
  }
}

export async function clearLocalSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
