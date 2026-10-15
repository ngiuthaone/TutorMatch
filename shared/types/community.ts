export type ContentVisibility = 'public' | 'community';

export type ContentLevel = 'complete_beginner' | 'beginner' | 'intermediate' | 'advanced' | 'all_levels';

export type ReplyPermission = 'everyone' | 'community_members' | 'disabled';

export type AttachmentType = 'image' | 'document' | 'link';

export interface Attachment {
  id: string;
  type: AttachmentType;
  url: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  altText?: string;
  sortOrder: number;
  uploadStatus: 'pending' | 'uploading' | 'complete' | 'error';
}

export interface CommunityOption {
  id: string;
  name: string;
  avatarUrl?: string;
  isMember: boolean;
  canPost: boolean;
}

export const TOPICS = [
  'Academic', 'Languages', 'Technology', 'Business', 'Creative arts',
  'Photography', 'Music', 'Cooking', 'Beauty', 'Sports',
  'Personal development', 'Entrepreneurship', 'Volunteering',
] as const;

export type Topic = typeof TOPICS[number];

export const SKILLS = [
  'Public speaking', 'Portrait photography', 'IELTS speaking', 'IELTS writing',
  'IELTS reading', 'IELTS listening', 'React', 'TypeScript', 'Next.js',
  'Node.js', 'Python', 'JavaScript', 'English', 'Vietnamese', 'Japanese',
  'Korean', 'Mandarin', 'Flower arranging', 'Baking', 'Pasta making',
  'Digital marketing', 'Content writing', 'UX design', 'UI design',
  'Figma', 'Adobe Photoshop', 'Video editing', 'Presentation skills',
  'Leadership', 'Time management', 'Meditation', 'Yoga',
] as const;

export type Skill = typeof SKILLS[number];
