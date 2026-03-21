# ClearPath - Accessible Driving Assistant

ClearPath is an accessible driving assistant for colorblind and elderly users. It provides real-time traffic light detection, sign detection, and hazard warnings using high-contrast visual indicators and text-to-speech announcements.

This app is built with the **React Native Expo Managed Workflow** and is designed to run directly in the **Expo Go** app on iOS without any custom native builds.

## Setup Instructions

1. **Install Dependencies**:
   If you haven't already, install the Node modules:
   ```bash
   npm install
   ```

2. **Configure the Backend IP**:
   - Open `App.js`.
   - Find the configuration section at the top of the file:
     ```javascript
     const BACKEND_IP = '192.168.1.100'; // FIXME: Replace with actual IP
     ```
   - Replace `192.168.1.100` with the actual IP address of the laptop running the FastAPI backend. You can find this by running `ipconfig` (Windows) or `ifconfig` (Mac) in the terminal (look for the `en0` IPv4 address).
   - **Important**: Both your phone and the laptop must be on the same WiFi network.

3. **Start the App**:
   Run the Expo development server:
   ```bash
   npx expo start
   ```

4. **Run on your Phone**:
   - Download the **Expo Go** app from the iOS App Store.
   - Open the Camera app on your iPhone and scan the QR code displayed in your terminal (or browser).
   - Tap the prompt to open the project in Expo Go.

## Component Structure

The app's UI is cleanly separated into specialized components:
- `App.js`: Main state orchestrator, Camera feed, and AppState manager.
- `components/BoundingBoxOverlay.js`: Renders SVG rectangles for recognized objects.
- `components/ToggleStrip.js`: Right-aligned controls to toggle features.
- `components/TrafficLightIndicator.js`: High-visibility pill for traffic light status.
- `components/AnnouncementBanner.js`: Primary feedback banner for high-priority alerts.
- `utils/WebSocketManager.js`: Handles backend connection, reconnects, and parsing.
- `utils/SpeechHandler.js`: Wraps `expo-speech` to queue accessible voice announcements.

## Troubleshooting

- **"Reconnecting..." Badge**: This means the WebSocket cannot reach your FastAPI backend. Ensure you updated the IP in `App.js` and that both devices are on the same WiFi.
- **Audio Overlap**: The text-to-speech logic prevents overlapping by employing a simple queuing mechanism in `SpeechHandler.js`.
- **Performance**: The app captures frames every 500ms at `quality: 0.3` to minimize payload sizes and prevent WebSocket bottlenecks.

## Onboarding & Profiles

The app now includes a built-in onboarding flow that customizes the UI based on user needs (e.g., larger fonts for elderly users, shape indicators for colorblind users). Profiles and preferences can be updated via the Settings Modal on the Home screen.

**Note for Developers:** To retest the onboarding flow during development, you can call `clearProfile()` from `utils/ProfileStorage.js` to clear the persisted `AsyncStorage` values and re-trigger the onboarding screens on the next app load.
