import 'react-native-gesture-handler';
import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useFonts } from 'expo-font';
import {
  Lexend_400Regular,
  Lexend_600SemiBold,
  Lexend_700Bold,
} from '@expo-google-fonts/lexend';
import * as SplashScreen from 'expo-splash-screen';

import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import CameraScreen from './screens/CameraScreen';
import { AppProvider, AppContext } from './utils/AppContext';

const Stack = createStackNavigator();

const AppNavigator = () => {
  const { isLoaded, isOnboarded } = useContext(AppContext);

  if (!isLoaded) return null; // or a loading spinner

  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName={isOnboarded ? 'Home' : 'Onboarding'} 
        screenOptions={{ headerShown: false }}
      >
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Camera" component={CameraScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  SplashScreen.preventAutoHideAsync();

  const [fontsLoaded] = useFonts({
    Lexend_400Regular,
    Lexend_600SemiBold,
    Lexend_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  } else {
    SplashScreen.hideAsync();
  }

  return (
    <AppProvider>
      <AppNavigator />
    </AppProvider>
  );
}
