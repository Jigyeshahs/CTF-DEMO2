
export enum Category {
  OSINT = 'OSINT',
  DARK_WEB = 'DARK WEB',
  FORENSICS = 'FORENSICS',
  WEB_EXPLOIT = 'WEB EXPLOIT',
  CRYPTO = 'CRYPTO',
  REVERSE = 'REVERSE'
}

export enum Difficulty {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD',
  INSANE = 'INSANE'
}

export enum Role {
  STUDENT = 'STUDENT',
  HOST = 'HOST'
}

export interface User {
  username: string;
  password?: string;
  role: Role;
  score: number;
  solvedIds: string[];
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  category: Category;
  difficulty: Difficulty;
  points: number;
  flag: string;
  solves: number;
  author: string;
  hint?: string;
  manualHints?: string[];
  tags?: string[];
  attachment?: string; // Base64 or URL for media
  createdAt: number;
}

export interface Submission {
  id: string;
  challengeId: string;
  username: string;
  timestamp: number;
  isCorrect: boolean;
  flagSubmitted: string;
}
