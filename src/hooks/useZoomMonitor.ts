'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { VerificationRecord } from '@/types';

interface UseZoomMonitorOptions {
  targetRecord: VerificationRecord | null;
  onCaptureZoomSnapshot: (recordId: string, base64DataUrl: string) => Promise<void>;
}

interface DetectedFaceBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  cx: number;
  cy: number;
  area: number;
}

export function useZoomMonitor({
  targetRecord,
  onCaptureZoomSnapshot,
}: UseZoomMonitorOptions) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [monitorStatus, setMonitorStatus] = useState<string>('Monitor Zoom nonaktif');
  const [monitorError, setMonitorError] = useState<string | null>(null);
  const [lastDetectedFaceCount, setLastDetectedFaceCount] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const cropCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const hostBaselineRef = useRef<{ cx: number; cy: number } | null>(null);
  const stableHitsRef = useRef<{ recordId: string; count: number }>({ recordId: '', count: 0 });
  const capturedIdsRef = useRef<Set<string>>(new Set());
  const isUploadingRef = useRef<boolean>(false);

  const ensureLandmarker = useCallback(async (): Promise<FaceLandmarker | null> => {
    if (landmarkerRef.current) return landmarkerRef.current;

    const origError = console.error;
    console.error = (...args: unknown[]) => {
      const msg = typeof args[0] === 'string' ? args[0] : '';
      if (msg.includes('TensorFlow Lite XNNPACK') || msg.includes('XNNPACK delegate')) {
        return;
      }
      origError.apply(console, args);
    };

    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );
      const lm = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'IMAGE',
        numFaces: 4,
        minFaceDetectionConfidence: 0.5,
      });
      landmarkerRef.current = lm;
      return lm;
    } catch (err) {
      console.warn('Zoom monitor FaceLandmarker GPU fallback failed, trying CPU:', err);
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        const lm = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'CPU',
          },
          runningMode: 'IMAGE',
          numFaces: 4,
          minFaceDetectionConfidence: 0.5,
        });
        landmarkerRef.current = lm;
        return lm;
      } catch (cpuErr) {
        console.error('Zoom monitor FaceLandmarker unavailable:', cpuErr);
        return null;
      }
    } finally {
      console.error = origError;
    }
  }, []);

  const stopMonitor = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
      videoElRef.current = null;
    }
    hostBaselineRef.current = null;
    stableHitsRef.current = { recordId: '', count: 0 };
    setIsMonitoring(false);
    setLastDetectedFaceCount(0);
    setMonitorStatus('Monitor Zoom nonaktif');
  }, []);

  const extractBestFaceFromCurrentFrame = useCallback(
    async (allowFullScreenFallback: boolean): Promise<{
      dataUrl: string | null;
      faceCount: number;
      faces: DetectedFaceBox[];
    }> => {
      const video = videoElRef.current;
      if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        return { dataUrl: null, faceCount: 0, faces: [] };
      }

      const w = video.videoWidth;
      const h = video.videoHeight;

      if (!canvasElRef.current) {
        canvasElRef.current = document.createElement('canvas');
      }
      const frameCanvas = canvasElRef.current;
      frameCanvas.width = w;
      frameCanvas.height = h;
      const frameCtx = frameCanvas.getContext('2d');
      if (!frameCtx) return { dataUrl: null, faceCount: 0, faces: [] };

      frameCtx.drawImage(video, 0, 0, w, h);

      const lm = await ensureLandmarker();
      const boxes: DetectedFaceBox[] = [];

      if (lm) {
        const origError = console.error;
        console.error = (...args: unknown[]) => {
          const msg = typeof args[0] === 'string' ? args[0] : '';
          if (msg.includes('XNNPACK')) return;
          origError.apply(console, args);
        };
        try {
          const res = lm.detect(frameCanvas);
          if (res?.faceLandmarks?.length) {
            for (const landmarks of res.faceLandmarks) {
              let minX = w;
              let minY = h;
              let maxX = 0;
              let maxY = 0;
              for (const pt of landmarks) {
                const px = pt.x * w;
                const py = pt.y * h;
                if (px < minX) minX = px;
                if (px > maxX) maxX = px;
                if (py < minY) minY = py;
                if (py > maxY) maxY = py;
              }
              const bw = maxX - minX;
              const bh = maxY - minY;
              if (bw > 24 && bh > 24) {
                boxes.push({
                  minX,
                  minY,
                  maxX,
                  maxY,
                  cx: (minX + maxX) / 2 / w,
                  cy: (minY + maxY) / 2 / h,
                  area: bw * bh,
                });
              }
            }
          }
        } catch (err) {
          console.warn('Zoom frame detection warning:', err);
        } finally {
          console.error = origError;
        }
      }

      if (boxes.length === 0) {
        if (!allowFullScreenFallback) {
          return { dataUrl: null, faceCount: 0, faces: [] };
        }
        // Fallback manual capture: kirim frame tengah jendela Zoom terkompresi
        if (!cropCanvasRef.current) {
          cropCanvasRef.current = document.createElement('canvas');
        }
        const out = cropCanvasRef.current;
        out.width = 640;
        out.height = Math.max(360, Math.round((640 * h) / w));
        const outCtx = out.getContext('2d');
        if (!outCtx) return { dataUrl: null, faceCount: 0, faces: [] };
        outCtx.drawImage(frameCanvas, 0, 0, out.width, out.height);
        return {
          dataUrl: out.toDataURL('image/webp', 0.85),
          faceCount: 0,
          faces: [],
        };
      }

      // Pilih kandidat terbaik:
      // - Jika 2+ wajah (Gallery View) dan baseline Host sudah terkalibrasi, pilih wajah yang posisinya paling jauh dari Host.
      // - Jika tidak, pilih wajah dengan area terbesar (Speaker View / Pin Kandidat).
      let chosen = boxes[0];
      if (boxes.length > 1 && hostBaselineRef.current) {
        const host = hostBaselineRef.current;
        let maxDist = -1;
        for (const box of boxes) {
          const dist = Math.hypot(box.cx - host.cx, box.cy - host.cy);
          if (dist > maxDist) {
            maxDist = dist;
            chosen = box;
          }
        }
      } else {
        chosen = boxes.reduce((best, cur) => (cur.area > best.area ? cur : best), boxes[0]);
      }

      // Crop persegi dengan margin proporsional di sekitar wajah agar tampilan natural (480x480)
      const faceSize = Math.max(chosen.maxX - chosen.minX, chosen.maxY - chosen.minY);
      const cropSide = faceSize * 1.9;
      const cxPx = (chosen.minX + chosen.maxX) / 2;
      const cyPx = (chosen.minY + chosen.maxY) / 2;
      const sx = Math.max(0, Math.min(w - cropSide, cxPx - cropSide / 2));
      const sy = Math.max(0, Math.min(h - cropSide, cyPx - cropSide / 2));
      const sw = Math.min(cropSide, w);
      const sh = Math.min(cropSide, h);

      if (!cropCanvasRef.current) {
        cropCanvasRef.current = document.createElement('canvas');
      }
      const out = cropCanvasRef.current;
      out.width = 480;
      out.height = 480;
      const outCtx = out.getContext('2d');
      if (!outCtx) return { dataUrl: null, faceCount: boxes.length, faces: boxes };

      outCtx.fillStyle = '#1E0D13';
      outCtx.fillRect(0, 0, 480, 480);
      outCtx.drawImage(frameCanvas, sx, sy, sw, sh, 0, 0, 480, 480);

      return {
        dataUrl: out.toDataURL('image/webp', 0.88),
        faceCount: boxes.length,
        faces: boxes,
      };
    },
    [ensureLandmarker]
  );

  const startMonitor = useCallback(async (): Promise<boolean> => {
    if (isMonitoring && streamRef.current) return true;
    setIsStarting(true);
    setMonitorError(null);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'window',
          frameRate: { ideal: 10, max: 15 },
        },
        audio: false,
      });

      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();

      const track = stream.getVideoTracks()[0];
      track.addEventListener('ended', () => {
        stopMonitor();
      });

      streamRef.current = stream;
      videoElRef.current = video;
      setIsMonitoring(true);
      setMonitorStatus('Monitor Zoom Aktif • Mengkalibrasi...');

      // Muat model MediaPipe dan kalibrasi baseline wajah Host awal (jika sedang sendiri di room)
      await ensureLandmarker();
      setTimeout(async () => {
        const res = await extractBestFaceFromCurrentFrame(false);
        if (res.faces.length === 1) {
          hostBaselineRef.current = { cx: res.faces[0].cx, cy: res.faces[0].cy };
          setMonitorStatus('Monitor Zoom Aktif • Menunggu kandidat masuk...');
        } else {
          setMonitorStatus('Monitor Zoom Aktif • Siap auto-capture');
        }
      }, 800);

      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Izin monitor layar dibatalkan.';
      if (!msg.toLowerCase().includes('cancel') && !msg.toLowerCase().includes('abort')) {
        setMonitorError('Gagal memulai Monitor Zoom: ' + msg);
      }
      setIsMonitoring(false);
      return false;
    } finally {
      setIsStarting(false);
    }
  }, [isMonitoring, stopMonitor, ensureLandmarker, extractBestFaceFromCurrentFrame]);

  // Capture sekali klik (baik saat monitor sudah aktif maupun langsung nyalakan dulu)
  const captureNowForRecord = useCallback(
    async (recordId: string): Promise<boolean> => {
      let active = isMonitoring && Boolean(videoElRef.current);
      if (!active) {
        active = await startMonitor();
        if (!active) return false;
        // Beri jeda sejenak agar frame video perdana siap digambar
        await new Promise((r) => setTimeout(r, 600));
      }

      isUploadingRef.current = true;
      setMonitorStatus('Mengambil snapshot wajah dari Zoom...');
      try {
        const { dataUrl } = await extractBestFaceFromCurrentFrame(true);
        if (!dataUrl) {
          setMonitorError('Frame jendela Zoom belum tersedia. Pastikan jendela Zoom tidak di-minimize.');
          return false;
        }
        capturedIdsRef.current.add(recordId);
        await onCaptureZoomSnapshot(recordId, dataUrl);
        setMonitorStatus('Snapshot Zoom berhasil tersimpan!');
        return true;
      } finally {
        isUploadingRef.current = false;
      }
    },
    [isMonitoring, startMonitor, extractBestFaceFromCurrentFrame, onCaptureZoomSnapshot]
  );

  // Loop latar belakang: otomatis mendeteksi wajah di Zoom saat ada kandidat target yang belum punya zoom_snapshot_url
  useEffect(() => {
    if (!isMonitoring) return;

    const timer = setInterval(async () => {
      if (isUploadingRef.current) return;
      if (!targetRecord || targetRecord.zoom_snapshot_url || capturedIdsRef.current.has(targetRecord.id)) {
        return;
      }

      // Tunggu minimal 6 detik sejak kandidat diverifikasi/diizinkan agar punya waktu membuka Zoom
      const refTime = targetRecord.decided_at || targetRecord.created_at;
      const elapsedSec = (Date.now() - new Date(refTime).getTime()) / 1000;
      if (elapsedSec < 6) {
        setMonitorStatus(`Menunggu ${targetRecord.full_name} masuk ke Zoom...`);
        return;
      }

      const { dataUrl, faceCount, faces } = await extractBestFaceFromCurrentFrame(false);
      setLastDetectedFaceCount(faceCount);

      if (faceCount === 0 || !dataUrl) {
        setMonitorStatus(`Memantau Zoom (${targetRecord.full_name}) • Belum ada wajah terdeteksi`);
        stableHitsRef.current = { recordId: targetRecord.id, count: 0 };
        return;
      }

      // Jika hanya 1 wajah dan persis di posisi baseline Host sesaat monitor baru dinyalakan, tunggu wajah baru atau perubahan posisi
      if (faceCount === 1 && hostBaselineRef.current && elapsedSec < 12) {
        const dist = Math.hypot(
          faces[0].cx - hostBaselineRef.current.cx,
          faces[0].cy - hostBaselineRef.current.cy
        );
        if (dist < 0.05) {
          setMonitorStatus(`Menunggu kamera ${targetRecord.full_name} menyala di Zoom...`);
          return;
        }
      }

      if (stableHitsRef.current.recordId === targetRecord.id) {
        stableHitsRef.current.count += 1;
      } else {
        stableHitsRef.current = { recordId: targetRecord.id, count: 1 };
      }

      if (stableHitsRef.current.count >= 2) {
        isUploadingRef.current = true;
        capturedIdsRef.current.add(targetRecord.id);
        setMonitorStatus(`Auto-capturing wajah ${targetRecord.full_name} dari Zoom...`);
        try {
          await onCaptureZoomSnapshot(targetRecord.id, dataUrl);
          setMonitorStatus(`Tersimpan otomatis: ${targetRecord.full_name}`);
        } catch (err) {
          console.warn('Auto zoom capture failed:', err);
          capturedIdsRef.current.delete(targetRecord.id);
        } finally {
          isUploadingRef.current = false;
          stableHitsRef.current = { recordId: '', count: 0 };
        }
      } else {
        setMonitorStatus(`Wajah terdeteksi (${faceCount}) • Mengonfirmasi auto-capture...`);
      }
    }, 1800);

    return () => clearInterval(timer);
  }, [isMonitoring, targetRecord, extractBestFaceFromCurrentFrame, onCaptureZoomSnapshot]);

  // Bersihkan resource saat komponen unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return {
    isMonitoring,
    isStarting,
    monitorStatus,
    monitorError,
    lastDetectedFaceCount,
    startMonitor,
    stopMonitor,
    captureNowForRecord,
  };
}
