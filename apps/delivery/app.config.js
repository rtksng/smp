const DEFAULT_API_BASE_URL =
  "https://smp-production-bfda.up.railway.app/api/v1";
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_BASE_URL;
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
