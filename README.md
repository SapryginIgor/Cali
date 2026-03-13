# Cali – Meal tracking app

A cross-platform meal-tracking app built with **Expo** and **React Native**.

- **Platforms**: iOS, Android, Web
- **Stack**: Expo Router, React Native, TypeScript

## Getting started

**Requirements:** Node.js and Bun (or npm). [Install Node with nvm](https://github.com/nvm-sh/nvm), [install Bun](https://bun.sh/docs/installation).

```bash
# Install dependencies
bun i

# Start dev server (tunnel)
bun run start

# Web preview
bun run start-web
```

Then press `i` for iOS Simulator or `a` for Android Emulator, or scan the QR code with Expo Go.

If you see `ERR_UNKNOWN_FILE_EXTENSION` when running `bun run start`, use Node instead: `npm run start`.

## Scripts

| Command         | Description                    |
|----------------|--------------------------------|
| `bun run start` | Start Expo with tunnel         |
| `bun run start-web` | Start web preview with tunnel |
| `bun run lint`  | Run ESLint                     |

## Tech stack

- **React Native** – Cross-platform UI
- **Expo** – Build and tooling
- **Expo Router** – File-based routing (iOS, Android, web)
- **TypeScript** – Type safety
- **React Query** – Server state (if used)
- **Lucide React Native** – Icons
- **Zustand** – Client state

## Project structure

```
├── app/              # Screens (Expo Router)
│   ├── (main)/       # Main logging screen
│   └── _layout.tsx
├── constants/        # Colors, types
├── contexts/         # App context (food entries)
├── lib/              # Helpers (e.g. lib/ai.ts for nutrition/tips)
├── app.json          # Expo config
└── package.json
```

## AI / nutrition analysis

Nutrition estimates currently use **local mocks** in `lib/ai.ts` (no external API). To use a real AI provider (e.g. OpenAI, Vercel AI SDK):

1. Add your SDK and API key.
2. Replace the implementations of `generateObject` and `generateText` in `lib/ai.ts` with calls to your provider.

## Testing

- **Phone:** Install [Expo Go](https://expo.dev/go) (iOS/Android), run `bun run start`, scan the QR code.
- **Web:** `bun run start-web`
- **Simulators:** `bun run start -- --ios` or `-- --android` (with Xcode / Android Studio).

## Deploy

- **iOS/Android:** [EAS Build](https://docs.expo.dev/build/introduction/) and [EAS Submit](https://docs.expo.dev/submit/introduction/).
- **Web:** `eas build --platform web` and deploy the output (e.g. Vercel, Netlify).

## Troubleshooting

- **App not loading on device:** Same WiFi as dev machine; try `bun run start` (tunnel).
- **Build issues:** `bunx expo start --clear`; or `rm -rf node_modules && bun i`.
- **Docs:** [Expo](https://docs.expo.dev/), [React Native](https://reactnative.dev/docs/getting-started).
