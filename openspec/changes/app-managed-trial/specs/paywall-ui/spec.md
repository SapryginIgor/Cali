## ADDED Requirements

### Requirement: Paywall screen displays subscription options

The app SHALL provide a paywall screen presented as a modal that shows: the app value proposition, subscription pricing (from RevenueCat offerings), a "Subscribe" button that initiates the IAP purchase flow, and a "Restore Purchases" option. The paywall SHALL adapt its messaging based on context: "Your trial has ended" for expired trial users, "Go Premium" for cancelled users.

#### Scenario: Trial expired user sees paywall
- **WHEN** a user with `status = 'trial_expired'` triggers the paywall
- **THEN** the paywall displays with messaging indicating the trial has ended, the subscription price from RevenueCat, and a prominent subscribe button

#### Scenario: User taps Subscribe
- **WHEN** the user taps the "Subscribe" button on the paywall
- **THEN** the app calls `Purchases.purchasePackage()` with the selected offering, and on success the paywall dismisses and the user gains premium access

#### Scenario: User taps Restore Purchases
- **WHEN** the user taps "Restore Purchases"
- **THEN** the app calls `Purchases.restorePurchases()` and if an active entitlement is found, syncs status to `'premium'` and dismisses the paywall

#### Scenario: Purchase fails or is cancelled
- **WHEN** the IAP purchase is cancelled by the user or fails
- **THEN** the paywall remains visible and the user is shown an appropriate message (no message for user cancellation, error message for failures)

### Requirement: Trial countdown banner on main screen

The main screen SHALL display a non-intrusive banner showing the trial countdown when the user is in the `trialing` state. The banner SHALL show the number of days remaining. When 2 or fewer days remain, the banner SHALL become more prominent (visual emphasis) and include a "See plans" tap target.

#### Scenario: User with 5 days remaining
- **WHEN** a trialing user opens the main screen with 5 days remaining
- **THEN** a subtle banner displays "Trial: 5 days left"

#### Scenario: User with 1 day remaining
- **WHEN** a trialing user opens the main screen with 1 day remaining
- **THEN** an emphasized banner displays "Trial ends tomorrow" with a tappable "See plans" link that opens the paywall

#### Scenario: Premium user
- **WHEN** a user with `status = 'premium'` opens the main screen
- **THEN** no trial banner is displayed

#### Scenario: Trial expired user
- **WHEN** a user with expired trial opens the main screen
- **THEN** no trial banner is displayed (the paywall intercepts premium actions instead)

### Requirement: Paywall accessible from profile screen

The profile screen SHALL include a subscription status section showing the current plan (Trial, Premium, or Expired) and a button to manage subscription or view the paywall.

#### Scenario: Trialing user views profile
- **WHEN** a trialing user opens the profile screen
- **THEN** they see "Free Trial" with days remaining and a "See plans" button

#### Scenario: Premium user views profile
- **WHEN** a premium user opens the profile screen
- **THEN** they see "Premium" status and a "Manage subscription" link that opens the platform's subscription management (App Store / Play Store)
