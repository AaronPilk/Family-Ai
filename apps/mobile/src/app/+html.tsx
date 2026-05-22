import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Custom HTML shell for the web build.
 *
 * Native (iOS/Android) ignores this file entirely — it only affects the static
 * web export served from Vercel (famlinkapp.com).
 *
 * Things we wire up here:
 *  - Title + description so the browser tab and link previews look right.
 *  - apple-touch-icon so iOS "Add to Home Screen" uses the FamLink logo
 *    instead of a screenshot of whatever screen was visible.
 *  - PWA manifest link (manifest.webmanifest is generated below as a static
 *    file in /public/) so Android can install the app to the home screen.
 *  - Theme/background color meta so the address bar tints to FamLink coral.
 *  - Viewport meta so layout adapts properly on phones.
 *
 * Assets referenced here live in apps/mobile/public/ — Expo's static export
 * copies that folder to the site root, so /apple-touch-icon.png at
 * famlinkapp.com resolves to apps/mobile/public/apple-touch-icon.png.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        <title>FamLink — family memories that last forever</title>
        <meta name="description" content="Family memories that last forever." />

        {/* PWA + iOS Add-to-Home-Screen */}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="FamLink" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#C0345C" />

        {/* OpenGraph / link previews for when someone shares famlinkapp.com */}
        <meta property="og:title" content="FamLink" />
        <meta property="og:description" content="Family memories that last forever." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://famlinkapp.com" />
        <meta property="og:image" content="https://famlinkapp.com/apple-touch-icon.png" />
        <meta name="twitter:card" content="summary" />

        {/*
          ScrollViewStyleReset normalizes how ScrollView behaves between native
          and web. Required by expo-router for web. Don't remove.
        */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
