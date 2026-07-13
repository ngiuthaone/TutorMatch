export interface HeaderUser {
  id: string;
  name: string;
  avatarUrl?: string;
  isCreator?: boolean;
  unreadMessages?: number;
  unreadNotifications?: number;
}

export interface NavItem {
  label: string;
  href: string;
  matchPatterns?: string[];
}
