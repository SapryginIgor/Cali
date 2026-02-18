/**
 * Expo config with dynamic origin for expo-router.
 * Set EXPO_PUBLIC_APP_ORIGIN in production (e.g. https://yourapp.com)
 * so API routes and requests use the correct base URL instead of localhost.
 */
const staticConfig = require("./app.json");

module.exports = {
  expo: {
    ...staticConfig.expo,
    plugins: staticConfig.expo.plugins.map((plugin) => {
      if (Array.isArray(plugin) && plugin[0] === "expo-router") {
        return [
          "expo-router",
          {
            ...plugin[1],
            origin:
              process.env.EXPO_PUBLIC_APP_ORIGIN || "https://localhost:8081",
          },
        ];
      }
      return plugin;
    }),
  },
};
