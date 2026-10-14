/**
 * طبقة توافق التوجيه لقسم المصحف المنقول من زِن.
 *
 * شاشات زِن مكتوبة على TanStack Router (createFileRoute وLink وuseNavigate…)، وترتيل يعمل على
 * wouter. هذه الوحدة تقدّم الواجهة نفسها التي تستعملها الشاشات فوق wouter، فتبقى الشاشات كما هي:
 * - مسارات زِن `/mushaf/...` تصير `/quran/...` في ترتيل، و`/today` تصير لوحة ترتيل.
 * - `useRouterState` يعيد المسار بصيغة زِن (`/mushaf/...`) لأن الشاشات تقارن به.
 * - الرجوع داخل القسم يُعرف من `tqIndex` في history.state (بديل `__TSR_index` في TanStack).
 */
import {
  forwardRef,
  useEffect,
  type AnchorHTMLAttributes,
  type ComponentType,
  type ReactNode,
} from "react";
import { useLocation, useSearch } from "wouter";
import { navigate as wouterNavigate } from "wouter/use-browser-location";
import { STANDALONE_MUSHAF } from "@/mushaf/lib/standalone";

type SearchValue = string | number | boolean | null | undefined;
type SearchInput = Record<string, SearchValue> | undefined;

/** مسار زِن ← مسار ترتيل. */
export function toTarteelPath(to: string): string {
  const [path, rest = ""] = to.split(/(?=[?#])/);
  let mapped = path;
  if (path === "/mushaf" || path === "/mushaf/") mapped = "/quran";
  else if (path.startsWith("/mushaf/"))
    mapped = `/quran/${path.slice("/mushaf/".length)}`;
  // في «المصحف المستقل» لا منصة ولا حساب خلف القسم: الرئيسية والدخول يعودان إلى فهرس المصحف.
  else if (path === "/today" || path === "/")
    mapped = STANDALONE_MUSHAF ? "/quran" : "/dashboard";
  else if (path === "/auth/login")
    mapped = STANDALONE_MUSHAF ? "/quran" : "/login";
  // السجل اليومي والتقارير (منقولان من زِن) في جذر ترتيل.
  else if (path === "/teacher/register") mapped = "/daily";
  else if (path === "/teacher/reports") mapped = "/reports";
  else if (path === "/teacher" || path === "/teacher/") mapped = "/dashboard";
  return mapped + rest;
}

/** مسار ترتيل ← مسار زِن (لما تقارن به الشاشات المنقولة). */
export function toZenPath(path: string): string {
  if (path === "/quran" || path === "/quran/") return "/mushaf/";
  if (path.startsWith("/quran/"))
    return `/mushaf/${path.slice("/quran/".length)}`;
  if (path === "/dashboard") return "/today";
  if (path === "/daily") return "/teacher/register";
  if (path === "/reports") return "/teacher/reports";
  return path;
}

function serializeSearch(search: SearchInput): string {
  if (!search) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function buildHref(to: string, search?: SearchInput): string {
  return toTarteelPath(to) + serializeSearch(search);
}

/** موضع الصفحة الحالية في سجلّ التنقّل داخل القسم. */
export function currentHistoryIndex(): number {
  if (typeof window === "undefined") return 0;
  const idx = (window.history.state as { tqIndex?: unknown } | null)?.tqIndex;
  return typeof idx === "number" ? idx : 0;
}

export function go(href: string, opts?: { replace?: boolean }): void {
  const index = currentHistoryIndex();
  wouterNavigate(href, {
    replace: opts?.replace,
    state: { tqIndex: opts?.replace ? index : index + 1 },
  });
}

type NavigateOptions = { to: string; search?: SearchInput; replace?: boolean };

export function useNavigate() {
  return (opts: NavigateOptions) => {
    go(buildHref(opts.to, opts.search), { replace: opts.replace });
    return Promise.resolve();
  };
}

export function useRouter() {
  return {
    history: { back: () => window.history.back() },
    navigate: (opts: NavigateOptions) => {
      go(buildHref(opts.to, opts.search), { replace: opts.replace });
      return Promise.resolve();
    },
  };
}

export function useRouterState<T>({
  select,
}: {
  select: (s: { location: { pathname: string } }) => T;
}): T {
  const [location] = useLocation();
  return select({ location: { pathname: toZenPath(location) } });
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  to: string;
  search?: SearchInput;
  replace?: boolean;
  children?: ReactNode;
};

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { to, search, replace, onClick, target, ...rest },
  ref
) {
  const href = buildHref(to, search);
  return (
    <a
      ref={ref}
      href={href}
      target={target}
      {...rest}
      onClick={event => {
        onClick?.(event);
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          (target && target !== "_self")
        )
          return;
        event.preventDefault();
        go(href, { replace });
      }}
    />
  );
});

type HeadMeta = { meta?: Array<{ title?: string } | Record<string, string>> };

type RouteOptions<S> = {
  /** خيار TanStack (العرض على الخادم)؛ ترتيل يعرض القسم في المتصفح دائماً. */
  ssr?: boolean;
  head?: () => HeadMeta;
  validateSearch?: (search: Record<string, unknown>) => S;
  component: ComponentType;
};

/** قيم الاستعلام كما يحلّلها TanStack: ما يُقرأ JSON (أرقام ومنطقيات) يُحوَّل، والباقي نص. */
function parseSearch(raw: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of new URLSearchParams(raw)) {
    try {
      const parsed: unknown = JSON.parse(value);
      out[key] =
        typeof parsed === "number" || typeof parsed === "boolean"
          ? parsed
          : value;
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function titleOf(head?: () => HeadMeta): string | undefined {
  const meta = head?.().meta ?? [];
  for (const m of meta)
    if (typeof m.title === "string")
      return m.title.replace(/\s*—\s*Zen\s*$/u, " — ترتيل");
  return undefined;
}

export function createFileRoute(_path: string) {
  return <S,>(options: RouteOptions<S>) => {
    function useRouteSearch(): S {
      const raw = useSearch();
      return (
        options.validateSearch ? options.validateSearch(parseSearch(raw)) : {}
      ) as S;
    }
    function RouteComponent() {
      useEffect(() => {
        const title = titleOf(options.head);
        if (title) document.title = title;
      }, []);
      const Component = options.component;
      return <Component />;
    }
    /**
     * Route.useNavigate في TanStack: التنقل داخل الشاشة نفسها بتعديل الاستعلام (search كائناً أو دالة
     * من الحالي)، مع البقاء على المسار الحالي ما لم يُعطَ `to`.
     */
    function useRouteNavigate() {
      const [location] = useLocation();
      const current = useRouteSearch();
      return (opts: {
        to?: string;
        search?: SearchInput | ((prev: S) => SearchInput);
        replace?: boolean;
      }) => {
        const next =
          typeof opts.search === "function"
            ? opts.search(current)
            : opts.search;
        go((opts.to ? toTarteelPath(opts.to) : location) + serializeSearch(next), {
          replace: opts.replace,
        });
        return Promise.resolve();
      };
    }
    return {
      options,
      useSearch: useRouteSearch,
      useNavigate: useRouteNavigate,
      Component: RouteComponent,
    };
  };
}
