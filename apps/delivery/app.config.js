const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const easProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim();

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    ...(apiBaseUrl ? { apiBaseUrl } : {}),
    ...(easProjectId
      ? {
          eas: {
            ...(config.extra?.eas ?? {}),
            projectId: easProjectId
          }
        }
      : {})
  }
});
