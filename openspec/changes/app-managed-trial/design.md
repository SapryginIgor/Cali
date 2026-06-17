## Context

Cali is an Expo 54 / React Native meal-tracking app with a FastAPI backend for AI food analysis. Auth is managed via Supabase (email/password), with a `profiles` table auto-populated by a trigger on `auth.users`. The app currently has no monetization — every authenticated user gets unlimited AI analysis.

The goal is to introduce a 7-day app-managed trial with an explicit opt-in subscription. Unlike App Store native trials, we control the trial lifecycle ourselves: no payment info upfront, no auto-charge. When the trial expires, features lock and the user must actively purchase a subscription via the App Store / Play Store.

Key existing pieces:
- `profiles` table with RLS (select/update own row)
- `AuthContext` + `useAuth()` for session state
- `useProfile()` hook (React Query) for reading/updating profile
- Root layout provider tree: `QueryClientProvider > AuthProvider > AppProvider`
- Backend has no auth verification — endpoints are open with rate limiting only

## Goals / Non-Goals

**Goals:**
- Track trial and subscription state in Supabase `profiles` table
- Expose subscription state to the app via a React context
- Gate AI food analysis behind an active trial or premium subscription
- Show a paywall screen when trial expires or gated feature is tapped
- Display non-intrusive trial countdown on the main screen
- Enforce subscription status server-side in FastAPI
- Integrate RevenueCat for App Store / Play Store purchase handling
- Sync RevenueCat purchase events back to the `profiles` table

**Non-Goals:**
- Web payments (Stripe, etc.) — mobile IAP only for now
- Multiple subscription tiers — single "Premium" tier
- Usage-based metering (e.g., N free scans) — it's all-or-nothing during trial
- Push notification reminders for trial expiry
- Admin dashboard for subscription management
- Offline-first subscription validation
- RevenueCat webhook server (we sync via client SDK listener for v1)

## Decisions

### 1. App-managed trial over store-managed trial

**Decision:** Trial lifecycle tracked in our database, not via App Store / Play Store subscription trial offers.

**Rationale:** Store trials require payment info upfront and auto-charge. The user explicitly asked for opt-in behavior where the trial is risk-free and the purchase is a separate, conscious action.

**Alternatives considered:**
- *Store free trial*: Simpler integration but auto-charges, which contradicts the UX goal.
- *Hybrid (store trial + our tracking)*: Unnecessary complexity; we'd still need our own state for the "no payment upfront" requirement.

### 2. RevenueCat for purchase handling

**Decision:** Use `react-native-purchases` (RevenueCat SDK) for the actual subscription purchase after trial expires.

**Rationale:** Apple and Google require native IAP for digital goods in mobile apps. RevenueCat abstracts both stores, handles receipt validation, and provides a customer info listener we can use to sync state back to Supabase. Free tier covers up to $2.5k/mo revenue.

**Alternatives considered:**
- *react-native-iap*: Lower-level, requires building our own receipt validation server.
- *expo-iap*: Still experimental; RevenueCat is more battle-tested.

### 3. Subscription state in `profiles` table (not a separate table)

**Decision:** Add `subscription_status`, `trial_started_at`, and `trial_ends_at` columns directly to the existing `profiles` table.

**Rationale:** Avoids join complexity. The profile is already loaded on every app session via `useProfile()`. Subscription state is 1:1 with user and belongs on the same row. The trigger already populates `profiles` on signup — we extend it to set trial defaults.

**Alternatives considered:**
- *Separate `subscriptions` table*: More normalized, but adds a join to every profile fetch and a second RLS policy to manage. Premature for a single-tier model.

### 4. Client-side sync via RevenueCat listener (no webhook server for v1)

**Decision:** When RevenueCat detects a purchase or status change, the app's `customerInfoUpdateListener` writes the new status to `profiles` via Supabase client.

**Rationale:** Avoids standing up a webhook endpoint and keeps the system simpler. The client already has an authenticated Supabase session and can update its own profile row (RLS allows update-own).

**Trade-off:** If the user purchases on one device and opens on another before the first device syncs, there's a brief inconsistency. Acceptable for v1 — RevenueCat's `getCustomerInfo()` on app open covers this.

**Future:** Add a RevenueCat webhook → Supabase Edge Function for server-authoritative sync when needed.

### 5. Server-side enforcement via Supabase profile lookup

**Decision:** FastAPI reads the user's `subscription_status` and `trial_ends_at` from the `profiles` table before processing `/api/analyze-food`.

**Rationale:** The backend currently has no auth. We need to pass the Supabase access token from the client and validate it server-side, then read the profile. This provides a secure enforcement layer independent of client-side checks.

**Implementation approach:** The client sends the Supabase JWT in the `Authorization` header. The backend verifies the JWT, extracts the user ID, and queries `profiles` for subscription state.

### 6. Paywall as a modal route, not a full-screen redirect

**Decision:** The paywall is presented as a modal (sheet presentation style) from within the main stack, not a separate navigation group.

**Rationale:** Users should still feel "in the app" when seeing the paywall. A modal allows them to dismiss and continue browsing (view past logs, profile) — only the premium action (new analysis) is blocked. This is less aggressive than a hard gate.

## Risks / Trade-offs

- **[Clock manipulation]** Users could set their device clock back to extend the trial. → Mitigation: `trial_ends_at` is set server-side by the Supabase trigger using `now()`. Client only reads it; never writes it. For extra safety, the backend uses its own server time for comparison.

- **[RevenueCat requires dev build]** The `react-native-purchases` package has native modules and won't work in Expo Go. → Mitigation: Document that development must use `npx expo prebuild` or EAS Build from this point forward.

- **[Client-side sync lag]** If the app crashes after purchase but before syncing to Supabase, the user might briefly appear as non-premium. → Mitigation: On every app open, `getCustomerInfo()` from RevenueCat re-checks and re-syncs. The inconsistency window is very short.

- **[App Review risk]** Apple may question why we don't use native trial offers. → Mitigation: This is a well-established "freemium" pattern (Notion, Linear, etc.). The subscription itself uses native IAP — only the trial is app-managed.

- **[No backend auth currently]** The backend has no JWT verification. Adding it is a prerequisite for server-side enforcement. → Mitigation: This change includes adding Supabase JWT verification middleware to FastAPI as part of the feature-gating work.
