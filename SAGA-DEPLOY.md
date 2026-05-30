# $FARTPRINT — Solana Saga / dApp Store Deployment

This repo is ready to ship to the **Solana dApp Store** for Solana Saga. The HTML, manifest, service worker, and mobile-wallet shim are already wired up — this doc walks through the steps you need to do on your end.

## What's already in place

| File | Purpose |
| --- | --- |
| `manifest.json` | PWA manifest with name, icon, theme colors, app shortcuts |
| `sw.js` | Service worker (network-first, cache-fallback shell) |
| `mwa-shim.js` | On Android/Saga without an extension wallet, deep-links into Phantom Mobile's in-app browser so wallet connections work seamlessly. Also registers the SW. |
| `<head>` tags in every HTML | Manifest link, theme-color, apple-mobile-web-app-* meta, mwa-shim script |
| `logo.png` | Existing icon — used at 192x192 and 512x512 (PWA needs both). Also used as the `maskable` icon. |

Once you deploy these to your domain (e.g. fartprint.art), the site is **installable as a PWA** on any phone — including Solana Saga — directly from Chrome's "Add to Home Screen" menu. Wallet connections route to Phantom Mobile via deep link on mobile, and continue to work via the browser extension on desktop.

To list it on the **Solana dApp Store** you wrap the PWA as a Trusted Web Activity (TWA) and submit through the Solana Mobile publisher tooling. The rest of this doc is that flow.

---

## 1. Prerequisites

You need:

- A **Solana wallet** funded with a small amount of SOL (~0.1 SOL is more than enough). This wallet becomes your **publisher identity** on the dApp Store. Keep its keypair safe — losing it means losing publisher control of your listings.
- **Node.js 18+** and **JDK 17+** installed on your local machine.
- The **Android SDK** (you can grab it with Android Studio, or just the command-line tools).
- The site deployed live at a stable HTTPS domain (e.g. `https://fartprint.art`). PWA + TWA require HTTPS.

---

## 2. Verify the PWA passes Lighthouse

Before wrapping, make sure the PWA scores cleanly:

```bash
# Open the deployed site in Chrome, then DevTools → Lighthouse → "Progressive Web App" → Analyze
```

Things to confirm:

- ✅ Site is served over HTTPS
- ✅ `manifest.json` is reachable and valid
- ✅ Service worker is registered (the `mwa-shim.js` handles this)
- ✅ "Installable" criterion passes
- ✅ `theme-color`, icons, viewport all detected

If any of those fail, fix them before wrapping.

---

## 3. Wrap the PWA as a TWA with Bubblewrap

Google's **Bubblewrap** is the official CLI for converting a PWA into an Android TWA APK / AAB.

```bash
# Install Bubblewrap globally
npm install -g @bubblewrap/cli

# Initialize the project (point at your deployed manifest)
bubblewrap init --manifest https://fartprint.art/manifest.json
```

You'll be prompted for:

- **Application name** → `$FARTPRINT Ecosystem`
- **Short name** → `FARTPRINT`
- **Application ID** → `art.fartprint.app` (reverse-domain form — pick what fits your domain)
- **Display mode** → `standalone`
- **Orientation** → `default`
- **Theme color** → `#2ee06b` (Bubblewrap reads this from the manifest automatically)
- **Background color** → `#0a0f0c`
- **Icon URL** → `https://fartprint.art/logo.png`
- **Splash image URL** → use the same logo.png; Bubblewrap will resize
- **Signing key** → let Bubblewrap generate one for you. **Back this keystore up to a safe place** — losing it means you can never update the app under the same package name again.

Then build:

```bash
bubblewrap build
```

This produces:

- `app-release-signed.apk` — for sideload testing on a Saga device
- `app-release-bundle.aab` — for submission to the dApp Store

Sideload the APK to a Saga (or any Android device) and confirm it launches correctly, the wallet connection bridges via Phantom Mobile, and all the in-app navigation works.

---

## 4. Set up the Solana Mobile dApp Store publishing toolkit

```bash
# Install the dApp Store CLI from Solana Mobile
npm install -g @solana-mobile/dapp-store-cli

# Initialize a new publisher / app / release config
mkdir saga-publish && cd saga-publish
dapp-store init
```

This creates a `config.yaml`. Fill it in with the basics — name, description, publisher details, support email/URL, icon, screenshots, the AAB file from Step 3.

Required assets:

- **Icon** (512×512) — use `logo.png`
- **Banner** (1200×600) — create one in any image tool, dark green with the FartPrint logo
- **Feature graphic** for the store listing
- **Screenshots** — at least 4 phone-sized (1080×1920) of the actual app. Suggested set:
  1. Index hero (the green brand wordmark + ecosystem grid)
  2. FartFlip coin mid-flip
  3. FartForum thread view
  4. FartIdler printer + leaderboard
  5. FartWheel with all the segments lit

The repo ships in dark mode by default, so the screenshots will look properly "in theme" without any extra setup.

---

## 5. Mint the publisher / app / release NFTs

The dApp Store is permissionless and uses NFTs on Solana mainnet to record publishers, apps, and releases. Each one mints with a tiny SOL cost (under 0.01 SOL per NFT).

```bash
# Create your publisher identity (first time only)
dapp-store create publisher -k path/to/publisher-keypair.json --url https://api.mainnet-beta.solana.com

# Create the app entry (first time only — one per app, not per release)
dapp-store create app -k path/to/publisher-keypair.json --url https://api.mainnet-beta.solana.com

# Create a release (do this for every new version you ship)
dapp-store create release -k path/to/publisher-keypair.json --url https://api.mainnet-beta.solana.com
```

Each command writes the resulting NFT mint address back into `config.yaml`. **Commit the updated config.yaml to your repo** — it's how future releases reference the same publisher + app identity.

---

## 6. Submit for review

```bash
dapp-store publish submit -k path/to/publisher-keypair.json --url https://api.mainnet-beta.solana.com
```

This pings the Solana Mobile review team. They typically review in 1–3 business days. They check:

- App installs cleanly on Saga
- Description matches what the app does
- No misleading claims about returns/yields
- Icon/banner/screenshots match the actual app
- A working support contact

Be straightforward about what FartFlip is (a coin flip gambling game) and what FartIdler costs to play (10,000 $FARTPRINT one-time entry). They don't reject gambling apps but they do reject ones that hide it.

When approved, the app becomes installable directly from the Saga dApp Store.

---

## 7. Shipping updates

To push an update:

1. Deploy the new HTML/JS to your domain.
2. Bump the version in `twa-manifest.json` (used by Bubblewrap).
3. `bubblewrap update && bubblewrap build` → new `.aab`.
4. Run `dapp-store create release` to mint the release NFT for the new version.
5. `dapp-store publish submit` to push.

Most of the actual changes inside the app don't require a TWA rebuild — since it's a thin wrapper around your live PWA, any HTML/JS changes you push to the domain are immediately reflected when users next open the app. Only changes to the manifest, icon, or package metadata need a fresh release.

---

## Notes

- **Mobile wallet UX.** The `mwa-shim.js` deep-link approach works for Phantom Mobile out of the box. If you want to support Solflare / Backpack natively (without redirecting to a wallet browser), the upgrade path is to integrate the full `@solana-mobile/wallet-adapter-mobile` library and use the Wallet Standard protocol. The current setup is the lowest-friction one and covers >90% of Saga users (Phantom Mobile is the default).
- **Icon resolution.** PWA recommends at least 192×192 and 512×512 PNG. The current `logo.png` is referenced at both sizes — if your file is smaller than 512×512 the install banner will look fuzzy. Re-export from your source artwork at 512×512 to fix.
- **Cache invalidation.** `sw.js` uses `CACHE_VERSION = "fp-v1"`. When you ship a structurally new shell (e.g. moving files), bump that string. Old caches purge on the next activate.
- **API routes are never cached.** The service worker explicitly skips `/api/*` so the on-chain reads always hit the network.

That's it. With these files plus the steps above, $FARTPRINT is ready to ship on Solana Saga.
