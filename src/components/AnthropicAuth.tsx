import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { AuthService } from "../lib/auth-service";

const authService = new AuthService();

interface AnthropicAuthProps {
  onAuthSuccess?: () => void;
}

export function AnthropicAuth({ onAuthSuccess }: AnthropicAuthProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");

  const clearMessages = () => {
    setMessage("");
    setError("");
  };

  const handleCompleteAuth = useCallback(async (code: string, state: string) => {
    if (!code || !state) {
      setError("Invalid authentication response.");
      setIsAuthenticating(false);
      return;
    }
    
    clearMessages();
    setMessage("Authentication code received. Verifying...");
    setIsLoading(true);
    setIsAuthenticating(false);

    try {
      const result = await authService.completeAnthropicAuth(code, state);
      if (result.success) {
        setMessage(result.message || "Authentication completed successfully!");
        onAuthSuccess?.();
      } else {
        setError(result.error || "Failed to complete authentication");
      }
    } catch (err) {
      setError("Failed to complete authentication");
    } finally {
      setIsLoading(false);
    }
  }, [onAuthSuccess]);

  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data?.type === "anthropic-auth") {
        const { code, state } = event.data;
        handleCompleteAuth(code, state);
      }
    };

    window.addEventListener("message", handleAuthMessage);
    return () => {
      window.removeEventListener("message", handleAuthMessage);
    };
  }, [handleCompleteAuth]);

  const handleStartAuth = async (method: "claude-pro" | "api-key") => {
    clearMessages();
    setIsLoading(true);
    setIsAuthenticating(true);

    try {
      const result = await authService.startAnthropicAuth(method);
      if (result.success && result.authUrl) {
        window.open(result.authUrl, "_blank", "width=800,height=600");
        setMessage("Please complete the authentication in the popup window.");
      } else {
        setError(result.error || "Failed to start authentication");
        setIsAuthenticating(false);
      }
    } catch (err) {
      setError("Failed to start authentication");
      setIsAuthenticating(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Anthropic Claude Authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAuthenticating ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Choose your preferred authentication method:
            </p>
            <div className="space-y-2">
              <Button
                onClick={() => handleStartAuth("claude-pro")}
                disabled={isLoading}
                className="w-full"
                variant="default"
              >
                {isLoading ? "Starting..." : "Login with Claude Pro/Max"}
              </Button>
              <Button
                onClick={() => handleStartAuth("api-key")}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? "Starting..." : "Create API Key"}
              </Button>
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <p>
                <strong>Claude Pro/Max:</strong> Use your existing subscription (zero cost).
              </p>
              <p>
                <strong>API Key:</strong> Create a new API key for pay-per-use.
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-lg font-semibold">Waiting for Authentication...</p>
            <p className="text-sm text-gray-600 mt-2">
              Please complete the process in the popup window. This window will automatically update once authentication is complete.
            </p>
            <Button variant="outline" className="mt-4" onClick={() => setIsAuthenticating(false)}>Cancel</Button>
          </div>
        )}

        {message && (
          <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
            {message}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}