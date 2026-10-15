# ClearPath app

Expo (SDK 57) app for ClearPath. See the [main README](../README.md) for what the project does and how the backend works.

## Run

```bash
npm install
cp .env.example .env    # set EXPO_PUBLIC_BACKEND_URL, e.g. http://192.168.1.20:8000
npx expo start
```

Open the QR code in Expo Go. The phone and the computer running the backend must be on the same network.

## Structure

- `screens/`: onboarding (accessibility profile, language, voice), home, camera
- `components/`: bounding-box overlay, traffic-light indicator, announcement banner, settings, demo video
- `utils/`: signal audio and speech, translations, themes, profile storage
- `assets/audio/`: recorded prompts for English, Spanish, Romanian and Mandarin
