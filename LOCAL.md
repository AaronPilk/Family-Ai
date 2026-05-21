# Just want to see the app?

This is the **no-backend, no-Xcode** path. You'll see Kin on your phone in ~3 minutes using the free Expo Go app.

## What you'll see

- Welcome screen ("This is a quiet place for your family")
- Sign-in screen (buttons are disabled — that lands in Batch 1)
- The 5-tab bottom bar (Home · Ask · Vault · Timeline · Family) with placeholder content on each tab

This is just the shell. No data, no recording, no auth. Use it to feel the spacing, the rose color, the typography.

## Prerequisites

- A Mac with Node.js 20+ installed
  - Don't have it? `brew install node`
- `pnpm` package manager
  - Don't have it? `npm install -g pnpm`
- The **Expo Go** app on your iPhone (free, App Store)
- Your iPhone and your Mac on the **same Wi-Fi network**

## Run it

```bash
cd "$HOME/Family AI/Family-Ai"
pnpm install
pnpm dev
```

A QR code will appear in the terminal. Open your iPhone's Camera app, point it at the QR code, tap the banner that pops up — Expo Go opens and loads the app.

If the QR code doesn't work (different Wi-Fi, corporate network, etc.), run:

```bash
pnpm dev --tunnel
```

`--tunnel` uses Expo's servers as a relay so your phone doesn't need to be on the same network. First run takes ~30s longer; after that it's the same.

## To stop

`Ctrl+C` in the terminal.

## When you're ready for real

The full local setup (Supabase, real auth, recording) is in `README.md` under "Getting started." Skip it until you're ready to build Batch 1.
