import React, { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet, Image, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { colors, spacing, typography, radii } from "../theme";
import { getCatalogCourses } from "../../shared/api/client";
import type { CourseListing } from "../../shared/types/course";

export function CourseCatalogScreen() {
  const { data: courses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["catalog"],
    queryFn: getCatalogCourses,
  });

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    refetch().finally(() => setRefreshing(false));
  };

  if (isLoading && courses.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Discover Courses</Text>
        <Text style={styles.headerSubtitle}>{courses.length} courses available</Text>
      </View>

      <FlatList
        data={courses}
        keyExtractor={(item) => item.slug}
        renderItem={({ item }) => <CourseCard course={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="ios-book-outline" size={48} color={colors.silver} />
            <Text style={styles.emptyText}>No courses available</Text>
          </View>
        }
      />
    </View>
  );
}

function CourseCard({ course }: { course: CourseListing }) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        // Navigation will be added when navigation prop is available
        console.log("Navigate to", course.slug);
      }}
    >
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
  header: { padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { fontSize: 28, fontWeight: "700", color: colors.ink, fontFamily: typography.fonts.sansBold },
  headerSubtitle: { fontSize: 14, color: colors.muted, marginTop: 4, fontFamily: typography.fonts.sans },
  listContent: { padding: spacing.md, paddingBottom: 100 },
  card: { backgroundColor: colors.surface, borderRadius: radii.xl, overflow: "hidden", marginBottom: spacing.md, ...spacing.cardShadow },
  cardImage: { width: "100%", height: 160 },
  cardContent: { padding: spacing.md },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  cardCategory: { fontSize: 11, fontWeight: "600", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.5, fontFamily: typography.fonts.sansBold },
  cardPrice: { fontSize: 13, fontWeight: "700", color: colors.success, fontFamily: typography.fonts.sansBold },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.ink, lineHeight: 22, fontFamily: typography.fonts.sansBold, marginBottom: 8 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border },
  cardInstructor: { fontSize: 12, color: colors.muted, fontFamily: typography.fonts.sans },
  cardStats: { flexDirection: "row", gap: 12 },
  cardStat: { fontSize: 11, color: colors.muted, fontFamily: typography.fonts.mono },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: { alignItems: "center", padding: spacing.xxl },
  emptyText: { marginTop: spacing.md, fontSize: 16, color: colors.muted, fontFamily: typography.fonts.sans },
});
