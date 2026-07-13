export type PostType = "insight" | "question" | "tip" | "tutorial" | "experience" | "project" | "discussion";

export type ContentVisibility = "public" | "community";

export type ContentLevel = "complete_beginner" | "beginner" | "intermediate" | "advanced" | "all_levels";

export type ReplyPermission = "everyone" | "community_members" | "disabled";

export type AttachmentType = "image" | "document" | "link";

export interface Attachment {
  id: string;
  type: AttachmentType;
  url: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  altText?: string;
  sortOrder: number;
  uploadStatus: "pending" | "uploading" | "complete" | "error";
}

export interface PostDraft {
  id: string;
  body: string;
  postType?: PostType;
  title?: string;
  visibility: ContentVisibility;
  communityId?: string;
  communityName?: string;
  topicId?: number;
  topicName?: string;
  skillIds: string[];
  skillNames: string[];
  level?: ContentLevel;
  replyPermission: ReplyPermission;
  attachments: Attachment[];
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

export interface PublishedPost extends PostDraft {
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: string;
  likes: number;
  comments: number;
  appreciated: boolean;
  saved: boolean;
}

export interface ArticleDraft {
  id: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  coverImage?: Attachment;
  content: Record<string, unknown>;
  contentHtml?: string;
  visibility: ContentVisibility;
  communityId?: string;
  communityName?: string;
  topicId?: number;
  topicName?: string;
  skillIds: string[];
  skillNames: string[];
  level?: ContentLevel;
  commentsEnabled: boolean;
  estimatedReadingMinutes: number;
  status: "draft" | "published";
  createdAt: string;
  updatedAt: string;
}

export interface PublishedArticle extends ArticleDraft {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: string;
  likes: number;
  comments: number;
  appreciated: boolean;
  saved: boolean;
}

export interface Comment {
  id: string;
  parentId: string;
  contentId: string;
  contentType: "post" | "article";
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: string;
  body: string;
  likes: number;
  appreciated: boolean;
  createdAt: string;
  replies?: Comment[];
}

export interface CommunityOption {
  id: string;
  name: string;
  avatarUrl?: string;
  isMember: boolean;
  canPost: boolean;
}

export const TOPICS = [
  "Academic", "Languages", "Technology", "Business", "Creative arts",
  "Photography", "Music", "Cooking", "Beauty", "Sports",
  "Personal development", "Entrepreneurship", "Volunteering",
];

export const SKILLS = [
  "Public speaking", "Portrait photography", "IELTS speaking", "IELTS writing",
  "IELTS reading", "IELTS listening", "React", "TypeScript", "Next.js",
  "Node.js", "Python", "JavaScript", "English", "Vietnamese", "Japanese",
  "Korean", "Mandarin", "Flower arranging", "Baking", "Pasta making",
  "Digital marketing", "Content writing", "UX design", "UI design",
  "Figma", "Adobe Photoshop", "Video editing", "Presentation skills",
  "Leadership", "Time management", "Meditation", "Yoga",
];

export const COMMUNITIES: CommunityOption[] = [
  { id: "c1", name: "Young Founders Vietnam", isMember: true, canPost: true },
  { id: "c2", name: "Photography Enthusiasts", isMember: true, canPost: true },
  { id: "c3", name: "IELTS Warriors", isMember: false, canPost: true },
  { id: "c4", name: "Code & Coffee Saigon", isMember: true, canPost: true },
  { id: "c5", name: "Creative Mornings", isMember: false, canPost: true },
];

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

export function getUserFromStorage(): { id: string; name: string; avatarUrl?: string; role?: string } | null {
  try {
    const raw = localStorage.getItem("tutoria_signup");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.completed) {
        return {
          id: parsed.email || "local-user",
          name: parsed.name || "Learner",
          avatarUrl: undefined,
          role: parsed.roles?.[0] || "Learner",
        };
      }
    }
  } catch {}
  return null;
}
