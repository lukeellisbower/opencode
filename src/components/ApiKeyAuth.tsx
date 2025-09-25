import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { AuthService } from '../lib/auth-service';

const authService = new AuthService();

interface ApiKeyAuthProps {
  providerId: string;
  providerName: string;
  onAuthSuccess?: () => void;
}

export function ApiKeyAuth({ providerId, providerName, onAuthSuccess }: ApiKeyAuthProps) {
  const [apiKey, setApiKey] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const clearMessages = () => {
    setMessage('');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }

    clearMessages();
    setIsLoading(true);

    try {
      const result = await authService.storeApiKey(providerId, apiKey);

      if (result.success) {
        setMessage(result.message || 'API key saved successfully!');
        setApiKey('');
        onAuthSuccess?.();
      } else {
        setError(result.error || 'Failed to save API key');
      }
    } catch (err) {
      setError('Failed to save API key');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{providerName} API Key</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              type="password"
              placeholder={`Enter your ${providerName} API key...`}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <Button
            type="submit"
            disabled={isLoading || !apiKey.trim()}
            className="w-full"
          >
            {isLoading ? 'Saving...' : 'Save API Key'}
          </Button>

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
        </form>
      </CardContent>
    </Card>
  );
}
