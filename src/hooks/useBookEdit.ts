// src/hooks/useBookEdit.ts

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import axios from "axios";
import type { Book } from "../types/book";

export function useBookEdit(initial: Book | null, onSaved?: (b: Book) => void) {
  const [form, setForm] = useState<any>(initial || {});
  const [loading, setLoading] = useState(false);

  const updateField = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

const autoFillFromAI = async () => {
  if (!form.isbn) return;

  setLoading(true);
  try {
    const res = await axios.post(
      "http://localhost:3001/api/books/ai",
      { isbn: form.isbn }
    );

    const data = res.data;

    setForm((prev: any) => ({
      ...prev,
      title: data.title || prev.title,
      author: data.author || prev.author,
      publisher: data.publisher || prev.publisher,
      publishYear: data.publishedDate || prev.publishYear,
      totalPages: data.pageCount || prev.totalPages,
      summary: data.description || prev.summary,
      coverImageUrl: data.coverImageUrl || prev.coverImageUrl,
    }));

  } catch (e) {
    console.error(e);
    alert("AI kitap bilgisi alınamadı");
  }

  setLoading(false);
};


  const saveChanges = async () => {
    if (!form.id) return;
    setLoading(true);

    try {
      const ref = doc(db, "books", form.id);
      await updateDoc(ref, {
        title: form.title,
        author: form.author,
        publisher: form.publisher,
        publishYear: form.publishYear,
        totalPages: Number(form.totalPages) || null,
        isbn: form.isbn || null,
        summary: form.summary || "",
        shelf: form.shelf || null,
        categories: form.categories || [],
        description: form.description || "",
        coverImageUrl: form.coverImageUrl || null,
      });

      onSaved?.(form);
    } catch (e) {
      console.error(e);
      alert("Kaydedilirken hata oluştu");
    }

    setLoading(false);
  };

  return {
    form,
    setForm,
    updateField,
    saveChanges,
    autoFillFromAI,
    loading,
  };
}
