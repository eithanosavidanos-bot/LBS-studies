export type Role = "student" | "admin";

export interface Profile {
  id: string;
  name: string;
  role: Role;
}

export interface Book {
  title?: string;
  edition?: string;
  authors?: string;
  publisher?: string;
  isbn?: string;
}

export interface Course {
  id: string;
  slug: string;
  code: string;
  name: string;
  book: Book;
  parts: Record<string, string>;
  position: number;
  pdf_path: string | null;
}

export interface Chapter {
  id: string;
  course_id: string;
  n: number;
  part: number;
  title: string;
  pages: string;
  outline: string[];
  summary: string[];
  terms: [string, string][];
}

export interface QuestionRow {
  id: string;
  course_id: string;
  chapter_n: number | null;
  type: string;
  prompt: string;
  payload: Record<string, unknown>;
  explanation: string;
}
