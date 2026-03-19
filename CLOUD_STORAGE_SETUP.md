# Cloud Storage Setup Guide

## Overview

This guide explains how to set up Google Drive, OneDrive, and Dropbox integrations for the video editor export functionality.

## Quick Setup

### Option 1: Skip Cloud Setup (Use Core Features Only)

If you don't need cloud storage, the app works perfectly without any setup:
- ✅ Download to device
- ✅ Mobile gallery (Android)
- ✅ Web share (mobile)
- ✅ Copy link
- ✅ Recent exports history

No environment variables needed. Users will only see device-based save options.

### Option 2: Enable Cloud Storage (5 minutes per service)

Choose one or more cloud services to enable below.

---

## Google Drive Setup

### Step 1: Create Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a Project" → "New Project"
3. Name: `VideoEditor`
4. Click "Create"

### Step 2: Enable Google Drive API
1. In the console, search for "Google Drive API"
2. Click it and press "Enable"

### Step 3: Create OAuth Credentials
1. Click "Credentials" in left sidebar
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Add authorized redirect URIs:
   - `http://localhost:3000/auth/callback` (development)
   - `https://yourdomain.com/auth/callback` (production)
5. Click "Create"
6. Copy the Client ID (not the secret!)

### Step 4: Add to Environment
Create `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
```

### Step 5: Create Auth Callback Handler
Create `src/app/auth/callback/page.tsx`:
```typescript
'use client';
import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthCallback() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Extract token from URL or localStorage based on OAuth flow
    const token = searchParams.get('access_token');
    const error = searchParams.get('error');

    if (token) {
      // Send token back to parent window
      if (window.opener) {
        window.opener.postMessage(
          { type: 'cloud-auth-complete', token },
          window.location.origin
        );
      }
      window.close();
    } else if (error) {
      console.error('Auth error:', error);
      router.push('/');
    }
  }, [searchParams, router]);

  return <div>Authenticating...</div>;
}
```

---

## Microsoft OneDrive Setup

### Step 1: Create Azure App
1. Go to [Azure Portal](https://portal.azure.com/)
2. Search for "App registrations"
3. Click "New registration"
4. Name: `VideoEditorOneDrive`
5. Redirect URI: `Web` → `http://localhost:3000/auth/callback`
6. Click "Register"

### Step 2: Get Client ID
1. Copy the "Application (client) ID"
2. Save this as `NEXT_PUBLIC_AZURE_CLIENT_ID`

### Step 3: Create Client Secret
1. Click "Certificates & secrets" in left sidebar
2. Click "+ New client secret"
3. Set expiry to "12 months"
4. Copy the secret value
5. Save as `AZURE_CLIENT_SECRET` (keep private, server-side only)

### Step 4: Configure API Permissions
1. Click "API permissions"
2. Click "+ Add a permission"
3. Select "Microsoft Graph"
4. Choose "Delegated permissions"
5. Search and add:
   - `Files.ReadWrite.All`
   - `offline_access`
6. Click "Grant admin consent"

### Step 5: Add to Environment
```bash
NEXT_PUBLIC_AZURE_CLIENT_ID=YOUR_CLIENT_ID
```

---

## Dropbox Setup

### Step 1: Create Dropbox App
1. Go to [Dropbox Developer Console](https://www.dropbox.com/developers/apps)
2. Click "Create app"
3. Choose:
   - API: **Scoped access**
   - Type: **App folder**
   - Name: `VideoEditor`
4. Click "Create app"

### Step 2: Get App Key
1. On the app page, go to "Settings"
2. Under "Basic info", copy the "App key"
3. Save as `NEXT_PUBLIC_DROPBOX_CLIENT_ID`

### Step 3: Set OAuth Redirect
1. Scroll to "OAuth 2"
2. Add redirect URI: `http://localhost:3000/auth/callback`
3. Save

### Step 4: Add to Environment
```bash
NEXT_PUBLIC_DROPBOX_CLIENT_ID=YOUR_APP_KEY
```

---

## Complete .env.local Example

```bash
# Google Drive
NEXT_PUBLIC_GOOGLE_CLIENT_ID=123456789-abc.apps.googleusercontent.com

# Microsoft OneDrive
NEXT_PUBLIC_AZURE_CLIENT_ID=12345678-1234-1234-1234-123456789abc

# Dropbox
NEXT_PUBLIC_DROPBOX_CLIENT_ID=abc123def456
```

---

## Backend OAuth Handler (Optional)

For production, implement secure OAuth token exchange on your backend:

### Example: `api/auth/token.ts`
```typescript
export async function POST(request: Request) {
  const { code, service } = await request.json();

  // Exchange auth code for access token
  // This keeps the Client Secret safe
  const tokenEndpoint = getTokenEndpoint(service);
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env[`NEXT_PUBLIC_${service.toUpperCase()}_CLIENT_ID`]!,
      client_secret: process.env[`${service.toUpperCase()}_CLIENT_SECRET`]!,
      redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();
  return Response.json({ token: data.access_token });
}
```

---

## Testing Cloud Integration

### Quick Test
1. Start dev server: `npm run dev`
2. Go to `http://localhost:3000`
3. Export a video
4. On success screen, you should see cloud buttons for configured services
5. Click a cloud button and follow OAuth flow
6. Check your cloud storage for the uploaded file

### Debug Mode
Enable console debugging:
```typescript
// In cloudStorageManager.ts, add:
console.log('[CloudStorage]', 'Attempting upload to', service);
console.log('[CloudStorage]', 'Upload result:', result);
```

---

## Troubleshooting Cloud Setup

### Cloud buttons don't appear
- ✅ Check `.env.local` has correct variable names
- ✅ Restart dev server after adding env vars
- ✅ Open browser DevTools → Console → check for warnings
- ✅ Verify `getAvailableCloudServices()` returns services

### OAuth callback URL errors
- ✅ Ensure redirect URI matches exactly (including `http://` vs `https://`)
- ✅ Check port number matches (3000 for dev, your domain for prod)
- ✅ URLs must be whitelisted in cloud service settings

### Upload fails with "Unauthorized"
- ✅ Verify OAuth token is still valid (some expire after 1 hour)
- ✅ Check API permissions are properly granted
- ✅ Ensure Client ID is not from the wrong environment

### No selection made in OAuth window
- ✅ OAuth window might be blocked by browser
- ✅ Check browser popup blocker settings
- ✅ Try incognito/private mode to test
- ✅ Some browsers require user gesture

### localStorage errors
- ✅ Browser privacy mode disables localStorage
- ✅ User may have cleared site data
- ✅ Check storage quota (usually 5-10MB)

---

## Production Deployment

### Before Going Live

1. **Update Environment Variables**
   ```bash
   # .env.production.local
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=prod-client-id
   NEXT_PUBLIC_AZURE_CLIENT_ID=prod-azure-id
   NEXT_PUBLIC_DROPBOX_CLIENT_ID=prod-dropbox-id
   ```

2. **Update OAuth Redirect URIs**
   - Google: `https://yourdomain.com/auth/callback`
   - Azure: `https://yourdomain.com/auth/callback`
   - Dropbox: `https://yourdomain.com/auth/callback`

3. **Test in Staging**
   ```bash
   npm run build
   npm start  # Test production build locally
   ```

4. **Enable Backend Token Exchange** (recommended)
   - Implement secure OAuth flow on backend
   - Never expose Client Secrets to frontend
   - Update `cloudStorageManager.ts` to call backend endpoint

5. **Monitor Upload Errors**
   - Set up error logging/tracking
   - Monitor cloud service API quotas
   - Track failed uploads for retry

---

## Costs

### Free Tier Usage
- **Google Drive**: 15 GB free, unlimited APIs
- **OneDrive**: 5 GB free, unlimited APIs  
- **Dropbox**: 2 GB free, 500 API calls/hour free tier

For most users, free tier is sufficient. No charges for API calls.

---

## Security Best Practices

1. **Never commit secrets**
   ```bash
   # .gitignore
   .env.local        # Local secrets
   .env.production   # Production secrets
   ```

2. **Use environment variables** for all credentials
   - Frontend: `NEXT_PUBLIC_*` (public, visible in browser)
   - Backend: Regular `*` (private, server-only)

3. **In production**, implement backend OAuth token exchange
   - Keeps Client Secret safe
   - Validates tokens before upload

4. **Scope permissions correctly**
   - Only request `Files.Modify` or equivalent
   - Don't request full account access

5. **Clear old tokens** from localStorage periodically
   - Tokens may expire
   - Old tokens increase security risk

---

## API Quotas & Rate Limits

| Service | Quota | Rate Limit |
|---------|-------|-----------|
| Google Drive | Unlimited | 1,000,000,000 queries/day per API |
| OneDrive | Unlimited | 4 requests per second per app |
| Dropbox | Service quota | 500 API calls/hour (free tier) |

For videos, you'll likely hit rate limits before quota limits.

---

## Additional Resources

- [Google Drive API Docs](https://developers.google.com/drive/api)
- [Microsoft Graph API Docs](https://docs.microsoft.com/en-us/graph/api/overview)
- [Dropbox API Docs](https://www.dropbox.com/developers/documentation)
- [OAuth 2.0 Spec](https://tools.ietf.org/html/rfc6749)

---

## Support

For cloud setup issues:
1. Check the troubleshooting section above
2. Verify environment variables are set correctly
3. Test with a simple file first (not video)
4. Check cloud service status page
5. Review cloud service documentation for your specific requirements
