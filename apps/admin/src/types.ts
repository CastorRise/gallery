import type React from 'react';
export type Page =
  | 'Dashboard'
  | 'Library'
  | 'Collections'
  | 'Journal'
  | 'Categories'
  | 'Settings'
  | 'Publish';
export type Setter<T> = React.Dispatch<React.SetStateAction<T>>;
export interface Backup {
  id: string;
  createdAt: string;
  photos: number;
}
export interface Dashboard {
  total: number;
  published: number;
  drafts: number;
  collections: number;
  journals: number;
  build: { ok: boolean; builtAt: string | null };
  git: string;
}
