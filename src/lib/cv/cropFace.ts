import { LandmarkPoint } from './depthVariance';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function computeFaceBoundingBox(
  landmarks: LandmarkPoint[],
  videoWidth: number,
  videoHeight: number
): BoundingBox {
  if (!landmarks || landmarks.length === 0) {
    return {
      x: 0,
      y: 0,
      width: videoWidth,
      height: videoHeight,
    };
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const pt of landmarks) {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  const pixelMinX = minX * videoWidth;
  const pixelMaxX = maxX * videoWidth;
  const pixelMinY = minY * videoHeight;
  const pixelMaxY = maxY * videoHeight;

  const rawWidth = pixelMaxX - pixelMinX;
  const rawHeight = pixelMaxY - pixelMinY;

  const padX = rawWidth * 0.25;
  const padY = rawHeight * 0.25;

  const cropX = Math.max(0, pixelMinX - padX);
  const cropY = Math.max(0, pixelMinY - padY);
  const cropWidth = Math.min(videoWidth - cropX, rawWidth + padX * 2);
  const cropHeight = Math.min(videoHeight - cropY, rawHeight + padY * 2);

  return {
    x: Math.round(cropX),
    y: Math.round(cropY),
    width: Math.round(cropWidth),
    height: Math.round(cropHeight),
  };
}

export async function captureAndCropFaceSnapshot(
  video: HTMLVideoElement,
  landmarks?: LandmarkPoint[],
  targetMaxDimension = 400
): Promise<{ dataUrl: string; blob: Blob; sizeBytes: number }> {
  const videoWidth = video.videoWidth || 640;
  const videoHeight = video.videoHeight || 480;

  const bbox = landmarks && landmarks.length > 0
    ? computeFaceBoundingBox(landmarks, videoWidth, videoHeight)
    : { x: 0, y: 0, width: videoWidth, height: videoHeight };

  const aspectRatio = bbox.width / bbox.height;
  let targetWidth = bbox.width;
  let targetHeight = bbox.height;

  if (targetWidth > targetMaxDimension || targetHeight > targetMaxDimension) {
    if (aspectRatio > 1) {
      targetWidth = targetMaxDimension;
      targetHeight = Math.round(targetMaxDimension / aspectRatio);
    } else {
      targetHeight = targetMaxDimension;
      targetWidth = Math.round(targetMaxDimension * aspectRatio);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Gagal menginisialisasi Canvas Context 2D.');
  }

  ctx.drawImage(
    video,
    bbox.x,
    bbox.y,
    bbox.width,
    bbox.height,
    0,
    0,
    targetWidth,
    targetHeight
  );

  const dataUrl = canvas.toDataURL('image/webp', 0.82);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('Gagal menghasilkan blob snapshot.'));
      },
      'image/webp',
      0.82
    );
  });

  return {
    dataUrl,
    blob,
    sizeBytes: blob.size,
  };
}
