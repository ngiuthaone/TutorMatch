import React from "react";
import { View, Text, StyleSheet, SearchBar, FlatList, ActivityIndicator, TouchableOpacity, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, typography, radii } from "../theme";
import { getCatalogCourses } from "../../shared/api/client";
import type { CourseListing } from "../../shared/types/course";

export function SearchScreen() {
  const { data: courses = [], isLoading } = useQuery({ queryKey: ["catalog"], queryFn: getCatalogCourses });
  const [query, setQuery] = React.useState("");

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()) ||
    c.instructor.toLowerCase().includes(query.toLowerCase()) ||
    c.category.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <SearchBar
          placeholder="Search courses..."
          value={query}
          onChangeText={setQuery}
          lightTheme={false}
          inputStyle={{ backgroundColor: "#fff", borderRadius: radii.lg }}
        />
      </View>
      {isLoading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.slug}
          renderItem={({ item }) => <CourseCard course={item} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="ios-search-outline" size={48} color={colors.silver} />
              <Text style={styles.emptyText}>{query ? "No courses match your search" : "Start searching to discover courses"}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

function CourseCard({ course }: { course: CourseListing }) {
  return (
    <TouchableOpacity style={styles.card}>
      <Image source={{ uri: course.image }} style={styles.cardImage} resizeMode="cover" />
      <View style={styles.cardContent}>
        <View style={styles.cardMeta}>
          <Text style={styles.cardCategory}>{course.category}</Text>
          <Text style={styles.cardPrice}>{course.price}</Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={2}>{course.title}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardInstructor}>{course.instructor}</Text>
          <View style={styles.cardStats}>
            <Text style={styles.cardStat}><Ionicons name="ios-star" size={12} color={colors.warning} /> {course.rating}</Text>
            <Text style={styles.cardStat}><Ionicons name="ios-people" size={12} color={colors.muted} /> {course.students.toLocaleString()}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchContainer: { padding: spacing.md },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, overflow: "hidden", marginBottom: spacing.md, ...{ shadowColor: "#090a0c", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.035, shadowRadius: 18, elevation: 3 } },
  cardImage: { width: "100%", height: 160 },
  cardContent: { padding: spacing.md },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardCategory: { fontSize: 11, fontWeight: "600", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: "InstrumentSans_700Bold" },
  cardPrice: { fontSize: 13, fontWeight: "700", color: colors.success, fontFamily: "InstrumentSans_700Bold" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, lineHeight: 22, fontFamily: "InstrumentSans_700Bold", marginBottom: 8 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: "#d9dadd" },
  cardInstructor: { fontSize: 12, color: colors.muted, fontFamily: "InstrumentSans_500Medium" },
  cardStats: { flexDirection: "row", gap: 12 },
  cardStat: { fontSize: 11, color: colors.muted, fontFamily: "DMMono_400Regular" },
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontSize: 16, color: colors.muted, fontFamily: "InstrumentSans_500Medium" },
});
