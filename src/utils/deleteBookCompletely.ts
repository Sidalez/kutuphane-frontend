// src/utils/deleteBookCompletely.ts
import {
  collection,
  getDocs,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

/**
 * Bir kitabı VE ona ait tüm alt koleksiyonları (logs + notes)
 * tek seferde siler.
 */
export async function deleteBookCompletely(bookId: string) {
  const bookRef = doc(db, "books", bookId);
  const batch = writeBatch(db);

  // 1) Okuma log'larını sil
  const logsSnap = await getDocs(collection(bookRef, "logs"));
  logsSnap.forEach((d) => batch.delete(d.ref));

  // 2) Notları sil
  const notesSnap = await getDocs(collection(bookRef, "notes"));
  notesSnap.forEach((d) => batch.delete(d.ref));

  // 3) Kitabın kendisini sil
  batch.delete(bookRef);

  // 4) Batch commit
  await batch.commit();
}
