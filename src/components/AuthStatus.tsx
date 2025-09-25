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
  models: string[];
  authenticated: boolean;
  authType?: "api" | "oauth" | "wellknown";
}

interface ProvidersResponse {
  providers: Provider[];
  default: Record<string, string>;
}

export function AuthStatus() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<{
    show: boolean;
    provider: Provider | null;
  }>({ show: false, provider: null });

  const fetchProviders = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("🔍 Fetching providers...");
      const response = await fetch("/api/opencode/config/providers");

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: ProvidersResponse = await response.json();
      console.log("🔍 Providers response:", data);

      // Check if Anthropic is authenticated in the response
      const anthropicProvider = data.providers?.find(
        (p) => p.id === "anthropic",
      );
      if (anthropicProvider) {
        console.log(
          "🔍 Anthropic provider status:",
          anthropicProvider.authenticated,
        );
      }

      setProviders(data.providers || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      console.error("Error fetching providers:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  const getStatusColor = (authenticated: boolean) => {
    return authenticated ? "text-green-600" : "text-red-600";
  };

  const getStatusText = (authenticated: boolean) => {
    return authenticated ? "Authenticated" : "Not Authenticated";
  };

  const handleAuthClick = (provider: Provider) => {
    setShowAuthModal({ show: true, provider });
  };

  const handleAuthSuccess = () => {
    console.log("🔄 Auth success - closing modal and refreshing providers");
    setShowAuthModal({ show: false, provider: null });
    // Add a small delay to ensure the auth is fully processed
    setTimeout(() => {
      console.log("🔄 Fetching providers after auth success");
      fetchProviders();
    }, 500);
  };

  const handleClearAuth = async (providerId: string) => {
    try {
      await authService.clearAuth(providerId);
      fetchProviders(); // Refresh the provider status
    } catch (err) {
      console.error("Failed to clear authentication:", err);
    }
  };

  const authenticatedCount = providers.filter((p) => p.authenticated).length;
  const totalCount = providers.length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Claude Code Authentication Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            <span className="ml-2">Loading authentication status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Claude Code Authentication Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 mb-4">Error: {error}</div>
          <Button onClick={fetchProviders} variant="outline">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claude Code Authentication Status</CardTitle>
        <div className="text-sm text-gray-600">
          {authenticatedCount} of {totalCount} providers authenticated
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
                  {provider.models.length} models available
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div
                    className={`font-medium ${getStatusColor(provider.authenticated)}`}
                  >
                    {getStatusText(provider.authenticated)}
                  </div>
                  {provider.authType && (
                    <div className="text-xs text-gray-500 capitalize">
                      {provider.authType}
                    </div>
                  )}
                </div>
                <div className="flex space-x-2">
                  {!provider.authenticated ? (
                    <Button
                      onClick={() => handleAuthClick(provider)}
                      size="sm"
                      variant="outline"
                    >
                      Authenticate
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleClearAuth(provider.id)}
                      size="sm"
                      variant="outline"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {providers.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            No providers found
          </div>
        )}

        <div className="mt-4 pt-4 border-t">
          <Button onClick={fetchProviders} variant="outline" className="w-full">
            Refresh Status
          </Button>
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
