import { useState, useEffect, useRef, useCallback } from 'react';

export interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  startCamera: () => Promise<boolean>;
  stopCamera: () => void;
  activeDeviceId: string | null;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, [stream]);

  const startCamera = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Peramban web Anda tidak mendukung akses kamera (getUserMedia).');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().then(() => {
                setIsStreaming(true);
                setIsLoading(false);
                resolve();
              });
            };
          }
        });
      }

      const videoTrack = mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        const settings = videoTrack.getSettings();
        setActiveDeviceId(settings.deviceId || null);
      }

      return true;
    } catch (err: unknown) {
      const e = err as Error;
      let errorMsg = 'Gagal mengakses kamera.';
      if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
        errorMsg = 'Izin akses kamera ditolak. Harap izinkan akses kamera pada browser Anda.';
      } else if (e.name === 'NotFoundError' || e.name === 'DevicesNotFoundError') {
        errorMsg = 'Tidak ada perangkat kamera yang ditemukan pada perangkat Anda.';
      } else if (e.name === 'NotReadableError' || e.name === 'TrackStartError') {
        errorMsg = 'Kamera sedang digunakan oleh aplikasi lain (misal Zoom/Meet/OBS).';
      } else {
        errorMsg = e.message || errorMsg;
      }
      setError(errorMsg);
      setIsLoading(false);
      setIsStreaming(false);
      return false;
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  return {
    videoRef,
    stream,
    isStreaming,
    isLoading,
    error,
    startCamera,
    stopCamera,
    activeDeviceId,
  };
}
