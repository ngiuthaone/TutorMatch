import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppStack } from "./src/navigation";
import { useFonts } from "expo-font";
import { SplashScreen } from "expo-splash-screen";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
});

export default function App() {
  const [fontsLoaded] = useFonts({
    "InstrumentSans_400Regular": require("./assets/fonts/InstrumentSans-Regular.ttf"),
    "InstrumentSans_500Medium": require("./assets/fonts/InstrumentSans-Medium.ttf"),
    "InstrumentSans_600SemiBold": require("./src/assets/fonts/InstrumentSans-SemiBold.ttf"),
    "InstrumentSans_700Bold": require("./assets/fonts/InstrumentSans-Bold.ttf"),
    "DMMono_400Regular": require("./assets/fonts/DMMono-Regular.ttf"),
    "DMMono_500Medium": require("./assets/fonts/DMMono-Medium.ttf"),
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#17181a" />
      </View>
    );
  }

  React.useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <AppStack />
        </NavigationContainer>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#e9ebed" },
});
