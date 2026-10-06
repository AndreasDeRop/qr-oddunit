import { Matrix4, Vector3 } from "three";

export type Point2 = { x: number; y: number };
/** QR orientation, not screen order: top left, top right, bottom right, bottom left. */
export type QrCorners = [Point2, Point2, Point2, Point2];
export const TRACKING_TIMEOUT_MS = 150;
export const CAMERA_FOV = 52;

export function isMatchingQrData(data: string, slugs: string[]) {
  try {
    const url = new URL(data);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const match = /^\/(q|x)\/([^/]+)\/?$/.exec(url.pathname);
    return Boolean(match && slugs.includes(decodeURIComponent(match[2])));
  } catch {
    return false;
  }
}

export function fitVideoPoint(point: Point2, videoWidth: number, videoHeight: number, width: number, height: number): Point2 {
  const scale = Math.max(width / videoWidth, height / videoHeight);
  return {
    x: (width - videoWidth * scale) / 2 + point.x * scale,
    y: (height - videoHeight * scale) / 2 + point.y * scale
  };
}

/** The lens belongs to the source video; object-fit: cover does not change it. */
export function cameraFov(videoWidth: number, videoHeight: number, width: number, height: number) {
  const coverScale = Math.max(width / videoWidth, height / videoHeight);
  const focalLength = videoHeight / (2 * Math.tan(CAMERA_FOV * Math.PI / 360));
  return 360 / Math.PI * Math.atan(height / (2 * focalLength * coverScale));
}

export function validCorners(corners: QrCorners) {
  if (corners.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4], c = corners[(i + 2) % 4];
    // Reject mirrored, self-intersecting, degenerate and implausibly thin detections.
    if ((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) <= 1) return false;
    if (Math.hypot(b.x - a.x, b.y - a.y) < 8) return false;
    area += a.x * b.y - b.x * a.y;
  }
  return area > 128;
}

function solve(matrix: number[][], values: number[]) {
  const rows = matrix.map((row, i) => [...row, values[i]]);
  for (let c = 0; c < values.length; c++) {
    let pivot = c;
    for (let r = c + 1; r < values.length; r++) {
      if (Math.abs(rows[r][c]) > Math.abs(rows[pivot][c])) pivot = r;
    }
    if (Math.abs(rows[pivot][c]) < 1e-10) return null;
    [rows[c], rows[pivot]] = [rows[pivot], rows[c]];
    const divisor = rows[c][c];
    for (let j = c; j <= values.length; j++) rows[c][j] /= divisor;
    for (let r = 0; r < values.length; r++) {
      if (r === c) continue;
      const factor = rows[r][c];
      for (let j = c; j <= values.length; j++) rows[r][j] -= factor * rows[c][j];
    }
  }
  return rows.map((row) => row[values.length]);
}

export function markerPoseMatrix(corners: QrCorners, width: number, height: number, fov = CAMERA_FOV) {
  if (width <= 0 || height <= 0 || !validCorners(corners)) return null;
  // Model coordinates: +X right, +Y up, +Z out of the printed QR.
  const source = [[-.5, .5], [.5, .5], [.5, -.5], [-.5, -.5]];
  const rows: number[][] = [], values: number[] = [];
  source.forEach(([x, y], i) => {
    const p = corners[i];
    rows.push([x, y, 1, 0, 0, 0, -p.x * x, -p.x * y]);
    values.push(p.x);
    rows.push([0, 0, 0, x, y, 1, -p.y * x, -p.y * y]);
    values.push(p.y);
  });
  const h = solve(rows, values);
  if (!h) return null;
  h.push(1);
  const focal = height / (2 * Math.tan(fov * Math.PI / 360));
  const column = (i: number) => new Vector3(
    (h[i] - width / 2 * h[i + 6]) / focal,
    -(h[i + 3] - height / 2 * h[i + 6]) / focal,
    -h[i + 6]
  );
  const right = column(0), up = column(1), position = column(2);
  const scale = 2 / (right.length() + up.length());
  right.multiplyScalar(scale);
  up.multiplyScalar(scale);
  position.multiplyScalar(scale);
  const outward = new Vector3().crossVectors(right, up).normalize();
  // Keep the measured in-plane basis. Orthonormalizing it with guessed camera
  // intrinsics moves the logo off the QR corners, particularly on cropped phones.
  // Depth is approximate without lens calibration; the z=0 plane is exact.
  return new Matrix4().makeBasis(right, up, outward).setPosition(position);
}

/** Noise reduction at rest, fast response in motion, bounded latency compensation. */
export class MarkerTracker {
  private corners: QrCorners | null = null;
  private velocity: QrCorners | null = null;
  private seenAt = -Infinity;

  reset() {
    this.corners = null;
    this.velocity = null;
    this.seenAt = -Infinity;
  }

  update(next: QrCorners, capturedAt: number) {
    if (!validCorners(next) || capturedAt <= this.seenAt) return false;
    const dt = capturedAt - this.seenAt;
    if (!this.corners || dt >= TRACKING_TIMEOUT_MS) {
      this.corners = next.map((point) => ({ ...point })) as QrCorners;
      this.velocity = null;
    } else {
      const previous = this.corners;
      const motion = Math.max(...next.map((p, i) => Math.hypot(p.x - previous[i].x, p.y - previous[i].y)));
      // Filter only subpixel jitter. Smoothing moving corners causes visible drag.
      const alpha = Math.min(1, .45 + motion / 5);
      this.corners = next.map((p, i) => ({
        x: previous[i].x + (p.x - previous[i].x) * alpha,
        y: previous[i].y + (p.y - previous[i].y) * alpha
      })) as QrCorners;
      const side = Math.hypot(next[1].x - next[0].x, next[1].y - next[0].y);
      this.velocity = motion > side * .2 ? null : this.corners.map((p, i) => ({
        x: (p.x - previous[i].x) / Math.max(dt, 1),
        y: (p.y - previous[i].y) / Math.max(dt, 1)
      })) as QrCorners;
    }
    this.seenAt = capturedAt;
    return true;
  }

  sample(now: number): QrCorners | null {
    if (!this.corners || now - this.seenAt >= TRACKING_TIMEOUT_MS) return null;
    const lead = Math.min(Math.max(now - this.seenAt, 0), 32);
    const predicted = this.corners.map((p, i) => ({
      x: p.x + (this.velocity?.[i].x ?? 0) * lead,
      y: p.y + (this.velocity?.[i].y ?? 0) * lead
    })) as QrCorners;
    return validCorners(predicted) ? predicted : this.corners;
  }
}
