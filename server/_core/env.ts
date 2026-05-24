export const ENV = {
  appId: process.env.VITE_APP_ID ?? process.env.KEYCLOAK_CLIENT_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  keycloakBaseUrl: process.env.KEYCLOAK_BASE_URL ?? "",
  keycloakRealm: process.env.KEYCLOAK_REALM ?? "",
  keycloakClientId: process.env.KEYCLOAK_CLIENT_ID ?? "",
  keycloakClientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  adminEmails: (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(email => email.trim().toLowerCase())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
