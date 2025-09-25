# Server-Side OAuth Setup for Cloud VM

## Overview
This solution uses a headless browser on the server to handle OAuth authentication, avoiding CORS issues when the auth URL is opened from a different origin.

## Installation on Cloud VM

### 1. Install Puppeteer
```bash
bun add puppeteer
```

### 2. Install Chrome/Chromium Dependencies (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install -y \
  ca-certificates \
  fonts-liberation \
  libappindicator3-1 \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libc6 \
  libcairo2 \
  libcups2 \
  libdbus-1-3 \
  libexpat1 \
  libfontconfig1 \
  libgbm1 \
  libgcc1 \
  libglib2.0-0 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libpango-1.0-0 \
  libpangocairo-1.0-0 \
  libstdc++6 \
  libx11-6 \
  libx11-xcb1 \
  libxcb1 \
  libxcomposite1 \
  libxcursor1 \
  libxdamage1 \
  libxext6 \
  libxfixes3 \
  libxi6 \
  libxrandr2 \
  libxrender1 \
  libxss1 \
  libxtst6 \
  lsb-release \
  wget \
  xdg-utils
```

### 3. For Headless Servers (Optional)
If running on a headless server, you can set up X11 forwarding:
```bash
sudo apt-get install xvfb
```

## How It Works

### 1. User clicks "Login with Claude Pro/Max"
- Frontend calls `/api/anthropic/oauth/server` with the auth URL

### 2. Server opens browser
- Puppeteer launches a browser window on the server
- User completes authentication in the server's browser
- Server captures the OAuth callback with auth code

### 3. Complete authentication
- Server returns auth code to frontend
- Frontend completes OAuth flow and stores credentials

## Configuration Options

### Headless Mode
In `src/lib/server-oauth.ts`, set:
```typescript
headless: true  // For truly headless operation
headless: false // To see the browser window (useful for debugging)
```

### Browser Arguments
Modify browser launch args in `server-oauth.ts`:
```typescript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor'
]
```

## Usage

1. Deploy the updated code to your cloud VM
2. Ensure Puppeteer and Chrome dependencies are installed
3. Start your server
4. Users can now authenticate directly through the server

## Troubleshooting

### Browser Launch Fails
```bash
# Check if Chrome is available
which google-chrome-stable
# or
which chromium-browser

# Test Puppeteer installation
node -e "const puppeteer = require('puppeteer'); puppeteer.launch().then(browser => { console.log('Success!'); browser.close(); });"
```

### Permission Issues
```bash
# Fix permissions for Chrome sandbox
sudo chmod 4755 /opt/google/chrome/chrome-sandbox
# or disable sandbox (less secure)
args: ['--no-sandbox', '--disable-setuid-sandbox']
```

### Display Issues on Headless Server
```bash
# Use Xvfb for virtual display
Xvfb :99 -screen 0 1024x768x24 > /dev/null 2>&1 &
export DISPLAY=:99
```

## Security Notes

- The browser runs on your server, so user credentials never leave your server
- OAuth flow is completed server-side, avoiding CORS issues
- Browser automatically closes after authentication
- Session data is cleaned up automatically

## Alternative: SSH Tunneling (Simpler Option)

If server-side browser is problematic, you can also use SSH tunneling:

```bash
# On your local machine, tunnel to your VM
ssh -L 3000:localhost:3000 user@your-vm-ip

# Then access http://localhost:3000 locally
# This makes the OAuth flow work as if it's running locally
```

This avoids the need for Puppeteer but requires SSH access.