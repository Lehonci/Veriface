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
];

export interface VirtualCameraCheckResult {
  isVirtual: boolean;
  deviceName?: string;
  matchedPattern?: string;
  devicesFound: { deviceId: string; label: string }[];
}

export async function checkVirtualCamera(): Promise<VirtualCameraCheckResult> {
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

      for (const pattern of VIRTUAL_CAMERA_PATTERNS) {
        if (pattern.test(label)) {
          return {
            isVirtual: true,
            deviceName: label,
            matchedPattern: pattern.toString(),
            devicesFound,
          };
        }
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
