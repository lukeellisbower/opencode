import { createOpencodeClient } from "@opencode-ai/sdk";
import { AnthropicAuth, type AnthropicAuthMethod } from "./anthropic-auth";

export interface AuthResult {
  success: boolean;
  authUrl?: string;
  instructions?: string;
  message?: string;
  error?: string;
}

export class AuthService {
  private anthropicAuth: AnthropicAuth;
  private opencodeClient: ReturnType<typeof createOpencodeClient>;

  constructor(opencodeServerUrl: string = "/api/opencode") {
    this.anthropicAuth = new AnthropicAuth(opencodeServerUrl);
    this.opencodeClient = createOpencodeClient({
      baseUrl: opencodeServerUrl,
    });
  }

  /**
   * Frontend: Initiate Anthropic authentication
   */
  async startAnthropicAuth(method: AnthropicAuthMethod): Promise<AuthResult> {
    try {
      const authData = await this.anthropicAuth.getAuthorizationUrl(method);

      // Store verifier temporarily (in session storage, state, etc.)
      sessionStorage.setItem("anthropic_verifier", authData.verifier);
      sessionStorage.setItem("anthropic_method", method);

      // Return URL for user to visit
      return {
        success: true,
        authUrl: authData.url,
        instructions:
          method === "claude-pro"
            ? "Log in with your Claude Pro/Max account"
            : "Log in to create an API key",
      };
    } catch (error) {
      console.error("Failed to initialize authentication:", error);
      return {
        success: false,
        error: "Failed to initialize authentication",
      };
    }
  }

  /**
   * Frontend: Complete authentication after user returns with code
   */
  async completeAnthropicAuth(authCode: string): Promise<AuthResult> {
    try {
      const verifier = sessionStorage.getItem("anthropic_verifier");
      const method = sessionStorage.getItem(
        "anthropic_method",
      ) as AnthropicAuthMethod;

      if (!verifier || !method) {
        return {
          success: false,
          error:
            "Missing authentication data. Please restart the authentication process.",
        };
      }

      const success = await this.anthropicAuth.completeOAuthFlow(
        authCode,
        verifier,
        method,
      );

      if (success) {
        // Clean up temporary storage
        sessionStorage.removeItem("anthropic_verifier");
        sessionStorage.removeItem("anthropic_method");

        return {
          success: true,
          message: "Successfully authenticated with Anthropic Claude",
        };
      } else {
        return {
          success: false,
          error: "Failed to complete authentication",
        };
      }
    } catch (error) {
      console.error("Authentication error:", error);
      return {
        success: false,
        error: "Authentication error occurred",
      };
    }
  }

  /**
   * For simple API key providers like OpenAI
   */
  async storeApiKey(provider: string, apiKey: string): Promise<AuthResult> {
    if (!apiKey.trim()) {
      return {
        success: false,
        error: "API key cannot be empty",
      };
    }

    try {
      const response = await fetch(`/api/opencode/auth/${provider}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "api",
          key: apiKey,
        }),
      });

      if (!response.ok) {
        console.error(
          `Failed to store ${provider} API key:`,
          response.status,
          response.statusText,
        );
        return {
          success: false,
          error: `Failed to store ${provider} API key`,
        };
      }

      return {
        success: true,
        message: `Successfully stored ${provider} API key`,
      };
    } catch (error) {
      console.error(`Failed to store ${provider} API key:`, error);
      return {
        success: false,
        error: `Failed to store ${provider} API key`,
      };
    }
  }

  /**
   * Clear authentication for a provider
   */
  async clearAuth(providerId: string): Promise<AuthResult> {
    try {
      const response = await fetch(`/api/opencode/auth/${providerId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.error(
          `Failed to clear auth for ${providerId}:`,
          response.status,
          response.statusText,
        );
        return {
          success: false,
          error: `Failed to clear authentication for ${providerId}`,
        };
      }

      return {
        success: true,
        message: `Successfully cleared authentication for ${providerId}`,
      };
    } catch (error) {
      console.error(`Failed to clear auth for ${providerId}:`, error);
      return {
        success: false,
        error: `Failed to clear authentication for ${providerId}`,
      };
    }
  }

  /**
   * Get current provider status
   */
  async getProviderStatus() {
    try {
      const response = await this.opencodeClient.config.providers();
      return {
        success: true,
        data: response,
      };
    } catch (error) {
      console.error("Failed to get provider status:", error);
      return {
        success: false,
        error: "Failed to get provider status",
      };
    }
  }
}
