import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Dimensions, Image, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Video } from "expo-av";
import { colors, spacing, typography, radii } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface Props {
  route: { params: { slug: string; section?: number; lesson?: number } };
  navigation: any;
}

export function CoursePlayerScreen({ route, navigation }: Props) {
  const { slug, section = 0, lesson = 0 } = route.params;
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<Video>(null);
  const controlsTimeout = useRef<NodeJS.Timeout>();

  // Mock curriculum data - in real app would come from course context
  const mockCurriculum = [
    { title: "Web foundations", lessons: ["How the web works", "Semantic HTML", "Accessible forms", "Project: personal profile"] },
    { title: "Responsive CSS", lessons: ["The cascade and layout", "Flexbox and Grid", "Responsive type and media", "Project: editorial landing page"] },
  ];
  const currentSection = mockCurriculum[section] || mockCurriculum[0];
  const currentLesson = currentSection.lessons[lesson] || currentSection.lessons[0];
  const totalLessons = mockCurriculum.reduce((t, s) => t + s.lessons.length, 0);
  const currentLessonIndex = mockCurriculum.slice(0, section).reduce((t, s) => t + s.lessons.length, 0) + lesson;

  useEffect(() => {
    const timeout = setTimeout(() => setShowControls(false), 3000);
    controlsTimeout.current = timeout;
    return () => clearTimeout(timeout);
  }, [isPlaying]);

  const togglePlay = () => setIsPlaying((p) => !p);
  const goToNext = () => {
    if (lesson < (currentSection.lessons.length - 1)) {
      navigation.navigate("CoursePlayer", { slug, section, lesson: lesson + 1 });
    } else if (section < (mockCurriculum.length - 1)) {
      navigation.navigate("CoursePlayer", { slug, section: section + 1, lesson: 0 });
    }
  };
  const goToPrev = () => {
    if (lesson > 0) {
      navigation.navigate("CoursePlayer", { slug, section, lesson: lesson - 1 });
    } else if (section > 0) {
      const prevSection = mockCurriculum[section - 1];
      navigation.navigate("CoursePlayer", { slug, section: section - 1, lesson: prevSection.lessons.length - 1 });
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View
        style={[
          styles.controlsOverlay,
          { opacity: showControls ? 1 : 0 }
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="ios-arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.topInfo}>
          <Text style={styles.lessonLabel}>Lesson {currentLessonIndex + 1} of {totalLessons}</Text>
          <Text style={styles.lessonTitle}>{currentLesson}</Text>
        </View>
      </Animated.View>

      <Video
        ref={videoRef}
        source={{ uri: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" }}
        style={styles.video}
        useNativeControls={false}
        resizeMode="contain"
        shouldPlay={isPlaying}
        isLooping={false}
        onLoad={(data) => { setDuration(data.duration); }}
        onProgress={(data) => { setProgress(data.position); }}
        onPlaybackStatusUpdate={(status) => { if (status.didJustFinish) setIsPlaying(false); }}
      />

      <Animated.View
        style={[
          styles.bottomControls,
          { opacity: showControls ? 1 : 0 }
        ]}
      >
        <View style={styles.progressContainer}>
          <Text style={styles.timeText}>{formatTime(progress / 1000)}</Text>
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { width: `${Math.min((progress / 1000) / (duration / 1000) * 100, 100)}%` }]} />
          </View>
          <Text style={styles.timeText}>{formatTime(duration / 1000)}</Text>
        </View>
        <View style={styles.controlButtons}>
          <TouchableOpacity onPress={goToPrev} style={styles.controlButton}><Ionicons name="ios-skip-backward" size={32} color="#fff" /></TouchableOpacity>
          <TouchableOpacity onPress={togglePlay} style={[styles.controlButton, styles.playButton]}><Ionicons name={isPlaying ? "ios-pause" : "ios-play"} size={40} color="#fff" /></TouchableOpacity>
          <TouchableOpacity onPress={goToNext} style={styles.controlButton}><Ionicons name="ios-skip-forward" size={32} color="#fff" /></TouchableOpacity>
        </View>
      </Animated.View>

      <TouchableOpacity onPress={() => setShowControls((p) => !p)} style={StyleSheet.absoluteFill} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  video: { flex: 1, backgroundColor: "#000" },
  controlsOverlay: { position: "absolute", top: 0, left: 0, right: 0, paddingTop: 50, paddingHorizontal: spacing.md, zIndex: 10 },
  backButton: { marginBottom: spacing.sm },
  topInfo: {},
  lessonLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: typography.fonts.mono, textTransform: "uppercase" },
  lessonTitle: { fontSize: 18, fontWeight: "700", color: "#fff", fontFamily: typography.fonts.sansBold, marginTop: 2 },
  bottomControls: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: 40 },
  progressContainer: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md },
  timeText: { fontSize: 12, color: "rgba(255,255,255,0.8)", fontFamily: typography.fonts.mono, minWidth: 40 },
  progressBar: { flex: 1, height: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#fff", borderRadius: 2 },
  controlButtons: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 32 },
  controlButton: { padding: 8 },
  playButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },
});
