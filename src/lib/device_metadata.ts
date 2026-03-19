/**
 * Device metadata collected at photo/video capture time.
 * Replaces EXIF (which browsers strip from camera captures).
 * Stored in transaction_photos.device_metadata and transaction_evidence.
 *
 * Patent steps 401 + 402: timestamp + device ID validation
 */

export interface DeviceMetadata {
  captured_at: string;
  device_timestamp_ms: number;
  user_agent: string;
  platform: string;
  screen_width: number;
  screen_height: number;
  pixel_ratio: number;
  timezone: string;
  timezone_offset_min: number;
  language: string;
  online: boolean;
  connection_type?: string;
  camera_facing: "environment" | "user" | "unknown";
  resolution: { width: number; height: number };
  mime_type: string;
  geolocation?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null;
}

export function captureDeviceMetadata(
  cameraFacing: "environment" | "user" | "unknown" = "unknown",
  resolution: { width: number; height: number } = { width: 0, height: 0 },
  mimeType: string = "image/jpeg"
): DeviceMetadata {
  const now = new Date();
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string };
  };

  return {
    captured_at: now.toISOString(),
    device_timestamp_ms: now.getTime(),
    user_agent: navigator.userAgent,
    platform: navigator.platform ?? "unknown",
    screen_width: screen.width,
    screen_height: screen.height,
    pixel_ratio: window.devicePixelRatio ?? 1,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezone_offset_min: now.getTimezoneOffset(),
    language: navigator.language,
    online: navigator.onLine,
    connection_type: nav.connection?.effectiveType ?? undefined,
    camera_facing: cameraFacing,
    resolution,
    mime_type: mimeType,
  };
}

export async function captureDeviceMetadataWithGeo(
  cameraFacing: "environment" | "user" | "unknown" = "unknown",
  resolution: { width: number; height: number } = { width: 0, height: 0 },
  mimeType: string = "image/jpeg",
  timeoutMs: number = 3000
): Promise<DeviceMetadata> {
  const metadata = captureDeviceMetadata(cameraFacing, resolution, mimeType);
  try {
    const position = await new Promise<GeolocationPosition>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: timeoutMs,
          maximumAge: 60000,
        });
      }
    );
    metadata.geolocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
    };
  } catch {
    metadata.geolocation = null;
  }
  return metadata;
}
