import { detectQr, type ScanRequest, type ScanResult } from "./qr-detector";

let previous: ScanResult | null = null;
self.onmessage = (event: MessageEvent<ScanRequest>) => {
  const frame = event.data;
  const recent = previous && frame.capturedAt - previous.capturedAt < 150 &&
    frame.width === previous.width && frame.height === previous.height;
  const result = detectQr(frame, recent ? previous!.corners : null);
  previous = result;
  self.postMessage(result);
};
