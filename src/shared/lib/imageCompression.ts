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

const isHeic = (file: File) => /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);

/**
 * Las fotos de la cámara del iPhone llegan en HEIC, que la mayoría de navegadores no
 * saben pintar: una foto así se guardaba bien pero luego salía «Foto no disponible».
 * Si el sistema puede decodificarla (la app de iOS sí), se pasa a JPEG antes de usarla;
 * si no puede, se devuelve tal cual.
 */
export async function toBrowserFriendlyImage(file: File, maxDimension = 2048, timeoutMs = 8000): Promise<File> {
  if (!isHeic(file)) return file;
  return new Promise((done) => {
    // Si el sistema no llega a decodificarla, no bloqueamos la subida: va el original.
    let settled = false;
    const resolve = (value: File) => { if (!settled) { settled = true; clearTimeout(timer); done(value); } };
    const timer = setTimeout(() => resolve(file), timeoutMs);
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(file);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: Date.now() }));
        }, "image/jpeg", 0.88);
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
