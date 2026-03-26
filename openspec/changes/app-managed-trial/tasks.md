## 1. Database Schema

- [x] 1.1 Create migration to add `subscription_status`, `trial_started_at`, and `trial_ends_at` columns to `profiles` with defaults and CHECK constraint
- [x] 1.2 Update `handle_new_user` trigger to set trial fields on signup
- [x] 1.3 Add database trigger to prevent clients from modifying `trial_started_at` and `trial_ends_at` after initial insert

## 2. TypeScript Types & Profile Hook

- [x] 2.1 Add `subscription_status`, `trial_started_at`, and `trial_ends_at` to the `Profile` interface in `constants/types.ts`
- [x] 2.2 Update `useProfile()` hook to include subscription fields in the select query (already uses `select("*")`, verify it works)

## 3. RevenueCat SDK Setup

- [x] 3.1 Install `react-native-purchases` and add the Expo config plugin to `app.json`
- [x] 3.2 Add `EXPO_PUBLIC_RC_IOS_KEY` and `EXPO_PUBLIC_RC_ANDROID_KEY` to `.env.example`

## 4. Subscription Context

- [x] 4.1 Create `contexts/SubscriptionContext.tsx` with `SubscriptionProvider` that reads profile subscription fields and exposes `status`, `isPremium`, `daysRemaining`, `isTrialExpired`, and `presentPaywall`
- [x] 4.2 Add RevenueCat initialization (configure + `getCustomerInfo`) inside the subscription context, keyed on authenticated user
- [x] 4.3 Add RevenueCat `customerInfoUpdateListener` to sync purchase state changes back to `profiles.subscription_status`
- [x] 4.4 Add RevenueCat logout (`Purchases.logOut()`) on user sign-out
- [x] 4.5 Wire `SubscriptionProvider` into the root layout provider tree in `app/_layout.tsx`

## 5. Paywall Screen

- [x] 5.1 Create paywall modal component at `app/(main)/paywall.tsx` that shows value proposition, pricing from RevenueCat offerings, Subscribe button, and Restore Purchases option
- [x] 5.2 Implement purchase flow: `Purchases.purchasePackage()` on subscribe tap, dismiss on success
- [x] 5.3 Implement restore flow: `Purchases.restorePurchases()` on restore tap, sync and dismiss if entitlement found
- [x] 5.4 Handle purchase cancellation and errors with appropriate user messaging

## 6. Trial Banner

- [x] 6.1 Create `TrialBanner` component that displays trial countdown ("Trial: N days left") with subtle styling
- [x] 6.2 Add urgency variant for 2 or fewer days remaining with "See plans" tap target
- [x] 6.3 Add `TrialBanner` to the main screen (`app/(main)/index.tsx`) above the calendar, conditionally rendered for trialing users only

## 7. Client-Side Feature Gating

- [x] 7.1 Gate the "Log meal" FAB `onPress` handler — check `isPremium` and call `presentPaywall()` if false, otherwise proceed to camera
- [x] 7.2 Verify expired trial users can still browse history, view meals, and edit existing entries without being blocked

## 8. Server-Side Enforcement

- [x] 8.1 Add `SUPABASE_JWT_SECRET`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` to backend environment variables and `.env.example`
- [x] 8.2 Create JWT verification dependency in FastAPI that validates Supabase tokens, checks expiration, and extracts user ID from the `sub` claim
- [x] 8.3 Create subscription check dependency that queries `profiles` for the user's `subscription_status` and `trial_ends_at`, rejecting with 403 if trial expired or subscription inactive
- [x] 8.4 Apply auth + subscription dependencies to `/api/analyze-food` and `/api/logs` POST endpoints
- [x] 8.5 Update the frontend `lib/ai.ts` to send the Supabase access token in the `Authorization: Bearer` header with API requests

## 9. Profile Screen Subscription Section

- [x] 9.1 Add subscription status section to `app/(main)/profile.tsx` showing current plan (Trial/Premium/Expired) with days remaining or manage link
- [x] 9.2 Add "See plans" button for non-premium users and "Manage subscription" link for premium users (opens platform subscription management)
