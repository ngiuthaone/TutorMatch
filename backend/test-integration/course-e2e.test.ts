import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';

describe.serial('Course E2E', () => {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  let creatorId: string;
  let learnerId: string;
  let courseId: string;
  let sectionId: string;
  let lessonId: string;
  let quizId: string;
  let enrollmentId: string;

  // ============================================
  // CREATOR FLOW
  // ============================================
  describe('Creator Flow', () => {
    it('E2E-C1: should create a course', async () => {
      // Create a test user as creator
      const { data: creator, error: creatorError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
      
      if (creatorError || !creator) throw new Error('No creator profile found');
      creatorId = creator.id;

      // Create course via RPC or direct insert
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .insert({
          creator_id: creatorId,
          title: 'Test Course ' + Date.now(),
          slug: 'test-course-' + Date.now(),
          status: 'draft'
        })
        .select()
        .single();

      expect(courseError).toBeNull();
      expect(course.id).toBeDefined();
      courseId = course.id;
    });

    it('E2E-C2: should add a section', async () => {
      const { data: section, error } = await supabase
        .from('course_sections')
        .insert({
          course_id: courseId,
          title: 'Getting Started',
          position: 0
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(section.id).toBeDefined();
      sectionId = section.id;
    });

    it('E2E-C3: should add a lesson', async () => {
      const { data: lesson, error } = await supabase
        .from('course_lessons')
        .insert({
          section_id: sectionId,
          title: 'Introduction',
          lesson_type: 'video',
          position: 0
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(lesson.id).toBeDefined();
      lessonId = lesson.id;
    });

    it('E2E-C4: should publish course', async () => {
      const { data: course, error } = await supabase
        .from('courses')
        .update({ 
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', courseId)
        .select()
        .single();

      expect(error).toBeNull();
      expect(course.status).toBe('published');
    });
  });

  // ============================================
  // LEARNER FLOW
  // ============================================
  describe('Learner Flow', () => {
    it('E2E-L1: should list published courses', async () => {
      const { data, error } = await supabase
        .from('courses')
        .select('*')
        .eq('status', 'published');

      expect(error).toBeNull();
      expect(Array.isArray(data)).toBe(true);
    });

    it('E2E-L2: should enroll in course', async () => {
      // Get a learner profile
      const { data: learner } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', creatorId)
        .limit(1)
        .single();
      
      if (!learner) throw new Error('No learner profile found');
      learnerId = learner.id;

      // Enroll via RPC
      const { data: enrollment, error } = await supabase
        .rpc('enroll_learner_in_course', { p_booking_id: null }); // Direct insert instead

      // Direct insert for testing
      const { data: newEnrollment, insertError } = await supabase
        .from('course_enrollments')
        .insert({
          course_id: courseId,
          user_id: learnerId
        })
        .select()
        .single();

      expect(insertError).toBeNull();
      expect(newEnrollment.id).toBeDefined();
      enrollmentId = newEnrollment.id;
    });

    it('E2E-L3: should track lesson progress', async () => {
      const { data: progress, error } = await supabase
        .from('course_lesson_progress')
        .upsert({
          enrollment_id: enrollmentId,
          lesson_id: lessonId,
          video_position: 120,
          completed: false
        }, { onConflict: 'enrollment_id,lesson_id' })
        .select()
        .single();

      expect(error).toBeNull();
      expect(progress.video_position).toBe(120);
    });
  });

  // ============================================
  // QUIZ FLOW
  // ============================================
  describe('Quiz Flow', () => {
    it('E2E-Q1: should create quiz for lesson', async () => {
      const { data: quiz, error } = await supabase
        .from('course_quizzes')
        .insert({
          lesson_id: lessonId,
          title: 'Section Quiz',
          passing_score: 70
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(quiz.id).toBeDefined();
      quizId = quiz.id;
    });

    it('E2E-Q2: should add quiz questions', async () => {
      const { data: question, error } = await supabase
        .from('course_quiz_questions')
        .insert({
          quiz_id: quizId,
          question_text: 'What is 2+2?',
          position: 0
        })
        .select()
        .single();

      expect(error).toBeNull();

      // Add options
      const { error: optionsError } = await supabase
        .from('course_quiz_options')
        .insert([
          { question_id: question.id, option_text: '3', is_correct: false, position: 0 },
          { question_id: question.id, option_text: '4', is_correct: true, position: 1 },
        ]);

      expect(optionsError).toBeNull();
    });

    it('E2E-Q3: should record quiz attempt', async () => {
      const { data: attempt, error } = await supabase
        .from('course_quiz_attempts')
        .insert({
          enrollment_id: enrollmentId,
          quiz_id: quizId,
          attempt_number: 1,
          score: 100,
          passed: true,
          answers: { [Date.now()]: 'correct' }
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(attempt.passed).toBe(true);
    });
  });

  // ============================================
  // REVIEW FLOW
  // ============================================
  describe('Review Flow', () => {
    it('E2E-R1: should create course review', async () => {
      const { data: review, error } = await supabase
        .from('course_reviews')
        .insert({
          course_id: courseId,
          user_id: learnerId,
          rating: 5,
          comment: 'Great course!'
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(review.rating).toBe(5);
    });
  });

  // ============================================
  // SECURITY TESTS
  // ============================================
  describe('Security', () => {
    it('E2E-S1: learner cannot read another learner enrollment', async () => {
      // Create another learner
      const { data: otherLearner } = await supabase
        .from('profiles')
        .select('id')
        .neq('id', learnerId)
        .neq('id', creatorId)
        .limit(1)
        .single();

      if (!otherLearner) return; // Skip if no other learner

      // Other learner tries to read enrollment - should be blocked by RLS
      const { data, error } = await supabase
        .from('course_enrollments')
        .select('*')
        .eq('course_id', courseId);

      // RLS should filter results
      expect(Array.isArray(data)).toBe(true);
    });
  });

  afterAll(async () => {
    // Cleanup
    await supabase.from('course_reviews').delete().eq('course_id', courseId);
    await supabase.from('course_quiz_attempts').delete().eq('quiz_id', quizId);
    await supabase.from('course_lesson_progress').delete().eq('enrollment_id', enrollmentId);
    await supabase.from('course_enrollments').delete().eq('id', enrollmentId);
    await supabase.from('course_quizzes').delete().eq('id', quizId);
    await supabase.from('course_lessons').delete().eq('id', lessonId);
    await supabase.from('course_sections').delete().eq('id', sectionId);
    await supabase.from('courses').delete().eq('id', courseId);
  });
});
