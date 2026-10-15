import type { Attachment, CommunityOption, ContentLevel, ContentVisibility, PostType, ReplyPermission, Skill, Topic } from './community';

export type PostType = 'insight' | 'question' | 'tip' | 'tutorial' | 'experience' | 'project' | 'discussion';

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
  status: 'draft' | 'published';
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

export interface Comment {
  id: string;
  parentId: string;
  contentId: string;
  contentType: 'post' | 'article';
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

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function estimateReadingTime(text: string): number {
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
