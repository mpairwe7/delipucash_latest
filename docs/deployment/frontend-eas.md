# Frontend — EAS Build & Submit

The React Native mobile app is built using Expo Application Services (EAS) and distributed via the Google Play Store and Apple App Store.

## Table of Contents

- [EAS Configuration](#eas-configuration)
- [Build Profiles](#build-profiles)
- [Android Build](#android-build)
- [iOS Build](#ios-build)
- [App Configuration](#app-configuration)
- [Plugins & Permissions](#plugins--permissions)
- [Deep Linking](#deep-linking)
- [Building](#building)
- [Submitting to Stores](#submitting-to-stores)
- [Troubleshooting](#troubleshooting)

## EAS Configuration

**File:** `DelipuCash/eas.json`

```json
{
  "cli": {
    "version": ">= 16.31.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": { "NODE_ENV": "development" }
    },
    "preview": {
      "distribution": "internal",
      "env": { "NODE_ENV": "production" }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "NODE_ENV": "production",
        "GRADLE_OPTS": "-Xmx4096m -XX:MaxMetaspaceSize=512m",
        "ORG_GRADLE_PROJECT_lintOptions": "checkReleaseBuilds=false"
      },
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease -x lint -x lintVitalAnalyzeRelease -x lintVitalRelease"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### Key Settings

| Setting | Value | Purpose |
|---------|-------|---------|
| `appVersionSource` | `remote` | EAS manages version numbers remotely |
| `autoIncrement` | `true` | Auto-increments `versionCode` / build number on each production build |
| `GRADLE_OPTS` | `-Xmx4096m` | Allocates 4 GB heap to Gradle (prevents OOM on EAS cloud) |

## Build Profiles

| Profile | Use Case | Distribution | Dev Client |
|---------|----------|-------------|------------|
| `development` | Local development with Expo dev tools | Internal (team only) | Yes |
| `preview` | Internal testing / QA | Internal (team only) | No |
| `production` | Store release | Public (APK/IPA) | No |

## Android Build

### Configuration

From `app.json`:

```json
{
  "android": {
    "adaptiveIcon": {
      "foregroundImage": "./assets/images/adaptive-icon.png",
      "backgroundColor": "#ffffff"
    },
    "package": "com.arolainc.DelipuCash",
    "versionCode": 1,
    "permissions": [
      "CAMERA", "RECORD_AUDIO", "READ_MEDIA_IMAGES",
      "READ_MEDIA_VIDEO", "READ_MEDIA_AUDIO",
      "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"
    ]
  }
}
```

### Build Properties

Set via `expo-build-properties` plugin:

| Property | Value |
|----------|-------|
| `minSdkVersion` | 24 (Android 7.0) |
| `targetSdkVersion` | 35 (Android 15) |
| `compileSdkVersion` | 35 |
| `newArchEnabled` | true |

### Gradle Optimization

Production builds skip lint to reduce build time:

```
:app:assembleRelease -x lint -x lintVitalAnalyzeRelease -x lintVitalRelease
```

### Build Command

```bash
# Development (with dev client)
eas build --platform android --profile development

# Preview (internal testing)
eas build --platform android --profile preview

# Production APK
eas build --platform android --profile production
```

## iOS Build

### Configuration

From `app.json`:

```json
{
  "ios": {
    "supportsTablet": true,
    "bundleIdentifier": "com.arolainc.DelipuCash",
    "infoPlist": {
      "NSCameraUsageDescription": "Allow camera access to record videos and capture photos",
      "NSMicrophoneUsageDescription": "Allow microphone access to record audio for videos",
      "NSPhotoLibraryUsageDescription": "Allow access to your photo library to select videos and images",
      "NSLocationWhenInUseUsageDescription": "Allow location access for personalized content"
    }
  }
}
```

### Build Properties

| Property | Value |
|----------|-------|
| `deploymentTarget` | 15.1 |
| `newArchEnabled` | true |

### Build Command

```bash
# Development
eas build --platform ios --profile development

# Production
eas build --platform ios --profile production
```

## App Configuration

**File:** `DelipuCash/app.json`

| Field | Value |
|-------|-------|
| Name | DelipuCash |
| Slug | DelipuCash |
| Version | 1.0.0 |
| Scheme | delipucash |
| Orientation | portrait |
| New Architecture | Enabled |
| React Compiler | Enabled |
| EAS Project ID | `3d907cc1-a01f-435d-b9f4-7cfd7d9ef7c5` |

## Plugins & Permissions

Plugins configured in `app.json`:

| Plugin | Purpose |
|--------|---------|
| `expo-router` | File-based routing (`app/` directory) |
| `expo-splash-screen` | Splash screen with custom image and colors |
| `expo-audio` | Audio playback |
| `expo-build-properties` | Native build configuration (SDK versions, arch) |
| `expo-location` | Location services |
| `expo-video` | Video playback |
| `expo-camera` | Camera access for recording |
| `expo-document-picker` | File selection |
| `expo-image-picker` | Image/video selection from gallery |
| `expo-media-library` | Media library access |
| `expo-screen-orientation` | Screen orientation lock |
| `expo-asset` | Asset bundling |

## Deep Linking

### iOS Universal Links

Configured in `app.json` under `ios.associatedDomains`:

```json
["applinks:delipucashserver.vercel.app"]
```

The backend serves `/.well-known/apple-app-site-association` for iOS verification.

### Android App Links

Configured in `app.json` under `android.intentFilters`:

```json
[{
  "action": "VIEW",
  "autoVerify": true,
  "data": [{
    "scheme": "https",
    "host": "delipucashserver.vercel.app",
    "pathPrefix": "/"
  }],
  "category": ["BROWSABLE", "DEFAULT"]
}]
```

The backend serves `/.well-known/assetlinks.json` for Android verification.

### Custom Scheme

The `delipucash://` scheme is registered for in-app navigation:

```
delipucash://questions/123
delipucash://videos/456
delipucash://reset-password?token=abc
```

## Building

### Prerequisites

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Login to Expo account
eas login

# Verify project configuration
eas build:configure
```

### Build Commands

```bash
# Android APK (production)
cd DelipuCash
eas build --platform android --profile production

# iOS (production)
eas build --platform ios --profile production

# Both platforms
eas build --platform all --profile production
```

### Build Output

| Profile | Android Output | iOS Output |
|---------|---------------|------------|
| development | `.apk` (dev client) | `.app` (simulator) |
| preview | `.apk` | `.ipa` (ad-hoc) |
| production | `.apk` | `.ipa` (store) |

## Submitting to Stores

### Google Play Store

```bash
eas submit --platform android --profile production
```

Requires a Google Play service account key configured in EAS.

### Apple App Store

```bash
eas submit --platform ios --profile production
```

Requires Apple Developer account credentials configured in EAS.

### Combined

```bash
eas submit --platform all --profile production
```

## Troubleshooting

### Common Build Failures

**Gradle OOM (Android)**
- The `GRADLE_OPTS: "-Xmx4096m"` setting in `eas.json` allocates 4 GB heap
- If builds still fail, increase to `-Xmx6144m`

**Lint failures (Android)**
- Production profile skips lint: `-x lint -x lintVitalAnalyzeRelease`
- For preview builds, fix lint issues or add the same skip flags

**Pod install failures (iOS)**
- Clear EAS cache: `eas build --clear-cache --platform ios`
- Ensure `deploymentTarget: "15.1"` matches Podfile

**Missing environment variables**
- Frontend only reads `EXPO_PUBLIC_*` variables at build time
- Set via `eas secret:create` for sensitive values
- Or in `eas.json` `env` block for non-sensitive values

**Large APK size**
- Enable Hermes (default in Expo SDK 54)
- Check for unused dependencies in `package.json`
- Use `npx expo-doctor` to identify issues

### Checking Build Status

```bash
# List recent builds
eas build:list

# View specific build logs
eas build:view <build-id>
```
