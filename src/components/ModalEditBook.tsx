import { X } from "lucide-react";
import type { Book } from "../types/book";
import { useState } from "react";

interface ModalEditBookProps {
  book: Book;
  onClose: () => void;
  onSaved: (updated: Book) => void; // parametreli şekilde düzeltildi
}

export default function ModalEditBook({
  book,
  onClose,
  onSaved,
}: ModalEditBookProps) {
  const [form, setForm] = useState({
    title: book.title || "",
    author: book.author || "",
    publisher: book.publisher || "",
    publishYear: book.publishYear || "",
    totalPages: book.totalPages || "",
    isbn: book.isbn || "",
    summary: book.description || book.notes || "",
  });

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSave = () => {
    const updated: Book = {
      ...book,
      title: form.title,
      author: form.author,
      publisher: form.publisher,
      publishYear: form.publishYear,
      totalPages: Number(form.totalPages),
      isbn: form.isbn,
      description: form.summary,
    };

    onSaved(updated); // ❗ TS artık hata vermez
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md p-6 rounded-2xl shadow-xl animate-in fade-in zoom-in">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Kitabı Düzenle</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-600">Kitap Adı</label>
            <input
              className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800"
              value={form.title}
              onChange={(e) => handleChange("title", e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Yazar</label>
            <input
              className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800"
              value={form.author}
              onChange={(e) => handleChange("author", e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600">Özet / Açıklama</label>
            <textarea
              className="w-full px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 min-h-[90px]"
              value={form.summary}
              onChange={(e) => handleChange("summary", e.target.value)}
            />
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 font-semibold"
          >
            Vazgeç
          </button>

          <button
            onClick={handleSave}
            className="flex-1 py-2 rounded-xl bg-amber-500 text-white font-semibold shadow hover:bg-amber-600"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}
