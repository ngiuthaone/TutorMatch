import createIntlMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "./i18n";

const intlMiddleware = createIntlMiddleware({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
});

export default function proxy(request: NextRequest) {
  // TEMP: disable locale routing — flat routes (/center, /messages, /admin/*) are
  // not under [locale] yet (only /[locale]/tutors exists), so localePrefix
  // "always"/"as-needed" still 404s flat pages. Bypass intl until all pages
  // are moved under [locale].
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
