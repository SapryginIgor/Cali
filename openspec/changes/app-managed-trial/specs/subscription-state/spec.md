## ADDED Requirements

### Requirement: Profiles table tracks subscription state

The `profiles` table SHALL include `subscription_status` (text, default `'trialing'`), `trial_started_at` (timestamptz, default `now()`), and `trial_ends_at` (timestamptz, default `now() + interval '7 days'`). The `subscription_status` column SHALL have a CHECK constraint allowing only the values: `trialing`, `trial_expired`, `premium`, `cancelled`.

#### Scenario: New user signup populates trial fields
- **WHEN** a new user is created in `auth.users`
- **THEN** the `handle_new_user` trigger inserts a `profiles` row with `subscription_status = 'trialing'`, `trial_started_at = now()`, and `trial_ends_at = now() + interval '7 days'`

#### Scenario: Existing users without subscription columns
- **WHEN** the migration runs on a database with existing profile rows
- **THEN** existing rows SHALL receive `subscription_status = 'trialing'`, `trial_started_at = now()`, and `trial_ends_at = now() + interval '7 days'` via column defaults

### Requirement: RLS prevents users from writing subscription fields directly

The existing RLS update policy on `profiles` SHALL remain. Users can update their own profile row. The `subscription_status`, `trial_started_at`, and `trial_ends_at` columns SHALL be writable by the authenticated client only for the purpose of syncing RevenueCat purchase state (setting status to `premium` or `cancelled`). The `trial_started_at` and `trial_ends_at` values SHALL only be set by the server-side trigger on signup; clients MUST NOT modify trial dates.

#### Scenario: User attempts to extend trial via client
- **WHEN** an authenticated user sends an update to `profiles` changing `trial_ends_at`
- **THEN** the update SHALL be rejected (enforced via a database trigger or RLS column restriction)

#### Scenario: User syncs premium status from RevenueCat
- **WHEN** the app receives a purchase confirmation from RevenueCat
- **THEN** the app updates `profiles.subscription_status` to `'premium'` for the authenticated user's own row

### Requirement: SubscriptionProvider context exposes subscription state

The app SHALL provide a `SubscriptionProvider` React context that reads subscription fields from the user's profile and exposes: `status` (`trialing | trial_expired | premium | cancelled`), `isPremium` (boolean, true when `status` is `trialing` or `premium`), `daysRemaining` (number or null), `isTrialExpired` (boolean), and `presentPaywall` (function). The context SHALL be added to the root layout provider tree.

#### Scenario: User on active trial
- **WHEN** a signed-in user has `subscription_status = 'trialing'` and `trial_ends_at` is in the future
- **THEN** `isPremium` SHALL be `true`, `daysRemaining` SHALL reflect the remaining days, and `isTrialExpired` SHALL be `false`

#### Scenario: User with expired trial
- **WHEN** a signed-in user has `subscription_status = 'trialing'` and `trial_ends_at` is in the past
- **THEN** the context SHALL set `status` to `trial_expired`, `isPremium` to `false`, `daysRemaining` to `0`, and `isTrialExpired` to `true`

#### Scenario: Premium subscriber
- **WHEN** a signed-in user has `subscription_status = 'premium'`
- **THEN** `isPremium` SHALL be `true` and `isTrialExpired` SHALL be `false` regardless of trial dates

### Requirement: RevenueCat SDK initialization

The app SHALL initialize `react-native-purchases` (RevenueCat) after authentication completes, using the Supabase user ID as the `appUserID`. The SDK SHALL be configured with platform-specific API keys from environment variables (`EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`).

#### Scenario: Authenticated user opens app
- **WHEN** a user signs in and the auth session is established
- **THEN** RevenueCat SHALL be configured with the user's Supabase ID, and `getCustomerInfo()` SHALL be called to sync any existing purchases

#### Scenario: User signs out
- **WHEN** the user signs out
- **THEN** RevenueCat SHALL be logged out via `Purchases.logOut()`

### Requirement: RevenueCat purchase state syncs to Supabase

When the RevenueCat `customerInfoUpdateListener` fires with a change in the `premium` entitlement status, the app SHALL update the user's `profiles.subscription_status` in Supabase accordingly: active entitlement → `'premium'`, no active entitlement after previous premium → `'cancelled'`.

#### Scenario: Successful purchase
- **WHEN** RevenueCat reports the `premium` entitlement is now active
- **THEN** the app updates `profiles.subscription_status` to `'premium'`

#### Scenario: Subscription expires or is cancelled
- **WHEN** RevenueCat reports the `premium` entitlement is no longer active and `subscription_status` was previously `'premium'`
- **THEN** the app updates `profiles.subscription_status` to `'cancelled'`

### Requirement: Profile TypeScript type includes subscription fields

The `Profile` interface in `constants/types.ts` SHALL include `subscription_status: 'trialing' | 'trial_expired' | 'premium' | 'cancelled'`, `trial_started_at: string`, and `trial_ends_at: string`.

#### Scenario: Profile type is consumed
- **WHEN** the `useProfile()` hook returns data
- **THEN** the returned object SHALL include subscription fields with correct TypeScript types
