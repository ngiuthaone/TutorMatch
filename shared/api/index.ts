import type {
  BackendCourse,
  BackendCourseResult,
  BackendCoursePublishInput,
  BackendCoursePublishResult,
  BackendSectionResult,
  BackendLessonResult,
  CourseUpdateInput,
  SectionInput,
  LessonInput,
  CourseProgress,
  CourseLessonProgress,
  CourseListing,
  CourseDetail,
  FlatCourseItem,
} from '../types/course';

import type {
  PostDraft,
  PublishedPost,
  Comment,
} from '../types/discussion';

import type {
  ArticleDraft,
  PublishedArticle,
} from '../types/article';

export interface ApiError {
  code: string;
  message: string;
  status: number;
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 0, message = code) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken: () => string | null;
  getRefreshToken?: () => string | null;
  onTokenRefresh?: (newToken: string) => void;
}

type ApiPayload = { error?: { code?: unknown; message?: unknown }; item?: unknown };

function fallbackCodeForStatus(status: number, fallback: string): string {
  if (status === 409) return 'SLUG_CONFLICT';
  if (status === 400) return 'INVALID';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  return fallback;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiClientError('INVALID_RESPONSE', response.status);
  }
}

function readApiError(response: Response, payload: unknown, fallbackMessage: string): ApiClientError {
  const error = payload as ApiPayload | null;
  const code = typeof error?.error?.code === 'string' ? error.error.code : fallbackCodeForStatus(response.status, fallbackMessage);
  const message = typeof error?.error?.message === 'string' ? error.error.message : fallbackMessage;
  return new ApiClientError(code, response.status, message);
}

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, getAccessToken, getRefreshToken, onTokenRefresh } = config;

  const base = baseUrl.replace(/\/$/, '');

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const token = getAccessToken();
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${base}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials: 'omit',
      cache: 'no-store',
    });

    const payload = await parseJson(response);

    if (!response.ok) {
      if (response.status === 401 && getRefreshToken) {
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          const refreshResponse = await fetch(`${base}/api/v1/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: refreshToken }),
            cache: 'no-store',
          });

          if (refreshResponse.ok) {
            const refreshData = await parseJson(refreshResponse) as { access_token?: string; refresh_token?: string } | null;
            if (refreshData?.access_token) {
              onTokenRefresh?.(refreshData.access_token);
              return request(path, options);
            }
          }
        }
      }
      throw readApiError(response, payload, 'Request failed');
    }

    return payload as T;
  }

  return {
    request,
    get: <T>(path: string, headers?: Record<string, string>) => request<T>(path, { method: 'GET', headers }),
    post: <T>(path: string, body: unknown, headers?: Record<string, string>) => request<T>(path, { method: 'POST', body, headers }),
    put: <T>(path: string, body: unknown, headers?: Record<string, string>) => request<T>(path, { method: 'PUT', body, headers }),
    patch: <T>(path: string, body: unknown, headers?: Record<string, string>) => request<T>(path, { method: 'PATCH', body, headers }),
    delete: <T>(path: string, headers?: Record<string, string>) => request<T>(path, { method: 'DELETE', headers }),
  };
}

export const courseApi = {
  getBySlug: (client: ReturnType<typeof createApiClient>, slug: string): Promise<BackendCourseResult> =>
    client.get(`/api/v1/marketplace/course/${encodeURIComponent(slug)}`),

  getById: (client: ReturnType<typeof createApiClient>, courseId: string): Promise<BackendCourseResult> =>
    client.get(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}`),

  publish: (client: ReturnType<typeof createApiClient>, input: BackendCoursePublishInput): Promise<BackendCoursePublishResult> =>
    client.post('/api/v1/marketplace/course', input),

  update: (client: ReturnType<typeof createApiClient>, courseId: string, input: CourseUpdateInput): Promise<BackendCourseResult> =>
    client.put(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}`, input),

  createSection: (client: ReturnType<typeof createApiClient>, courseId: string, input: SectionInput): Promise<BackendSectionResult> =>
    client.post(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/sections`, input),

  updateSection: (client: ReturnType<typeof createApiClient>, sectionId: string, input: SectionInput): Promise<BackendSectionResult> =>
    client.put(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}`, input),

  deleteSection: (client: ReturnType<typeof createApiClient>, sectionId: string): Promise<void> =>
    client.delete(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}`),

  createLesson: (client: ReturnType<typeof createApiClient>, sectionId: string, input: LessonInput): Promise<BackendLessonResult> =>
    client.post(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}/lessons`, input),

  updateLesson: (client: ReturnType<typeof createApiClient>, lessonId: string, input: LessonInput): Promise<BackendLessonResult> =>
    client.put(`/api/v1/marketplace/lesson/${encodeURIComponent(lessonId)}`, input),

  deleteLesson: (client: ReturnType<typeof createApiClient>, lessonId: string): Promise<void> =>
    client.delete(`/api/v1/marketplace/lesson/${encodeURIComponent(lessonId)}`),

  reorderLessons: (client: ReturnType<typeof createApiClient>, sectionId: string, lessonIds: string[]): Promise<void> =>
    client.put(`/api/v1/marketplace/section/${encodeURIComponent(sectionId)}/lessons/reorder`, { lesson_ids: lessonIds }),

  reorderSections: (client: ReturnType<typeof createApiClient>, courseId: string, sectionIds: string[]): Promise<void> =>
    client.put(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/sections/reorder`, { section_ids: sectionIds }),

  updateLessonProgress: (client: ReturnType<typeof createApiClient>, lessonId: string, completed: boolean): Promise<void> =>
    client.post('/api/v1/marketplace/lesson-progress', { lesson_id: lessonId, completed }),

  updateLessonVideoPosition: (client: ReturnType<typeof createApiClient>, lessonId: string, position: number): Promise<void> =>
    client.put('/api/v1/marketplace/lesson-progress/position', { lesson_id: lessonId, position }),

  getLessonProgress: (client: ReturnType<typeof createApiClient>, lessonId: string): Promise<CourseLessonProgress | null> =>
    client.get(`/api/v1/marketplace/lesson-progress/${encodeURIComponent(lessonId)}`),

  getCourseProgress: (client: ReturnType<typeof createApiClient>, courseId: string): Promise<CourseProgress | null> =>
    client.get(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/progress`),

  markCourseComplete: (client: ReturnType<typeof createApiClient>, courseId: string): Promise<void> =>
    client.post(`/api/v1/marketplace/course/${encodeURIComponent(courseId)}/complete`),

  getSignedVideoUrl: (client: ReturnType<typeof createApiClient>, videoPath: string): Promise<string> =>
    client.post('/api/v1/marketplace/video-url', { video_path: videoPath }).then((r: { url: string }) => r.url),
};

export const creatorCourseApi = {
  get: (client: ReturnType<typeof createApiClient>, courseId: string): Promise<{ ok: boolean; item?: FlatCourseItem }> =>
    client.get(`/api/v1/courses/${encodeURIComponent(courseId)}`),

  create: (client: ReturnType<typeof createApiClient>, body: unknown): Promise<{ ok: boolean; item?: FlatCourseItem }> =>
    client.post('/api/v1/courses', body),

  update: (client: ReturnType<typeof createApiClient>, courseId: string, body: unknown): Promise<{ ok: boolean; item?: FlatCourseItem }> =>
    client.patch(`/api/v1/courses/${encodeURIComponent(courseId)}`, body),

  publish: (client: ReturnType<typeof createApiClient>, courseId: string): Promise<{ ok: boolean }> =>
    client.post(`/api/v1/courses/${encodeURIComponent(courseId)}/publish`),
};

export const communityApi = {
  getPosts: (client: ReturnType<typeof createApiClient>, params?: { communityId?: string; limit?: number; cursor?: string }): Promise<{ items: PublishedPost[]; nextCursor?: string }> => {
    const search = new URLSearchParams();
    if (params?.communityId) search.set('community_id', params.communityId);
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.cursor) search.set('cursor', params.cursor);
    return client.get(`/api/v1/community/posts?${search.toString()}`);
  },

  createPost: (client: ReturnType<typeof createApiClient>, draft: PostDraft): Promise<PublishedPost> =>
    client.post('/api/v1/community/posts', draft),

  updatePost: (client: ReturnType<typeof createApiClient>, postId: string, draft: Partial<PostDraft>): Promise<PublishedPost> =>
    client.patch(`/api/v1/community/posts/${postId}`, draft),

  deletePost: (client: ReturnType<typeof createApiClient>, postId: string): Promise<void> =>
    client.delete(`/api/v1/community/posts/${postId}`),

  getComments: (client: ReturnType<typeof createApiClient>, contentId: string, contentType: 'post' | 'article'): Promise<Comment[]> =>
    client.get(`/api/v1/community/comments?content_id=${contentId}&content_type=${contentType}`),

  createComment: (client: ReturnType<typeof createApiClient>, comment: Omit<Comment, 'id' | 'createdAt' | 'likes' | 'appreciated' | 'replies'>): Promise<Comment> =>
    client.post('/api/v1/community/comments', comment),

  likeContent: (client: ReturnType<typeof createApiClient>, contentId: string, contentType: 'post' | 'article'): Promise<{ liked: boolean; count: number }> =>
    client.post('/api/v1/community/like', { content_id: contentId, content_type: contentType }),

  saveContent: (client: ReturnType<typeof createApiClient>, contentId: string, contentType: 'post' | 'article'): Promise<{ saved: boolean }> =>
    client.post('/api/v1/community/save', { content_id: contentId, content_type: contentType }),
};

export const articleApi = {
  getById: (client: ReturnType<typeof createApiClient>, articleId: string): Promise<PublishedArticle | null> =>
    client.get(`/api/v1/articles/${articleId}`),

  getList: (client: ReturnType<typeof createApiClient>, params?: { communityId?: string; limit?: number; cursor?: string }): Promise<{ items: PublishedArticle[]; nextCursor?: string }> => {
    const search = new URLSearchParams();
    if (params?.communityId) search.set('community_id', params.communityId);
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.cursor) search.set('cursor', params.cursor);
    return client.get(`/api/v1/articles?${search.toString()}`);
  },

  create: (client: ReturnType<typeof createApiClient>, draft: ArticleDraft): Promise<PublishedArticle> =>
    client.post('/api/v1/articles', draft),

  update: (client: ReturnType<typeof createApiClient>, articleId: string, draft: Partial<ArticleDraft>): Promise<PublishedArticle> =>
    client.patch(`/api/v1/articles/${articleId}`, draft),

  delete: (client: ReturnType<typeof createApiClient>, articleId: string): Promise<void> =>
    client.delete(`/api/v1/articles/${articleId}`),
};

export const authApi = {
  refreshSession: (client: ReturnType<typeof createApiClient>, refreshToken: string): Promise<{ access_token: string; refresh_token?: string }> =>
    client.post('/api/v1/auth/refresh', { refresh_token: refreshToken }),

  signOut: (client: ReturnType<typeof createApiClient>): Promise<void> =>
    client.post('/api/v1/auth/signout'),
};

export const marketplaceApi = {
  getCourses: (client: ReturnType<typeof createApiClient>, params?: { category?: string; level?: string; search?: string; limit?: number; cursor?: string }): Promise<{ items: CourseListing[]; nextCursor?: string }> => {
    const search = new URLSearchParams();
    if (params?.category) search.set('category', params.category);
    if (params?.level) search.set('level', params.level);
    if (params?.search) search.set('search', params.search);
    if (params?.limit) search.set('limit', String(params.limit));
    if (params?.cursor) search.set('cursor', params.cursor);
    return client.get(`/api/v1/marketplace/courses?${search.toString()}`);
  },

  getCourseDetail: (client: ReturnType<typeof createApiClient>, slug: string): Promise<CourseDetail | null> =>
    client.get(`/api/v1/marketplace/course/${encodeURIComponent(slug)}/detail`),

  getSimilarCourses: (client: ReturnType<typeof createApiClient>, slug: string, limit = 3): Promise<CourseListing[]> =>
    client.get(`/api/v1/marketplace/course/${encodeURIComponent(slug)}/similar?limit=${limit}`),
};
