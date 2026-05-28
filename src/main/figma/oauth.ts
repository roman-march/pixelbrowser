import { app, safeStorage, shell } from "electron";
import { Buffer } from "node:buffer";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FigmaAuthStatus } from "../../shared/types";

const FIGMA_AUTH_URL = "https://www.figma.com/oauth";
const FIGMA_TOKEN_URL = "https://api.figma.com/v1/oauth/token";
const FIGMA_REFRESH_URL = "https://api.figma.com/v1/oauth/refresh";
const DEFAULT_REDIRECT_URI = "http://127.0.0.1:17359/figma/oauth/callback";
const DEFAULT_SCOPE = "file_content:read";
const OAUTH_TIMEOUT_MS = 120_000;
const TOKEN_REFRESH_SKEW_MS = 60_000;

type FigmaOAuthConfig = {
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scope: string;
  tokenExchangeUrl?: string;
};

type FigmaOAuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId?: string;
};

type StoredSession =
  | { encrypted: true; data: string }
  | { encrypted: false; data: FigmaOAuthSession };

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  user_id_string?: string;
  user_id?: string;
  err?: string;
  message?: string;
};

let cachedSession: FigmaOAuthSession | null | undefined;
let activeOAuthFlow: Promise<FigmaAuthStatus> | null = null;

export async function getFigmaAuthStatus(): Promise<FigmaAuthStatus> {
  const config = getFigmaOAuthConfig();
  if (!config) {
    return {
      configured: false,
      connected: false,
      reason: oauthConfigReason(),
    };
  }

  const session = await loadSession();
  if (!session) {
    return { configured: true, connected: false };
  }

  return {
    configured: true,
    connected: true,
    expiresAt: new Date(session.expiresAt).toISOString(),
    userId: session.userId,
  };
}

export async function connectFigma(): Promise<FigmaAuthStatus> {
  if (activeOAuthFlow) {
    return activeOAuthFlow;
  }

  activeOAuthFlow = runOAuthFlow().finally(() => {
    activeOAuthFlow = null;
  });
  return activeOAuthFlow;
}

export async function disconnectFigma(): Promise<FigmaAuthStatus> {
  cachedSession = null;
  try {
    await unlink(sessionPath());
  } catch {
    // Already disconnected.
  }

  return getFigmaAuthStatus();
}

export async function getFigmaAccessToken(): Promise<string> {
  const config = getFigmaOAuthConfig();
  if (!config) {
    throw new Error(oauthConfigReason());
  }

  const session = await loadSession();
  if (!session) {
    throw new Error("Connect Figma before importing frames.");
  }

  if (session.expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS) {
    return session.accessToken;
  }

  const refreshed = await refreshAccessToken(config, session);
  await saveSession(refreshed);
  return refreshed.accessToken;
}

async function runOAuthFlow(): Promise<FigmaAuthStatus> {
  const config = getFigmaOAuthConfig();
  if (!config) {
    return {
      configured: false,
      connected: false,
      reason: oauthConfigReason(),
    };
  }

  const state = randomToken(24);
  const codeVerifier = randomToken(48);
  const codeChallenge = pkceChallenge(codeVerifier);
  const callback = await waitForOAuthCallback(config.redirectUri, state);
  const authUrl = buildAuthUrl({
    config,
    state,
    codeChallenge,
  });

  await shell.openExternal(authUrl);
  const code = await callback.code;
  await closeCallbackServer(callback.server);

  const session = await exchangeCodeForToken({
    code,
    codeVerifier,
    config,
  });
  await saveSession(session);
  return getFigmaAuthStatus();
}

function getFigmaOAuthConfig(): FigmaOAuthConfig | null {
  const clientId = process.env.FIGMA_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.FIGMA_OAUTH_CLIENT_SECRET?.trim() ?? "";
  const tokenExchangeUrl =
    process.env.FIGMA_OAUTH_TOKEN_EXCHANGE_URL?.trim() ?? "";
  const redirectUri =
    process.env.FIGMA_OAUTH_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI;
  const scope = process.env.FIGMA_OAUTH_SCOPE?.trim() || DEFAULT_SCOPE;

  if (!clientId || (!clientSecret && !tokenExchangeUrl)) {
    return null;
  }

  return {
    clientId,
    clientSecret: clientSecret || undefined,
    redirectUri,
    scope,
    tokenExchangeUrl: tokenExchangeUrl || undefined,
  };
}

function oauthConfigReason(): string {
  if (!process.env.FIGMA_OAUTH_CLIENT_ID?.trim()) {
    return "Figma OAuth is not configured: set FIGMA_OAUTH_CLIENT_ID.";
  }
  if (
    !process.env.FIGMA_OAUTH_CLIENT_SECRET?.trim() &&
    !process.env.FIGMA_OAUTH_TOKEN_EXCHANGE_URL?.trim()
  ) {
    return "Figma OAuth is not configured: set FIGMA_OAUTH_TOKEN_EXCHANGE_URL or FIGMA_OAUTH_CLIENT_SECRET.";
  }
  return "Figma OAuth is not configured.";
}

function buildAuthUrl({
  config,
  state,
  codeChallenge,
}: {
  config: FigmaOAuthConfig;
  state: string;
  codeChallenge: string;
}): string {
  const url = new URL(FIGMA_AUTH_URL);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

async function waitForOAuthCallback(
  redirectUri: string,
  expectedState: string,
): Promise<{ code: Promise<string>; server: Server }> {
  const redirect = new URL(redirectUri);
  if (!["127.0.0.1", "localhost"].includes(redirect.hostname)) {
    throw new Error(
      "Figma OAuth redirect URI must use localhost for the desktop callback.",
    );
  }

  const port = Number(redirect.port);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Figma OAuth redirect URI must include a localhost port.");
  }

  let finish!: (code: string) => void;
  let fail!: (error: Error) => void;
  const code = new Promise<string>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });

  const server = createServer((request, response) => {
    handleCallbackRequest({
      expectedPath: redirect.pathname,
      expectedState,
      finish,
      fail,
      request,
      response,
      server,
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, redirect.hostname, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const timeout = setTimeout(() => {
    fail(new Error("Figma OAuth timed out before the browser callback arrived."));
    void closeCallbackServer(server);
  }, OAUTH_TIMEOUT_MS);
  code.finally(() => clearTimeout(timeout)).catch(() => undefined);

  return { code, server };
}

function handleCallbackRequest({
  expectedPath,
  expectedState,
  fail,
  finish,
  request,
  response,
  server,
}: {
  expectedPath: string;
  expectedState: string;
  fail: (error: Error) => void;
  finish: (code: string) => void;
  request: IncomingMessage;
  response: ServerResponse;
  server: Server;
}) {
  const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
  if (requestUrl.pathname !== expectedPath) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  const error = requestUrl.searchParams.get("error");
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");

  if (error) {
    response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    response.end(oauthCallbackHtml("Figma connection was rejected."));
    fail(new Error(`Figma OAuth error: ${error}`));
    void closeCallbackServer(server);
    return;
  }

  if (!code || state !== expectedState) {
    response.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
    response.end(oauthCallbackHtml("Figma connection failed."));
    fail(new Error("Figma OAuth callback state did not match."));
    void closeCallbackServer(server);
    return;
  }

  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(oauthCallbackHtml("Figma connected. You can return to Pixel Browser."));
  finish(code);
}

async function exchangeCodeForToken({
  code,
  codeVerifier,
  config,
}: {
  code: string;
  codeVerifier: string;
  config: FigmaOAuthConfig;
}): Promise<FigmaOAuthSession> {
  const body = new URLSearchParams({
    redirect_uri: config.redirectUri,
    code,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });
  const token = config.tokenExchangeUrl
    ? await postOAuthExchangeEndpoint(config, body)
    : await postFigmaOAuthToken(FIGMA_TOKEN_URL, config, body);
  if (!token.refresh_token) {
    throw new Error("Figma OAuth did not return a refresh token.");
  }

  return toSession(token, token.refresh_token);
}

async function refreshAccessToken(
  config: FigmaOAuthConfig,
  session: FigmaOAuthSession,
): Promise<FigmaOAuthSession> {
  const body = new URLSearchParams({
    refresh_token: session.refreshToken,
  });
  const token = config.tokenExchangeUrl
    ? await postOAuthExchangeEndpoint(config, body)
    : await postFigmaOAuthToken(FIGMA_REFRESH_URL, config, body);
  return toSession(token, token.refresh_token ?? session.refreshToken, session.userId);
}

async function postFigmaOAuthToken(
  url: string,
  config: FigmaOAuthConfig,
  body: URLSearchParams,
): Promise<TokenResponse> {
  if (!config.clientSecret) {
    throw new Error("Figma OAuth client secret is not configured.");
  }

  const credentials = Buffer.from(
    `${config.clientId}:${config.clientSecret}`,
    "utf8",
  ).toString("base64");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const token = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok || !token.access_token || !token.expires_in) {
    const message = token.err || token.message || `Figma OAuth error (${response.status}).`;
    throw new Error(message);
  }

  return token;
}

async function postOAuthExchangeEndpoint(
  config: FigmaOAuthConfig,
  body: URLSearchParams,
): Promise<TokenResponse> {
  if (!config.tokenExchangeUrl) {
    throw new Error("Figma OAuth token exchange endpoint is not configured.");
  }

  const response = await fetch(config.tokenExchangeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: config.clientId,
      ...Object.fromEntries(body.entries()),
    }),
  });
  const token = (await response.json().catch(() => ({}))) as TokenResponse;

  if (!response.ok || !token.access_token || !token.expires_in) {
    const message = token.err || token.message || `Figma OAuth error (${response.status}).`;
    throw new Error(message);
  }

  return token;
}

function toSession(
  token: TokenResponse,
  refreshToken: string,
  fallbackUserId?: string,
): FigmaOAuthSession {
  return {
    accessToken: token.access_token ?? "",
    refreshToken,
    expiresAt: Date.now() + Math.max(1, token.expires_in ?? 1) * 1000,
    userId: token.user_id_string ?? token.user_id ?? fallbackUserId,
  };
}

async function loadSession(): Promise<FigmaOAuthSession | null> {
  if (cachedSession !== undefined) {
    return cachedSession;
  }

  try {
    const stored = JSON.parse(await readFile(sessionPath(), "utf8")) as StoredSession;
    cachedSession = stored.encrypted
      ? JSON.parse(
          safeStorage.decryptString(Buffer.from(stored.data, "base64")),
        ) as FigmaOAuthSession
      : stored.data;
  } catch {
    cachedSession = null;
  }

  return cachedSession;
}

async function saveSession(session: FigmaOAuthSession): Promise<void> {
  cachedSession = session;
  await mkdir(app.getPath("userData"), { recursive: true });
  const stored: StoredSession = safeStorage.isEncryptionAvailable()
    ? {
        encrypted: true,
        data: safeStorage.encryptString(JSON.stringify(session)).toString("base64"),
      }
    : { encrypted: false, data: session };

  await writeFile(sessionPath(), JSON.stringify(stored, null, 2), "utf8");
}

function sessionPath(): string {
  return join(app.getPath("userData"), "figma-oauth-session.json");
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function closeCallbackServer(server: Server): Promise<void> {
  if (!server.listening) {
    return;
  }

  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
}

function oauthCallbackHtml(message: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Pixel Browser Figma OAuth</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #090b0f;
        color: #eef3f8;
        font: 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
    </style>
  </head>
  <body>${escapeHtml(message)}</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
