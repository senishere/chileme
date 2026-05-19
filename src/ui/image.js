import { MAX_STORED_DATA_URL_BYTES } from "../store.js";

export const IMAGE_MAX_DIMENSION = 1200;
export const IMAGE_QUALITY = 0.72;

export function dataUrlTooLarge(dataUrl) {
  return String(dataUrl || "").length > MAX_STORED_DATA_URL_BYTES;
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取图片"));
    };
    image.src = url;
  });
}

export async function compressImage(file) {
  const image = await loadImageElement(file);
  const ratio = Math.min(
    1,
    IMAGE_MAX_DIMENSION / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height)
  );
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * ratio));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  const webp = canvas.toDataURL("image/webp", IMAGE_QUALITY);
  if (webp.startsWith("data:image/webp")) return webp;
  return canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
}

export function readRawImage(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}

export async function readImage(file) {
  if (!file) return { dataUrl: "", dropped: false };
  let dataUrl = "";
  try {
    dataUrl = await compressImage(file);
  } catch (error) {
    dataUrl = await readRawImage(file);
  }

  if (!dataUrl || dataUrlTooLarge(dataUrl)) {
    return { dataUrl: "", dropped: Boolean(dataUrl) };
  }
  return { dataUrl, dropped: false };
}
