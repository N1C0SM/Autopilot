/**
 * Comprime y optimiza imágenes del usuario en el navegador antes de subirlas.
 * Reduce fotos de cámara móvil (4-12 MB) a ~120-250 KB sin pérdida visible de nitidez,
 * acelerando la subida y la descarga posterior un ~95%.
 */
export async function compressImage(
  file: File,
  options: {
    maxDimension?: number;
    quality?: number;
    mimeType?: "image/webp" | "image/jpeg";
  } = {},
): Promise<File> {
  const { maxDimension = 1600, quality = 0.82, mimeType = "image/jpeg" } = options;

  // Si ya es un archivo muy ligero (< 150 KB), no hace falta recomprimirlo
  if (file.size <= 150 * 1024) {
    return file;
  }

  // Si no es un tipo de imagen manejable por canvas, devolver original
  if (!file.type.startsWith("image/")) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              // Si la compresión no redujo el tamaño o falló, conservar el original
              resolve(file);
              return;
            }
            const ext = mimeType === "image/webp" ? "webp" : "jpg";
            const newName = file.name.replace(/\.[^/.]+$/, "") + `.${ext}`;
            const compressed = new File([blob], newName, { type: mimeType, lastModified: Date.now() });
            resolve(compressed);
          },
          mimeType,
          quality,
        );
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}
