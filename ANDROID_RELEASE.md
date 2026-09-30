# Android release preparation

Android is prepared for EAS Build, but this repository is deliberately **not linked to an EAS project**. No Expo owner or EAS project UUID has been guessed. iOS FamilyControls and `@bacons/apple-targets` also remain intentionally disabled.

## One-time workstation setup (Windows Git Bash)

Use **Git Bash**, clone/open the **full monorepo** (not only `artifacts/focus-guard`), and run from the repository root:

```bash
corepack enable
corepack prepare pnpm@10.26.1 --activate
pnpm --version
pnpm install --frozen-lockfile
cd artifacts/focus-guard
pnpm dlx eas-cli@latest login
pnpm dlx eas-cli@latest init
```

Sign in to the intended organization/account. `eas init` is the external linking step that supplies the real `expo.owner` and `expo.extra.eas.projectId`; review those generated values and commit them. Never copy a UUID or owner from another app.

## Verified services and remaining limits

The published backend was independently verified at `https://flow-app.replit.app`: `/api/healthz` returns HTTP 200 with `{status: "ok"}`, and anonymous `/api/practice` correctly returns HTTP 401. RevenueCat read-only configuration confirms the Google Play app exists and `focus_guard_premium_monthly:monthly` is attached to the default offering as `$rc_monthly` and to the `premium` entitlement. This does **not** verify Google Play credentials, signing, a store release, or a real purchase/restore.

## EAS environment and credentials

Clerk is Replit-managed. Replit publishing injects the matching production publishable key and proxy configuration, but an external EAS build does **not** inherit them. Dashboard access for this managed instance currently requires a Personal Pro plan. Do not replace managed variables, copy development secrets, invent a proxy URL, or use a generic Clerk dashboard flow. Obtaining the matching production **public mobile configuration** for external EAS remains a blocker: no automatic export of that configuration has been verified here. Resolve access through Replit's Auth settings or Replit support before building, then set the confirmed public values in the EAS **production** environment:

- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`: the matching production `pk_live_...` publishable key.
- `EXPO_PUBLIC_CLERK_PROXY_URL`: only if supplied by the managed Replit production configuration; do not hardcode one.
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`: the RevenueCat Android public SDK key beginning `goog_`.

If the internal preview should exercise auth or purchases, use the corresponding supported public configuration in the EAS **preview** environment. Replit's existing managed Clerk `pk_test_...` development setup is unchanged and must stay development-only. Do not alter existing Replit secrets. `EXPO_PUBLIC_DOMAIN` is already fixed in both profiles to `flow-app.replit.app`, because the app adds `https://` itself.

Only public client values belong in `EXPO_PUBLIC_*`. Never put Clerk secret keys, RevenueCat secret API keys, Google service-account JSON, keystore passwords, or other credentials in bundled environment variables or source control.

For Android signing, let EAS create/manage the Android keystore when prompted on the first build, or have an authorized release manager upload the existing production keystore through the EAS credentials flow. Keep Google Play service-account credentials in EAS/Google Play, not this repository.

## Local checks and builds

From `artifacts/focus-guard`:

```bash
pnpm run release:preflight:test
pnpm run release:check
EXPO_PUBLIC_DOMAIN=flow-app.replit.app \
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_REPLACE_WITH_SUPPORTED_EXPORTED_VALUE \
EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_REPLACE_WITH_REAL_PUBLIC_VALUE \
pnpm run release:preflight
```

Replace the placeholder values before running the last command. The preflight checks key format, not authenticity or tenant matching; successful login and store testing are still required. The check also invokes the installed `expo-modules-autolinking resolve --platform android` and requires discovery of the standard local module at `modules/space-app-blocker`.

After linking and checks, run EAS builds **from the local Git Bash workstation**, not Replit:

```bash
pnpm dlx eas-cli@latest build --platform android --profile preview
pnpm dlx eas-cli@latest build --platform android --profile production
```

`preview` produces an internally distributed APK. `production` produces the Google Play AAB, uses EAS remote app-version state, and auto-increments the Android version. The cloud pre-install hook repeats static checks and rejects a production build with a missing/non-production Clerk key or a missing/invalid Android RevenueCat public SDK key.

Do not claim native release readiness until the resulting APK/AAB has completed real-device verification, accessibility-service/app-blocking checks, purchase/restore checks, and Google Play policy review.