"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useMemo } from "react";

export function useFilterParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const params = useMemo(() => new URLSearchParams(searchParams.toString()), [searchParams]);

  const get = useCallback((key: string, fallback = "") => searchParams.get(key) ?? fallback, [searchParams]);

  const getAll = useCallback((key: string) => searchParams.getAll(key), [searchParams]);

  const set = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const toggle = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams.toString());
      const existing = next.getAll(key);
      if (existing.includes(value)) {
        const remaining = existing.filter((v) => v !== value);
        next.delete(key);
        remaining.forEach((v) => next.append(key, v));
      } else {
        next.append(key, value);
      }
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  const clear = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  const hasAny = searchParams.toString().length > 0;

  return { get, getAll, set, toggle, clear, hasAny, params };
}
