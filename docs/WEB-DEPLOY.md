# FamLink Web — Deploy to famlinkapp.com

The same Expo app builds for iOS, Android, **and** the web. This doc walks
through getting the web build live at `https://famlinkapp.com` via Vercel,
with the domain pointed from GoDaddy.

> **Why this exists:** Aaron wants to validate with family before paying
> Apple's $99/yr and Google's $25 fees. Browser-first lets the July reunion
> test happen with zero install friction.

---

## 0 — One-time prerequisites

You only do these once. Skip if already done.

- [ ] **Vercel account** at [vercel.com](https://vercel.com) — sign up with
      your GitHub account so it can auto-connect repos. Free tier is fine.
- [ ] **Repo pushed to GitHub** — `AaronPilk/Family-Ai` already exists. Make
      sure your latest commits are on `main`.
- [ ] **GoDaddy login** ready in another tab for the DNS step.

---

## 1 — Install web deps locally (one-time)

Stop Metro first (Ctrl+C in the Metro terminal).

```bash
cd ~/Family\ AI/Family-Ai/apps/mobile
npx expo install react-native-web react-dom @expo/metro-runtime
```

`npx expo install` picks the right versions for your Expo SDK; don't use
`pnpm add` for these.

Verify the install didn't break anything:

```bash
cd ~/Family\ AI/Family-Ai
pnpm typecheck
```

---

## 2 — Run the web app locally

```bash
cd ~/Family\ AI/Family-Ai
pnpm --filter @kin/mobile start --web
```

Metro will print `Web is waiting on http://localhost:8081`. Open that URL in
Safari or Chrome. You should see the FamLink welcome screen — same logo,
same sign-up / sign-in buttons, just rendered in a browser.

Test the full happy path locally:

1. Click **Get started** → create an account → confirm via the email Supabase
   sends (or disable confirmations in your Supabase dashboard's Auth →
   Providers → Email panel).
2. After confirming, the browser should land on the home tab.
3. Try clicking around — Events tab, Chats tab, the reunion event, the
   group chat.

If everything works locally, you're ready to deploy. If anything looks
broken on desktop, paste the URL of the broken screen and we'll fix it.

---

## 3 — Build the production web bundle

```bash
cd ~/Family\ AI/Family-Ai/apps/mobile
npx expo export -p web
```

This produces a static export at `apps/mobile/dist/`. Vercel will rebuild
this on every push to `main`, so you don't need to commit it.

---

## 4 — Connect Vercel to GitHub

1. Go to [vercel.com/new](https://vercel.com/new).
2. Click **Import Project** → select `AaronPilk/Family-Ai` from the
   GitHub picker.
3. Vercel will detect the `vercel.json` at the repo root and pre-fill:
   - **Build command:** `pnpm install --frozen-lockfile && pnpm --filter @kin/mobile exec expo export -p web`
   - **Output directory:** `apps/mobile/dist`
   - **Install command:** `pnpm install --frozen-lockfile`
4. Under **Environment Variables**, add the two from your local `.env`:
   - `EXPO_PUBLIC_SUPABASE_URL` = `https://yaogxksbhpiqmgjuuqnj.supabase.co`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` = `eyJ...` (the anon key from your
     Supabase dashboard's Project Settings → API)
5. Click **Deploy**. First build takes ~5–7 minutes.

When it's done, Vercel will give you a URL like
`https://family-ai-xxxxxxxxx.vercel.app`. Open it in a browser — you should
see the same welcome screen you saw locally.

If the deploy fails, paste the error from Vercel's Build Logs and we'll fix.

---

## 5 — Point famlinkapp.com at Vercel

In Vercel:

1. Open your project → **Settings → Domains**.
2. Click **Add** → type `famlinkapp.com` → **Add**.
3. Vercel will show you two DNS records to add at GoDaddy:
   - An **A record** for the apex (`@`) pointing to `76.76.21.21`.
   - A **CNAME record** for `www` pointing to `cname.vercel-dns.com`.
4. Also add `www.famlinkapp.com` in Vercel — same flow — and choose to
   redirect `www → root` (or root → www, your call; convention is usually
   root).

In GoDaddy:

1. Log in → **My Products**.
2. Find `famlinkapp.com` → **DNS** (or "Manage DNS").
3. Edit the existing `A` record (currently pointing at GoDaddy's parking page):
   - **Type:** A
   - **Name:** `@`
   - **Value:** `76.76.21.21`
   - **TTL:** 1 hour (default is fine)
4. Edit the existing `CNAME` record for `www`:
   - **Type:** CNAME
   - **Name:** `www`
   - **Value:** `cname.vercel-dns.com`
   - **TTL:** 1 hour
5. Delete any other A or CNAME records GoDaddy added for parking pages.
6. **Save.**

DNS propagation usually takes 5–30 minutes but can take up to 48 hours
(rarely). Check status by reloading `https://famlinkapp.com` in an
incognito window. Vercel auto-issues a free SSL cert via Let's Encrypt
once DNS resolves, so HTTPS works automatically.

---

## 6 — Update Supabase to know about the web origin

While DNS is propagating:

1. Open your Supabase dashboard → **Authentication → URL Configuration**.
2. Set **Site URL** to `https://famlinkapp.com`.
3. Under **Redirect URLs**, add both:
   - `https://famlinkapp.com/**`
   - `famlink://**` (the deep-link scheme for the native app)
4. Save.

This makes email-confirmation links and password-reset links point at the
web app for browser users, and at the native app for mobile users.

---

## 7 — Verify the full loop

Once `famlinkapp.com` resolves:

1. Open `https://famlinkapp.com` in a private/incognito window.
2. Tap **Get started** → create a new account with a real email you can check.
3. Open the confirmation email Supabase sends → click the link.
4. You should land back on `https://famlinkapp.com` and be signed in.
5. Try the seeded reunion event — RSVP, vote on a poll, send a chat
   message. Everything should round-trip through Supabase.

If something doesn't work end-to-end, paste the browser console output
(Cmd+Option+J in Chrome, Cmd+Option+C in Safari) and the Vercel deploy
log if relevant.

---

## What this gives you

- **A real test surface** for Mom and family in July — anyone with the URL
  and an email address can sign up and try the reunion flow.
- **A privacy policy / ToS host** — when we draft those, they'll live at
  `famlinkapp.com/privacy` and `/terms`.
- **A custom email sender option** — once you've verified the domain in
  Supabase, auth emails can come from `auth@famlinkapp.com` instead of
  Supabase's default `noreply@supabase.co` (more trust, less spam-flagging).
- **Optionality for Apple/Google later** — same codebase, same backend.

## What's still missing on the web side

- **Push notifications** don't exist in browsers the same way they do on
  iOS/Android. We can add browser Notification API support in a later
  batch, but for July, web testers will only see new chat messages when
  they refresh.
- **Camera / voice recording** work via browser APIs but aren't wired yet
  — that's part of Batch D (storage + media).
- **Mobile-style gestures** (long-press, swipe) degrade to clicks on
  desktop. Acceptable for testing.

---

## Cheat sheet — terminal commands

```bash
# Install web deps (once)
cd ~/Family\ AI/Family-Ai/apps/mobile
npx expo install react-native-web react-dom @expo/metro-runtime

# Run web app locally
cd ~/Family\ AI/Family-Ai
pnpm --filter @kin/mobile start --web

# Build for production
cd ~/Family\ AI/Family-Ai/apps/mobile
npx expo export -p web

# Trigger Vercel redeploy without code changes (from repo root)
git commit --allow-empty -m "Trigger redeploy"
git push origin main
```
