const WEBP_MIME = "image/webp";

export async function toOptimizedWebp(file: File, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === WEBP_MIME) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, WEBP_MIME, quality),
    );
    if (!blob) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, {
      type: WEBP_MIME,
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
  }
}
