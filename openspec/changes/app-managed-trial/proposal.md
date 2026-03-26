## Why

The app currently gives every signed-in user unlimited access to AI-powered food analysis. To monetize sustainably, we need a paywall — but the standard App Store / Play Store trial model auto-charges users when the trial expires, which feels deceptive. We want an **explicit opt-in** model: new users get 7 days of full access for free, then features lock and they must actively choose to subscribe. No payment info collected upfront, no silent charges.

## What Changes

- **Subscription state tracking** — Add `subscription_status`, `trial_started_at`, and `trial_ends_at` columns to the `profiles` table. New users default to `trialing` with a 7-day window. The `handle_new_user` trigger sets these automatically on signup.
- **Subscription context** — New React context (`SubscriptionProvider`) that reads profile subscription state, computes derived values (`isPremium`, `daysRemaining`, `isTrialExpired`), and exposes a `presentPaywall` function. Wraps the app alongside `AuthProvider`.
- **Paywall screen** — A new route/modal that shows subscription options, pricing, and a clear call-to-action. Displayed when trial expires or when a locked feature is tapped. Uses RevenueCat SDK to handle the actual App Store / Play Store purchase.
- **Trial status banners** — Subtle, non-intrusive banners on the main screen showing trial countdown ("5 days left") and a gentle nudge as expiry approaches.
- **Client-side feature gating** — The "Log meal" flow (camera → AI analysis) checks subscription status before proceeding. Expired trial users see the paywall instead of the camera.
- **Server-side enforcement** — The FastAPI `/api/analyze-food` endpoint validates subscription status from the `profiles` table, rejecting requests from expired trial users with a clear 403 response.
- **RevenueCat integration** — Install `react-native-purchases`, configure with App Store / Play Store products, and sync purchase events back to the Supabase `profiles` table via the SDK's customer info listener.

## Capabilities

### New Capabilities

- `subscription-state`: Database schema extensions and React context for tracking and exposing trial/subscription lifecycle (trialing → trial_expired → premium → cancelled)
- `paywall-ui`: Paywall screen, trial countdown banners, and the purchase flow using RevenueCat
- `feature-gating`: Client-side guards on premium actions and server-side enforcement on the analyze endpoint

### Modified Capabilities

_(none — no existing specs to modify)_

## Impact

- **Database**: New migration adding columns to `profiles` and updating `handle_new_user` trigger
- **Frontend dependencies**: `react-native-purchases` (RevenueCat SDK) added to `package.json`; requires Expo dev build (not Expo Go)
- **App providers**: New `SubscriptionProvider` added to the root layout provider tree
- **Main screen**: Trial banner added; "Log meal" FAB gated behind subscription check
- **Backend**: `/api/analyze-food` and `/api/logs` endpoints gain subscription validation; backend needs Supabase client or receives subscription status from auth context
- **App Store / Play Store**: Subscription products must be configured in App Store Connect and Google Play Console before the purchase flow works end-to-end
- **Expo config**: `react-native-purchases` plugin added to `app.json`
