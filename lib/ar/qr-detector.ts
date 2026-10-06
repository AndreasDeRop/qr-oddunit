import jsQR from "jsqr";
import { isMatchingQrData, validCorners, type QrCorners } from "./marker-tracking.ts";

export type ScanRequest = {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  capturedAt: number;
  slugs: string[];
};
export type ScanResult = {
  corners: QrCorners | null;
  capturedAt: number;
  width: number;
  height: number;
  wrongQr: boolean;
};

export function detectQr(frame: ScanRequest, previous: QrCorners | null): ScanResult {
  const { pixels, width, height, capturedAt, slugs } = frame;
  let code: ReturnType<typeof jsQR> = null;
  let offsetX = 0, offsetY = 0;
  if (previous) {
    const xs = previous.map((p) => p.x), ys = previous.map((p) => p.y);
    const margin = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) * .4;
    offsetX = Math.max(0, Math.floor(Math.min(...xs) - margin));
    offsetY = Math.max(0, Math.floor(Math.min(...ys) - margin));
    const cropWidth = Math.min(width, Math.ceil(Math.max(...xs) + margin)) - offsetX;
    const cropHeight = Math.min(height, Math.ceil(Math.max(...ys) + margin)) - offsetY;
    if (cropWidth > 0 && cropHeight > 0) {
      const crop = new Uint8ClampedArray(cropWidth * cropHeight * 4);
      for (let y = 0; y < cropHeight; y++) {
        const start = ((offsetY + y) * width + offsetX) * 4;
        crop.set(pixels.subarray(start, start + cropWidth * 4), y * cropWidth * 4);
      }
      code = jsQR(crop, cropWidth, cropHeight, { inversionAttempts: "attemptBoth" });
    }
  }
  if (!code || !isMatchingQrData(code.data, slugs)) {
    offsetX = offsetY = 0;
    code = jsQR(pixels, width, height, { inversionAttempts: "attemptBoth" });
  }
  const wrongQr = Boolean(code && !isMatchingQrData(code.data, slugs));
  let corners: QrCorners | null = code && !wrongQr ? [
    code.location.topLeftCorner, code.location.topRightCorner,
    code.location.bottomRightCorner, code.location.bottomLeftCorner
  ].map((p) => ({ x: p.x + offsetX, y: p.y + offsetY })) as QrCorners : null;
  if (corners && !validCorners(corners)) corners = null;
  return { corners, width, height, capturedAt, wrongQr };
}
