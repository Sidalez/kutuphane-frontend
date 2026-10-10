/** Small account thumbnails fit in the user's existing Firestore document. */
export async function prepareProfileAvatar(file: File): Promise<string> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") throw new Error("Lütfen JPG, PNG veya WebP biçiminde bir fotoğraf seç.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Fotoğraf en fazla 15 MB olabilir.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Fotoğraf açılamadı. JPG veya PNG biçiminde tekrar dene."));
      image.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context || !image.naturalWidth || !image.naturalHeight) throw new Error("Fotoğraf işlenemedi. Lütfen başka bir fotoğraf seç.");
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 256, 256);
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
    const result = canvas.toDataURL("image/jpeg", 0.82);
    if (!result.startsWith("data:image/jpeg;base64,") || result.length > 150000) throw new Error("Fotoğraf küçültülemedi. Lütfen başka bir fotoğraf seç.");
    return result;
  } finally { URL.revokeObjectURL(url); }
}
