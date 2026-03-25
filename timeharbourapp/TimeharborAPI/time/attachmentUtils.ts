import type { SessionAttachment } from '../db';

async function blobUrlToDataUrl(blobUrl: string): Promise<string> {
  const res = await fetch(blobUrl);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convert blob-URL images and File objects into persistable SessionAttachments.
 */
export async function collectAttachments(
  imageUrls: string[],
  files: File[]
): Promise<SessionAttachment[]> {
  const attachments: SessionAttachment[] = [];

  for (let i = 0; i < imageUrls.length; i++) {
    const dataUrl = await blobUrlToDataUrl(imageUrls[i]);
    const mime = dataUrl.match(/^data:(.*?);/)?.[1] ?? 'image/png';
    attachments.push({
      name: `image-${i + 1}.${mime.split('/')[1] || 'png'}`,
      type: mime,
      dataUrl,
    });
  }

  for (const file of files) {
    const dataUrl = await fileToDataUrl(file);
    attachments.push({
      name: file.name,
      type: file.type || 'application/octet-stream',
      dataUrl,
    });
  }

  return attachments;
}
