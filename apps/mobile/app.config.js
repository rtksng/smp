const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    ...(apiBaseUrl ? { apiBaseUrl } : {})
  }
});
