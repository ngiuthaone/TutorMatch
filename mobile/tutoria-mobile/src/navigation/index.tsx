import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";

// Screen imports (will create these next)
import { CourseCatalogScreen } from "../screens/CourseCatalogScreen";
import { CourseDetailScreen } from "../screens/CourseDetailScreen";
import { CoursePlayerScreen } from "../screens/CoursePlayerScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { CreateCourseScreen } from "../screens/CreateCourseScreen";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

export function CourseTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;
          if (route.name === "Catalog") iconName = focused ? "ios-book" : "ios-book-outline";
          else if (route.name === "Search") iconName = focused ? "ios-search" : "ios-search-outline";
          else if (route.name === "Create") iconName = focused ? "ios-add-circle" : "ios-add-circle-outline";
          else if (route.name === "Profile") iconName = focused ? "ios-person" : "ios-person-outline";
          else iconName = "ios-help";
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: "#17181a",
        tabBarInactiveTintColor: "#73777d",
        tabBarStyle: {
          backgroundColor: "#fafafa",
          borderTopWidth: 1,
          borderTopColor: "#d9dadd",
          paddingBottom: 8,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Catalog" component={CourseCatalogScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Create" component={CreateCourseScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: "#fafafa", borderBottomWidth: 1, borderBottomColor: "#d9dadd" },
        headerTintColor: "#17181a",
        headerTitleStyle: { fontFamily: "InstrumentSans_700Bold", fontSize: 17 },
        headerBackTitleVisible: false,
      }}
    >
      <Stack.Screen name="Tabs" component={CourseTabs} options={{ headerShown: false }} />
      <Stack.Screen name="CourseDetail" component={CourseDetailScreen} options={{ title: "Course" }} />
      <Stack.Screen name="CoursePlayer" component={CoursePlayerScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CoursePreview" component={CoursePreviewScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

// CreateCourseScreen placeholder (will implement)
function CreateCourseScreen() {
  return <CourseCatalogScreen />;
}

// CoursePreviewScreen placeholder
function CoursePreviewScreen() {
  return <CourseDetailScreen />;
}
