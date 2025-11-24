// src/types/book.ts
import type { Timestamp } from "firebase/firestore";

export type BookStatus = "OKUNACAK" | "OKUNUYOR" | "OKUNDU";

export interface Book {
  id: string;
  userId: string;
  title: string;
  author?: string | null;
  publisher?: string | null;
  isbn?: string | null;
  totalPages?: number | null;
  coverImageUrl?: string | null;
  status: BookStatus;
  pagesRead?: number;

  // 3 ayrı puan
  expectedRating?: number | null;  // Okunacak: beklentim
  progressRating?: number | null;  // Okunuyor: gidişat
  finalRating?: number | null;     // Okundu: bitmiş puan
  overallRating?: number | null;   // Otomatik genel ortalama

  categories: string[];
  shelf?: string | null;

  startDate?: string | null;
  endDate?: string | null;
  notes?: string | null;
  review?: string | null;

  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;

  publishYear?: string;
  description?: string;

}
