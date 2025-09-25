# OpenCode Authentication Integration

This implementation adds support for Anthropic OAuth authentication and generic API key authentication to your OpenCode dashboard.

## Features

### 1. Anthropic OAuth Authentication
- **Claude Pro/Max Login**: Zero-cost authentication using existing Claude Pro/Max subscription
- **API Key Creation**: OAuth-based API key generation for pay-per-use billing
- **PKCE Security**: Implements secure OAuth 2.0 flow with PKCE (Proof Key for Code Exchange)
- **Automatic Credential Storage**: Seamlessly integrates with OpenCode server credential storage

### 2. Generic API Key Authentication
- **Multi-Provider Support**: Works with OpenAI, Google, and other API key-based providers
- **Secure Storage**: API keys are securely stored in the OpenCode server
- **Easy Management**: Simple UI for adding and clearing credentials

## How to Use

### Anthropic Authentication

1. **Start Authentication**: Click "Authenticate" next to Anthropic Claude in the dashboard
2. **Choose Method**:
   - **Claude Pro/Max**: Use your existing subscription (recommended for zero cost)
   - **API Key**: Create a new API key for pay-per-use billing
3. **Complete OAuth Flow**: 
   - Click "Open Anthropic Auth Page" 
   - Log in to your Anthropic account
   - Copy the authorization code from the callback URL
   - Paste it in the dashboard and click "Complete Authentication"

### API Key Authentication

1. **Start Authentication**: Click "Authenticate" next to any provider (OpenAI, Google, etc.)
2. **Enter API Key**: Paste your API key in the secure input field
3. **Save**: Click "Save API Key" to store it securely

### Managing Authentication

- **View Status**: The dashboard shows authentication status for all providers
- **Clear Authentication**: Click "Clear" to remove stored credentials for any provider
- **Refresh Status**: Click "Refresh Status" to update authentication information

## Implementation Details

### Files Added

- `src/lib/anthropic-auth.ts` - Core Anthropic OAuth implementation
- `src/lib/auth-service.ts` - Authentication service layer
- `src/components/AnthropicAuth.tsx` - Anthropic OAuth UI component
- `src/components/ApiKeyAuth.tsx` - Generic API key authentication component

### Files Modified

- `src/components/AuthStatus.tsx` - Enhanced with authentication UI and modal system
- `package.json` - Added `@openauthjs/openauth` dependency

### Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │    │  Auth Service    │    │ OpenCode Server │
│                 │    │                  │    │                 │
│ • AuthStatus    │◄──►│ • startAuth()    │◄──►│ • Credential    │
│ • AnthropicAuth │    │ • completeAuth() │    │   Storage       │
│ • ApiKeyAuth    │    │ • storeApiKey()  │    │ • Provider      │
│                 │    │ • clearAuth()    │    │   Management    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Security Features

- **PKCE Implementation**: Prevents authorization code interception attacks
- **Session Storage**: Temporary storage of OAuth verifiers (auto-cleared)
- **Secure Transmission**: All credentials transmitted over HTTPS
- **No Local Storage**: API keys never stored in browser localStorage

## Development

### Dependencies

```bash
bun install @openauthjs/openauth
```

### Building

```bash
bun run build
```

### Testing

The implementation includes comprehensive error handling and user feedback for various scenarios:

- Network failures
- Invalid authorization codes
- Missing authentication data
- Server communication errors

## Security Considerations

1. **OAuth State Management**: Uses secure PKCE flow with cryptographically secure verifiers
2. **Temporary Storage**: OAuth verifiers stored only in sessionStorage and cleared after use
3. **Error Handling**: Comprehensive error handling prevents credential leakage
4. **Server Integration**: Leverages OpenCode server's secure credential storage

## Troubleshooting

### Common Issues

1. **"Missing authentication data"**: Restart the authentication flow
2. **"Failed to complete authentication"**: Check if the authorization code was copied correctly
3. **Server connection errors**: Ensure OpenCode server is running and accessible

### Debug Information

- Check browser console for detailed error messages
- Verify network requests in browser developer tools
- OpenCode server logs contain additional authentication details