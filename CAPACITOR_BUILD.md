# Capacitor Android Build Guide

## Prerequisites

1. **Android Studio**: Download and install from [https://developer.android.com/studio](https://developer.android.com/studio)
2. **Java JDK**: JDK 17 or higher
3. **Android SDK**: Installed via Android Studio

## Environment Setup

1. Set JAVA_HOME environment variable:
   ```
   JAVA_HOME=C:\Program Files\Java\jdk-17
   ```

2. Add Android SDK to PATH:
   ```
   ANDROID_HOME=C:\Users\{YourUsername}\AppData\Local\Android\Sdk
   PATH=%PATH%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools
   ```

## Building APK

### Method 1: Using NPM Scripts (Recommended)

#### Debug APK
```bash
npm run build:apk
```
Output: `android/app/build/outputs/apk/debug/app-debug.apk`

#### Release APK
```bash
npm run build:apk:release
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

### Method 2: Using Android Studio

1. Open Android Studio
2. Run:
   ```bash
   npm run cap:open:android
   ```
3. In Android Studio: `Build > Build Bundle(s) / APK(s) > Build APK(s)`

### Method 3: Manual Commands

```bash
# Build web assets
npm run build

# Sync with Capacitor
npx cap sync android

# Build debug APK
cd android
gradlew assembleDebug

# Build release APK
cd android
gradlew assembleRelease
```

## Available Scripts

- `npm run cap:sync` - Build and sync web assets to native project
- `npm run cap:open:android` - Open project in Android Studio
- `npm run cap:run:android` - Build, sync, and run on connected device
- `npm run build:apk` - Build debug APK
- `npm run build:apk:release` - Build release APK

## Signing Release APK

For production releases, you need to sign your APK:

1. Generate keystore:
   ```bash
   keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Update `android/app/build.gradle`:
   ```gradle
   android {
       signingConfigs {
           release {
               storeFile file("path/to/my-release-key.keystore")
               storePassword "your-keystore-password"
               keyAlias "my-key-alias"
               keyPassword "your-key-password"
           }
       }
       buildTypes {
           release {
               signingConfig signingConfigs.release
           }
       }
   }
   ```

## Troubleshooting

### Gradle not found
Ensure Android Studio is installed and ANDROID_HOME is set correctly.

### Build fails
1. Check Java version: `java -version` (should be 17+)
2. Clean Gradle cache: `cd android && gradlew clean`
3. Rebuild: `gradlew assembleDebug`

### Assets not updated
Run `npm run cap:sync` to sync latest web build with Android project.

## Testing on Device

### Physical Device
1. Enable Developer Options and USB Debugging on your Android device
2. Connect via USB
3. Run: `npm run cap:run:android`

### Emulator
1. Create AVD in Android Studio
2. Start emulator
3. Run: `npm run cap:run:android`

## Notes

- Debug APKs are larger and slower than release builds
- Always test release builds before distribution
- Keep your keystore file secure for release builds
- The app requires Android 5.0 (API 21) or higher
