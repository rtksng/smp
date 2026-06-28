const app = require("./app.json");

const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

module.exports = () => ({
  ...app.expo,
  extra: {
    ...(app.expo.extra ?? {}),
    ...(apiBaseUrl ? { apiBaseUrl } : {})
  }
});
