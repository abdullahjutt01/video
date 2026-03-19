# Video Export & Save Functionality Guide

## Overview

The video editor now includes comprehensive save and export functionality, allowing users to save their edited videos to multiple destinations with device-specific options.

## Save Destinations

### 1. **Local Device Downloads**
- **Device**: All (Desktop, Mobile, Tablet)
- **Method**: HTML5 `<a>` element with download attribute
- **File Storage**: User's Downloads folder
- **Browser Support**: Universal (all modern browsers)
- **UI Button**: ⬇️ Download to Device

### 2. **Device Gallery (Mobile/Tablet)**
- **Device**: Mobile & Tablet only
- **Method**: File System Access API (with fallback to download)
- **APIs Used**:
  - `showSaveFilePicker()` - Choose save location
  - Fallback: `showDirectoryPicker()` + `getFileHandle()`
- **Supported Browsers**:
  - Chrome 86+
  - Edge 86+
  - Opera 72+
  - Not supported on Safari/iOS
- **UI Button**: 📸 Gallery (Mobile/Tablet only)
- **Code Location**: `src/utils/saveManager.ts` - `saveToDeviceGallery()`

### 3. **Web Share API (Mobile)**
- **Device**: Mobile & Tablet (if supported)
- **Method**: Native share sheet
- **Allows Sharing To**:
  - Email
  - Messages
  - Social media (WhatsApp, Telegram, etc.)
  - Cloud services (Drive, OneDrive, etc.)
- **Browser Support**:
  - Android Chrome, Firefox
  - Not available on desktop unless supported by website
- **UI Button**: 📤 Share (Mobile only)
- **Code Location**: `src/utils/saveManager.ts` - `shareVideo()`

### 4. **Cloud Storage Integration**
- **Services**: Google Drive, OneDrive, Dropbox
- **Method**: OAuth 2.0 authentication + REST API upload
- **Features**:
  - Automatic authentication flow
  - Upload progress tracking
  - File metadata saved
  - Previous uploads history
- **UI Buttons**: ☁️ Google Drive, ☁️ OneDrive, ☁️ Dropbox
- **Requires**: Backend OAuth setup (environment variables)
- **Code Location**: `src/utils/cloudStorageManager.ts`

### 5. **Clipboard/Link Sharing**
- **Device**: All
- **Method**: Copy download URL to clipboard
- **Use Case**: Share with others via chat/email
- **Browser Support**: All modern browsers
- **UI Button**: 📋 Copy Link
- **Code Location**: `src/utils/saveManager.ts` - `copyToClipboard()`

### 6. **Browser Storage (History)**
- **Device**: All
- **Method**: localStorage with manual persistence
- **Features**:
  - Track recently exported videos
  - Quick re-download links
  - Metadata stored (filename, timestamp, export method)
- **Storage Limit**: 5-10 MB per domain
- **Code Location**: `src/utils/saveManager.ts` - `saveToLocalStorage()`, `getSavedVideos()`

## Implementation Files

### Core Modules

#### 1. `src/utils/saveManager.ts` (230 lines)
**Purpose**: Unified interface for all save methods

**Exported Functions**:
```typescript
downloadFile(url: string, filename: string): void
  → Standard browser download via anchor element

saveToDeviceGallery(url: string, filename: string): Promise<boolean>
  → File System Access API integration with fallback

shareVideo(file: File): Promise<void>
  → Web Share API with error handling

copyToClipboard(text: string): Promise<void>
  → Get text to user's clipboard

saveToLocalStorage(url: string, filename: string, method: string): void
  → Save metadata to browser history

getSavedVideos(): SavedVideo[]
  → Retrieve saved export history

getDeviceType(): 'mobile' | 'tablet' | 'desktop'
  → Detect device capabilities

checkGalleryPermission(): Promise<boolean>
  → Verify File System Access API support
```

#### 2. `src/utils/cloudStorageManager.ts` (237 lines)
**Purpose**: Cloud service integrations (Google Drive, OneDrive, Dropbox)

**Exported Functions**:
```typescript
initializeCloudAuth(service: string): Promise<string | null>
  → OAuth 2.0 authentication flow

uploadToCloud(service: string, blob: Blob, filename: string, token: string): Promise<CloudUploadResult>
  → Upload blob to cloud service

isCloudServiceAvailable(service: string): boolean
  → Check if service is configured

getAvailableCloudServices(): Array<{ id: string; name: string }>
  → Get list of enabled cloud services

saveCloudUpload(service: string, result: CloudUploadResult): void
  → Save upload metadata to localStorage

getCloudUploads(): CloudUploadResult[]
  → Retrieve cloud upload history
```

#### 3. `src/components/panels/ExportModal.tsx` (Enhanced)
**Changes Made**:
- Added device type detection
- Added save manager imports
- Enhanced export success screen with:
  - Mobile-specific gallery button
  - Web share button for mobile
  - Copy link button (all devices)
  - Cloud storage upload buttons
  - Recent exports history display
- Added state tracking for:
  - `deviceType`: Device capabilities
  - `savedVideos`: Recent exports
  - `availableCloudServices`: Enabled cloud services
  - `cloudUploading`: Upload progress state

## Device-Specific Behavior

### Desktop
- ✅ Download button (PNG/WebM)
- ✅ Copy link button
- ✅ Cloud storage buttons (if configured)
- ✅ Recent exports history
- ❌ Gallery button (not applicable)
- ❌ Share button (limited browser support)

### Mobile (iOS/Android)
- ✅ Download button
- ✅ Gallery save (Android Firefox, Chrome)
- ✅ Web share (native share sheet)
- ✅ Copy link
- ✅ Cloud storage (if Auth tokens available)
- ✅ Recent exports history

### Tablet
- ✅ Download button
- ✅ Gallery save (if supported)
- ✅ Web share (if supported)
- ✅ Copy link
- ✅ Cloud storage buttons
- ✅ Recent exports history

## Browser Compatibility Matrix

| Feature | Chrome | Firefox | Safari | Edge | Opera |
|---------|--------|---------|--------|------|-------|
| Download | ✅ | ✅ | ✅ | ✅ | ✅ |
| Gallery Save (Mobile) | ✅ | ✅ | ❌ | ✅ | ✅ |
| Web Share | ✅ | ✅ | ❌ | ✅ | ✅ |
| Cloud Storage | ✅ | ✅ | ✅ | ✅ | ✅ |
| Clipboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| localStorage | ✅ | ✅ | ✅ | ✅ | ✅ |

## Configuration

### Environment Variables (Optional - for Cloud Storage)

Create or update `.env.local`:
```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
NEXT_PUBLIC_AZURE_CLIENT_ID=your-azure-client-id
NEXT_PUBLIC_DROPBOX_CLIENT_ID=your-dropbox-client-id
```

### Note
Without these environment variables:
- Cloud buttons will not appear
- Download, gallery, share, and clipboard features work normally
- No backend integration required

## User Workflow

### Typical Desktop User Flow
1. Edit video in timeline
2. Click "Export"
3. Select quality (Draft, High, 4K)
4. Click "Export to MP4"
5. Wait for encoding
6. Success screen shows:
   - ⬇️ Download button
   - 📋 Copy link
   - ☁️ Cloud storage buttons (if available)
   - Recent exports list

### Typical Mobile User Flow
1. Edit video in timeline
2. Click "Export"
3. Select quality
4. Click "Export to MP4"
5. Success screen shows:
   - ⬇️ Download button
   - 📸 Gallery (save to Photos)
   - 📤 Share (WhatsApp, Telegram, etc.)
   - 📋 Copy link
   - Recent exports list

## Technical Details

### File Size Limits
- **Browser Download**: No limit (streaming)
- **Device Gallery**: Device storage capacity
- **Cloud Upload**: Service-specific (usually 5GB-1TB per account)
- **localStorage**: 5-10 MB per domain

### Memory Management
- Download links are automatically revoked after closure
- localStorage metadata kept to last 20 uploads
- Cloud upload metadata kept to last 20 uploads
- Blob URLs cleaned up after document unload

### Security Considerations
- File System Access requires user permission
- Web Share requires user gesture (click)
- Cloud auth requires OAuth consent
- All operations are user-initiated
- No automatic uploads to cloud

## Testing Checklist

### Desktop Testing
- [ ] Download button downloads MP4
- [ ] Copy link copies valid URL
- [ ] Cloud buttons appear when configured
- [ ] Recent exports shows previous videos
- [ ] Memory monitor active during export

### Mobile Testing (Android)
- [ ] Download saves to Downloads
- [ ] Gallery button offers to save to Photos
- [ ] Share opens native share sheet
- [ ] Works offline (download resumes)
- [ ] Permissions properly requested

### Mobile Testing (iOS)
- [ ] Download saves to Files app
- [ ] Gallery save fails gracefully (not supported)
- [ ] Share opens native sheet
- [ ] Copy link works
- [ ] Recent exports available

### Cloud Testing (if configured)
- [ ] Google Drive OAuth flow works
- [ ] File uploads to Drive successfully
- [ ] OneDrive OAuth and upload works
- [ ] Dropbox OAuth and upload works
- [ ] Recent uploads tracked in localStorage
- [ ] Upload errors handled gracefully

## Troubleshooting

### Issue: Download button doesn't work
**Solution**: Check browser permissions for downloads, check storage space

### Issue: Gallery button missing on mobile
**Solution**: 
- Not all browsers support File System Access API
- Fallback to Download still works
- Try Chrome/Firefox on Android

### Issue: Share button is disabled
**Solution**: 
- Web Share API requires user gesture
- Not available on all browsers
- Use Copy link as fallback

### Issue: Cloud upload fails
**Solution**:
- Verify OAuth tokens are valid
- Check network connectivity
- Ensure backend is configured
- Check file size limits

### Issue: Recent exports not showing
**Solution**:
- Enable localStorage in browser
- Clear browser cache and try again
- Check if videos were saved using saveToLocalStorage()

## Performance Optimization

### Best Practices
1. **For large videos**: Use Gallery save instead of Download on mobile
2. **For cloud storage**: Compress videos before export
3. **For sharing**: Use Web Share API instead of Copy link
4. **For history**: Clear old exports from localStorage periodically

### Memory Monitoring
- Export modal monitors JS heap size
- Warnings at 85% memory usage
- Automatic cleanup during export
- Blob URLs revoked after closure

## Future Enhancements

### Planned Features
- [ ] Batch export support
- [ ] Background upload to cloud
- [ ] Export presets/templates
- [ ] Social media direct upload (TikTok, Instagram API)
- [ ] Email delivery integration
- [ ] Scheduled exports
- [ ] Resume interrupted uploads

### Possible Integrations
- YouTube direct upload API
- TikTok Business API
- Instagram Business API
- AWS S3 storage
- Cloudinary media optimization

## API Reference

### SaveManager

```typescript
// Download to device
downloadFile(url: string, filename: string): void

// Save using File System Access API
saveToDeviceGallery(url: string, filename: string): Promise<boolean>

// Native share (mobile)
shareVideo(file: File): Promise<void>

// Copy URL to clipboard
copyToClipboard(text: string): Promise<void>

// Save to browser history
saveToLocalStorage(
  url: string,
  filename: string,
  method: string
): void

// Get recent exports
getSavedVideos(): SavedVideo[]

// Clear all saved videos
clearSavedVideos(): void

// Detect device type
getDeviceType(): 'mobile' | 'tablet' | 'desktop'

// Check gallery permission availability
checkGalleryPermission(): Promise<boolean>
```

### CloudStorageManager

```typescript
// Initialize OAuth flow
initializeCloudAuth(service: string): Promise<string | null>

// Upload blob to cloud
uploadToCloud(
  service: string,
  blob: Blob,
  filename: string,
  token: string
): Promise<CloudUploadResult>

// Check if service available
isCloudServiceAvailable(service: string): boolean

// Get enabled cloud services
getAvailableCloudServices(): Array<{ id: string; name: string }>

// Save upload metadata
saveCloudUpload(service: string, result: CloudUploadResult): void

// Get upload history
getCloudUploads(): CloudUploadResult[]
```

## Support

For issues or questions about save/gallery functionality:
1. Check browser console for errors
2. Verify environment variables (for cloud services)
3. Check device permissions
4. Review troubleshooting section
5. Test in different browsers
