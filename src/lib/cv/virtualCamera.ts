const VIRTUAL_CAMERA_PATTERNS = [
  /obs/i,
  /virtual/i,
  /manycam/i,
  /splitcam/i,
  /vcam/i,
  /droidcam/i,
  /iriun/i,
  /fake/i,
  /camo/i,
  /epoccam/i,
  /snap camera/i,
  /xsplit/i,
  /prism/i,
  /\bndi\b/i,
  /loopback/i,
  /mmhmm/i,
  /chromacam/i,
  /youcam/i,
];

export interface VirtualCameraCheckResult {
  isVirtual: boolean;
  deviceName?: string;
  matchedPattern?: string;
  detectionSource?: 'label' | 'track_settings';
  devicesFound: { deviceId: string; label: string }[];
}

export function isVirtualCameraLabel(label: string | null | undefined): {
  isVirtual: boolean;
  matchedPattern?: string;
} {
  if (!label) return { isVirtual: false };
  for (const pattern of VIRTUAL_CAMERA_PATTERNS) {
    if (pattern.test(label)) {
      return {
        isVirtual: true,
        matchedPattern: pattern.toString(),
      };
    }
  }
  return { isVirtual: false };
}

/**
 * Heuristik tambahan pada MediaStreamTrack yang aktif selain pencocokan string label.
 */
export function analyzeVideoTrackVirtualSignals(
  track: MediaStreamTrack | null | undefined
): { isVirtual: boolean; reason?: string; deviceName?: string } {
  if (!track) return { isVirtual: false };

  const labelCheck = isVirtualCameraLabel(track.label);
  if (labelCheck.isVirtual) {
    return {
      isVirtual: true,
      deviceName: track.label,
      reason: `Label driver cocok (${labelCheck.matchedPattern}): ${track.label}`,
    };
  }

  try {
    const settings = track.getSettings ? track.getSettings() : {};
    // Pada beberapa driver feed sintetis, stream video aktif tidak memiliki frameRate sama sekali atau bernilai 0
    if (typeof settings.frameRate === 'number' && settings.frameRate <= 0) {
      return {
        isVirtual: true,
        deviceName: track.label || 'Unknown Feed',
        reason: 'Sinyal frameRate stream video tidak wajar (0 FPS).',
      };
    }
  } catch {
    // Abaikan jika browser membatasi getSettings
  }

  return { isVirtual: false };
}

export async function checkVirtualCamera(
  activeTrack?: MediaStreamTrack | null
): Promise<VirtualCameraCheckResult> {
  if (activeTrack) {
    const trackAnalysis = analyzeVideoTrackVirtualSignals(activeTrack);
    if (trackAnalysis.isVirtual) {
      return {
        isVirtual: true,
        deviceName: trackAnalysis.deviceName || activeTrack.label || 'Virtual Camera Driver',
        matchedPattern: trackAnalysis.reason,
        detectionSource: 'track_settings',
        devicesFound: [
          {
            deviceId: activeTrack.getSettings?.().deviceId || 'active',
            label: activeTrack.label || 'Active Video Track',
          },
        ],
      };
    }
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
    return {
      isVirtual: false,
      devicesFound: [],
    };
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((d) => d.kind === 'videoinput');

    const devicesFound = videoDevices.map((d) => ({
      deviceId: d.deviceId,
      label: d.label || 'Default Camera',
    }));

    for (const dev of videoDevices) {
      const label = dev.label;
      if (!label) continue;

      const labelCheck = isVirtualCameraLabel(label);
      if (labelCheck.isVirtual) {
        return {
          isVirtual: true,
          deviceName: label,
          matchedPattern: labelCheck.matchedPattern,
          detectionSource: 'label',
          devicesFound,
        };
      }
    }

    return {
      isVirtual: false,
      devicesFound,
    };
  } catch (err) {
    console.warn('Error enumerating media devices:', err);
    return {
      isVirtual: false,
      devicesFound: [],
    };
  }
}
