export default {
  server: {
    port: "PORT",
    host: "SERVER_BASE_URL",
    projectName: "PROJECT_NAME",
    environment: "ENVIRONMENT",
    clientUrl: "CLIENT_BASE_URL",
    betterAuthSecret: "BETTER_AUTH_SECRET",
    accessTokenSecret: "ACCESS_TOKEN_SECRET",
    accessTokenExpiry: "ACCESS_TOKEN_EXPIRY",
    refreshTokenSecret: "REFRESH_TOKEN_SECRET",
    refreshTokenExpiry: "REFRESH_TOKEN_EXPIRY",
    onboardTokenSecret: "ONBOARD_TOKEN_SECRET",
    onboardTokenExpiry: "ONBOARD_TOKEN_EXPIRY",
    r2Token: "R2_TOKEN",
    r2AccessKeyId: "R2_ACCESS_KEY_ID",
    r2SecretAccessKey: "R2_SECRET_ACCESS_KEY",
    r2Endpoint: "R2_ENDPOINT",
    r2Bucket: "R2_BUCKET",
    r2PublicBaseURL: "R2_PUBLIC_BASE_URL",
    systemABN: "SYSTEM_ABN"
  },
  db: {
    uri: "MONGODB_URI"
  },
  sendgrid: {
    apiKey: "SENDGRID_API_KEY",
    fromEmail: "SENDGRID_FROM_EMAIL",
    fromName: "SENDGRID_FROM_NAME"
  },
  usi: {
    apiBaseURL: "USI_API_BASE_URL"
  }
};
