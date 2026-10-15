import type { Attachment, CommunityOption, ContentLevel, ContentVisibility, Skill, Topic } from './community';

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
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface PublishedArticle extends ArticleDraft {
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorRole?: string;
  likes: number;
  comments: number;
  appreciated: boolean;
  saved: boolean;
}
