import { createOpencodeClient } from "@opencode-ai/sdk";
import { generatePKCE } from "@openauthjs/openauth/pkce";

const CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

// Fallback PKCE implementation for environments without crypto.subtle
function generateRandomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generatePKCEFallback() {
  // Generate a random code verifier (43-128 characters)
  const codeVerifier = generateRandomString(128);

  // For the code challenge, we'll use the verifier directly (plain method)
  // This is less secure but works without crypto.subtle
  return {
    verifier: codeVerifier,
    challenge: codeVerifier,
    method: "plain" as const,
  };
}

async function safePKCEGenerate() {
  try {
    // Try the secure method first
    return await generatePKCE();
  } catch (error) {
    console.warn(
      "crypto.subtle not available, using fallback PKCE implementation",
    );
    return await generatePKCEFallback();
  }
}

export type AnthropicAuthMode = "max" | "console";
export type AnthropicAuthMethod = "claude-pro" | "api-key";

interface PKCEData {
  challenge: string;
  verifier: string;
}

interface AuthorizeResult {
  url: string;
  verifier: string;
}

interface ExchangeResult {
  type: "success" | "failed";
  refresh?: string;
  access?: string;
  expires?: number;
  key?: string;
}

export class AnthropicAuth {
  private opencodeClient: ReturnType<typeof createOpencodeClient>;

  constructor(opencodeBaseUrl: string = "/api/opencode") {
    this.opencodeClient = createOpencodeClient({
      baseUrl: opencodeBaseUrl,
    });
  }

  /**
   * Step 1: Generate authorization URL for user to visit
   */
  async getAuthorizationUrl(
    method: AnthropicAuthMethod,
  ): Promise<AuthorizeResult> {
    const mode: AnthropicAuthMode = method === "claude-pro" ? "max" : "console";
    const pkce = await safePKCEGenerate();

    const url = new URL(
      `https://${mode === "console" ? "console.anthropic.com" : "claude.ai"}/oauth/authorize`,
    );

    url.searchParams.set("code", "true");
    url.searchParams.set("client_id", CLIENT_ID);
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "redirect_uri",
      "https://console.anthropic.com/oauth/code/callback",
    );
    url.searchParams.set(
      "scope",
      "org:create_api_key user:profile user:inference",
    );
    url.searchParams.set("code_challenge", pkce.challenge);
    url.searchParams.set("code_challenge_method", "S256");
    url.searchParams.set("state", pkce.verifier);

    return {
      url: url.toString(),
      verifier: pkce.verifier,
    };
  }

  /**
   * Step 2: Exchange authorization code for tokens
   */
  async exchangeCode(
    code: string,
    verifier: string,
    method: AnthropicAuthMethod,
  ): Promise<ExchangeResult> {
    const splits = code.split("#");

    try {
      // Use backend proxy to avoid CORS issues
      const response = await fetch("/api/anthropic/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: splits[0],
          state: splits[1],
          grant_type: "authorization_code",
          client_id: CLIENT_ID,
          redirect_uri: "https://console.anthropic.com/oauth/code/callback",
          code_verifier: verifier,
        }),
      });

      if (!response.ok) {
        return { type: "failed" };
      }

      const json = await response.json();

      // For Claude Pro/Max, return OAuth tokens
      if (method === "claude-pro") {
        return {
          type: "success",
          refresh: json.refresh_token,
          access: json.access_token,
          expires: Date.now() + json.expires_in * 1000,
        };
      }

      // For API key creation, use the access token to create an API key
      if (method === "api-key") {
        const apiKeyResponse = await fetch("/api/anthropic/oauth/api-key", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_token: json.access_token,
          }),
        });

        if (!apiKeyResponse.ok) {
          return { type: "failed" };
        }

        const apiKeyResult = await apiKeyResponse.json();
        return {
          type: "success",
          key: apiKeyResult.raw_key,
        };
      }

      return { type: "failed" };
    } catch (error) {
      console.error("Error exchanging code:", error);
      return { type: "failed" };
    }
  }

  /**
   * Step 3: Store credentials in OpenCode server
   */
  async storeCredentials(result: ExchangeResult): Promise<boolean> {
    if (result.type === "failed") {
      return false;
    }

    try {
      let body: any;
      if (result.key) {
        // Store API key
        body = {
          type: "api",
          key: result.key,
        };
      } else if (result.refresh && result.access && result.expires) {
        // Store OAuth tokens
        body = {
          type: "oauth",
          refresh: result.refresh,
          access: result.access,
          expires: result.expires,
        };
      } else {
        return false;
      }

      // Use correct OpenCode API endpoint: PUT /auth/{id}
      const response = await fetch("/api/opencode/auth/anthropic", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error(
          "Failed to store credentials:",
          response.status,
          response.statusText,
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error storing credentials:", error);
      return false;
    }
  }

  /**
   * Complete OAuth flow - convenience method
   */
  async completeOAuthFlow(
    code: string,
    verifier: string,
    method: AnthropicAuthMethod,
  ): Promise<boolean> {
    const exchangeResult = await this.exchangeCode(code, verifier, method);
    if (exchangeResult.type === "failed") {
      return false;
    }
    return await this.storeCredentials(exchangeResult);
  }
}
