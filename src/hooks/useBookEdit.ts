import { useAppDialog } from "../components/feedback/DialogProvider";
// src/hooks/useBookEdit.ts

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebase";
import { api } from "../apiClient";
import type { Book } from "../types/book";

export function useBookEdit(initial: Book | null, onSaved?: (b: Book) => void) {
  const dialog = useAppDialog();
  const [form, setForm] = useState<any>(initial || {});
  const [loading, setLoading] = useState(false);

  const updateField = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

const autoFillFromAI = async () => {
  if (!form.isbn) return;

  setLoading(true);
  try {
    const res = await api.post(
      "/api/books/isbn",
      { isbn: form.isbn }
    );

    const data = res.data.data;

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
    void dialog.alert({title:"Kitap bilgileri alınamadı",message:"Bağlantını kontrol edip tekrar dene. Girdiğin bilgiler korunuyor.",tone:"error",confirmLabel:"Anladım"});
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
      void dialog.alert({title:"Değişiklikler kaydedilemedi",message:"Lütfen bağlantını kontrol edip yeniden kaydetmeyi dene.",tone:"error",confirmLabel:"Anladım"});
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
