import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { AnthropicAuth } from "./AnthropicAuth";
import { ApiKeyAuth } from "./ApiKeyAuth";
import { AuthService } from "../lib/auth-service";

const authService = new AuthService();

interface Provider {
  id: string;
  name: string;
  description: string;
  authType: "api" | "oauth";
}

// Static list of providers that can be authenticated
const AVAILABLE_PROVIDERS: Provider[] = [
  {
    id: "anthropic",
    name: "Anthropic Claude",
    description: "Claude 3.5 Sonnet, Claude 3 Haiku, and other Claude models",
    authType: "oauth",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, GPT-4, GPT-3.5, and other OpenAI models",
    authType: "api",
  },
  {
    id: "google",
    name: "Google AI",
    description: "Gemini Pro, Gemini Flash, and other Google models",
    authType: "api",
  },
  {
    id: "mistral",
    name: "Mistral AI",
    description: "Mistral Large, Mistral Medium, and other Mistral models",
    authType: "api",
  },
];

export function AuthStatus() {
  const [showAuthModal, setShowAuthModal] = useState<{
    show: boolean;
    provider: Provider | null;
  }>({ show: false, provider: null });

  // Use static providers list
  const providers = AVAILABLE_PROVIDERS;

  const handleAuthClick = (provider: Provider) => {
    setShowAuthModal({ show: true, provider });
  };

  const handleAuthSuccess = () => {
    console.log("🔄 Auth success - closing modal");
    setShowAuthModal({ show: false, provider: null });
  };

  const handleClearAuth = async (providerId: string) => {
    try {
      await authService.clearAuth(providerId);
      console.log(`🔄 Cleared auth for ${providerId}`);
    } catch (err) {
      console.error("Failed to clear authentication:", err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>OpenCode Provider Authentication</CardTitle>
        <div className="text-sm text-gray-600">
          Configure authentication for AI providers
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex-1">
                <div className="font-medium">{provider.name}</div>
                <div className="text-sm text-gray-500">
                  {provider.description}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Auth type:{" "}
                  {provider.authType === "oauth"
                    ? "OAuth (Recommended)"
                    : "API Key"}
                </div>
              </div>
              <div className="flex space-x-2">
                <Button
                  onClick={() => handleAuthClick(provider)}
                  size="sm"
                  variant="outline"
                >
                  Configure
                </Button>
                <Button
                  onClick={() => handleClearAuth(provider.id)}
                  size="sm"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                >
                  Clear
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Authentication Modal */}
        {showAuthModal.show && showAuthModal.provider && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">
                  Authenticate {showAuthModal.provider.name}
                </h3>
                <Button
                  onClick={() =>
                    setShowAuthModal({ show: false, provider: null })
                  }
                  variant="ghost"
                  size="sm"
                >
                  ✕
                </Button>
              </div>

              {showAuthModal.provider.id === "anthropic" ? (
                <AnthropicAuth onAuthSuccess={handleAuthSuccess} />
              ) : (
                <ApiKeyAuth
                  providerId={showAuthModal.provider.id}
                  providerName={showAuthModal.provider.name}
                  onAuthSuccess={handleAuthSuccess}
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
