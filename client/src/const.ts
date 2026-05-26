export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const keycloakBaseUrl = import.meta.env.VITE_KEYCLOAK_BASE_URL?.trim();
  const keycloakRealm = import.meta.env.VITE_KEYCLOAK_REALM?.trim();
  const clientId = import.meta.env.VITE_KEYCLOAK_CLIENT_ID?.trim();

  if (!keycloakBaseUrl || !keycloakRealm || !clientId) {
    console.error(
      "[OAuth] Keycloak login URL is not configured. Set VITE_KEYCLOAK_BASE_URL, VITE_KEYCLOAK_REALM, and VITE_KEYCLOAK_CLIENT_ID before building the client."
    );
    return "/";
  }

  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);
  const realmUrl = `${keycloakBaseUrl.replace(/\/$/, "")}/${encodeURIComponent(keycloakRealm)}`;

  const url = new URL(`${realmUrl}/protocol/openid-connect/auth`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid profile email");

  return url.toString();
};
