import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const auth = await sdk.authenticate(opts.req);
    user = auth.user;
    if (auth.source === "cookie" && sdk.shouldRenew(auth.session)) {
      await sdk.issueSessionCookie(opts.req, opts.res, auth.user).catch((error) => console.warn("[Auth] session renew failed", String(error)));
    }
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
