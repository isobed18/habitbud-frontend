// Dynamic Expo config: extends app.json and lets builds override the API URL
// via the API_URL env var (set per-profile in eas.json or in CI).
// Local dev keeps the LAN URL from app.json; production builds point at the
// deployed backend without touching source.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiUrl: process.env.API_URL || config.extra?.apiUrl,
  },
});
