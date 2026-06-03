import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

// Utility function
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
  email?: string | null;
  loginMethod?: string | null;
};

export type KeycloakTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  scope?: string;
  id_token?: string;
};

export type KeycloakUserInfo = {
  sub: string;
  name?: string;
  preferred_username?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  email_verified?: boolean;
};

class SDKServer {
  constructor() {
    console.log("[OAuth] Initialized with Keycloak realm:", this.realmUrl || "(not configured)");
    if (!this.realmUrl || !ENV.keycloakClientId || !ENV.keycloakClientSecret) {
      console.error(
        "[OAuth] ERROR: Keycloak configuration is incomplete. Set KEYCLOAK_BASE_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, and KEYCLOAK_CLIENT_SECRET."
      );
    }
  }

  private get realmUrl() {
    if (!ENV.keycloakBaseUrl || !ENV.keycloakRealm) return "";
    const base = ENV.keycloakBaseUrl.endsWith("/")
      ? ENV.keycloakBaseUrl.slice(0, -1)
      : ENV.keycloakBaseUrl;
    return `${base}/${encodeURIComponent(ENV.keycloakRealm)}`;
  }

  private decodeState(state: string): string {
    return Buffer.from(state, "base64").toString("utf-8");
  }

  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(
    code: string,
    state: string
  ): Promise<KeycloakTokenResponse> {
    const tokenUrl = `${this.realmUrl}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: ENV.keycloakClientId,
      client_secret: ENV.keycloakClientSecret,
      code,
      redirect_uri: this.decodeState(state),
    });

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Keycloak token exchange failed: ${response.status} ${details}`);
    }

    return response.json() as Promise<KeycloakTokenResponse>;
  }

  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.access_token);
   */
  async getUserInfo(accessToken: string): Promise<KeycloakUserInfo> {
    const response = await fetch(`${this.realmUrl}/protocol/openid-connect/userinfo`, {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Keycloak userinfo failed: ${response.status} ${details}`);
    }

    return response.json() as Promise<KeycloakUserInfo>;
  }

  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret.trim();
    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }
    return new TextEncoder().encode(secret);
  }

  /**
   * Create a session token for an authenticated user.
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string; email?: string | null; loginMethod?: string | null } = {}
  ): Promise<string> {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || "",
        email: options.email ?? null,
        loginMethod: options.loginMethod ?? "keycloak",
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name,
      email: payload.email ?? null,
      loginMethod: payload.loginMethod ?? null,
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<{ openId: string; appId: string; name: string; email?: string | null; loginMethod?: string | null } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name, email, loginMethod } = payload as Record<string, unknown>;

      if (
        !isNonEmptyString(openId) ||
        !isNonEmptyString(appId) ||
        !isNonEmptyString(name)
      ) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        openId,
        appId,
        name,
        email: typeof email === "string" ? email : null,
        loginMethod: typeof loginMethod === "string" ? loginMethod : null,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    const database = await db.getDb();

    if (!database) {
      const localEmail = process.env.LOCAL_LOGIN_EMAIL?.trim().toLowerCase();
      const sessionEmail = session.email?.trim().toLowerCase();

      if (
        session.loginMethod === "local" &&
        localEmail &&
        sessionEmail === localEmail
      ) {
        return {
          id: 0,
          openId: session.openId,
          name: session.name || "Local Admin",
          email: session.email ?? null,
          loginMethod: "local",
          role: "admin",
          passwordHash: null,
          createdAt: signedInAt,
          updatedAt: signedInAt,
          lastSignedIn: signedInAt,
        };
      }
    }

    let user = await db.getUserByOpenId(sessionUserId);

    if (!user) {
      await db.upsertUser({
        openId: session.openId,
        name: session.name || null,
        email: session.email ?? null,
        loginMethod: session.loginMethod ?? "keycloak",
        lastSignedIn: signedInAt,
      });
      user = await db.getUserByOpenId(session.openId);
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt,
    });

    return user;
  }
}

/** Result of `sdk.authenticateRequest`. */
export type AuthenticatedUser = User & {
  taskUid?: string;
  isCron?: boolean;
};

export const sdk = new SDKServer();
