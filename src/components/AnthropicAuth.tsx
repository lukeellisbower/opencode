import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { AuthService } from '../lib/auth-service';

const authService = new AuthService();

interface AnthropicAuthProps {
  onAuthSuccess?: () => void;
}

export function AnthropicAuth({ onAuthSuccess }: AnthropicAuthProps) {
  const [authUrl, setAuthUrl] = useState<string>('');
  const [authCode, setAuthCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const clearMessages = () => {
    setMessage('');
    setError('');
  };

  const handleStartAuth = async (method: "claude-pro" | "api-key") => {
    clearMessages();
    setIsLoading(true);

    try {
      const result = await authService.startAnthropicAuth(method);

      if (result.success && result.authUrl) {
        setAuthUrl(result.authUrl);
        setMessage(result.instructions || '');
      } else {
        setError(result.error || 'Failed to start authentication');
      }
    } catch (err) {
      setError('Failed to start authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteAuth = async () => {
    if (!authCode.trim()) {
      setError('Please enter the authorization code');
      return;
    }

    clearMessages();
    setIsLoading(true);

    try {
      const result = await authService.completeAnthropicAuth(authCode);

      if (result.success) {
        setMessage(result.message || 'Authentication successful!');
        setAuthUrl('');
        setAuthCode('');
        onAuthSuccess?.();
      } else {
        setError(result.error || 'Failed to complete authentication');
      }
    } catch (err) {
      setError('Failed to complete authentication');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelAuth = () => {
    setAuthUrl('');
    setAuthCode('');
    clearMessages();

    // Clean up session storage
    sessionStorage.removeItem('anthropic_verifier');
    sessionStorage.removeItem('anthropic_method');
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Anthropic Claude Authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!authUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Choose your preferred authentication method:
            </p>

            <div className="space-y-2">
              <Button
                onClick={() => handleStartAuth('claude-pro')}
                disabled={isLoading}
                className="w-full"
                variant="default"
              >
                {isLoading ? 'Loading...' : 'Login with Claude Pro/Max'}
              </Button>

              <Button
                onClick={() => handleStartAuth('api-key')}
                disabled={isLoading}
                className="w-full"
                variant="outline"
              >
                {isLoading ? 'Loading...' : 'Create API Key'}
              </Button>
            </div>

            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Claude Pro/Max:</strong> Use your existing subscription (zero cost)</p>
              <p><strong>API Key:</strong> Create a new API key for pay-per-use</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {message && (
              <p className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                {message}
              </p>
            )}

            <div className="space-y-2">
              <p className="text-sm font-medium">Step 1: Visit the authentication page</p>
              <Button
                onClick={() => window.open(authUrl, '_blank')}
                className="w-full"
                variant="outline"
              >
                Open Anthropic Auth Page
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="auth-code">Step 2: Paste the authorization code</Label>
              <Input
                id="auth-code"
                type="text"
                placeholder="Paste authorization code here..."
                value={authCode}
                onChange={(e) => setAuthCode(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={handleCompleteAuth}
                disabled={isLoading || !authCode.trim()}
                className="flex-1"
              >
                {isLoading ? 'Authenticating...' : 'Complete Authentication'}
              </Button>

              <Button
                onClick={handleCancelAuth}
                variant="outline"
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        {message && !error && (
          <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
            {message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
