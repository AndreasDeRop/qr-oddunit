import test from "node:test";
import assert from "node:assert/strict";
import { Matrix3, PerspectiveCamera, Vector3 } from "three";
import QRCode from "qrcode";
import { cameraFov, fitVideoPoint, isMatchingQrData, markerPoseMatrix, MarkerTracker, validCorners } from "../lib/ar/marker-tracking.ts";
import { detectQr } from "../lib/ar/qr-detector.ts";

const square = [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }, { x: 100, y: 300 }];
const shifted = (x, y = 0) => square.map((p) => ({ x: p.x + x, y: p.y + y }));
const close = (actual, expected, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);

test("all four QR corners stay attached across perspective, roll and mobile cropping", () => {
  const cases = [square,
    [{ x: 120, y: 90 }, { x: 340, y: 145 }, { x: 300, y: 360 }, { x: 165, y: 290 }],
    [{ x: 350, y: 90 }, { x: 390, y: 260 }, { x: 140, y: 345 }, { x: 100, y: 190 }],
    [{ x: 400, y: 340 }, { x: 160, y: 350 }, { x: 130, y: 100 }, { x: 340, y: 120 }]
  ];
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390], [320, 568]]) {
    const fov = cameraFov(1280, 720, width, height);
    const camera = new PerspectiveCamera(fov, width / height, .01, 1000);
    for (const original of cases) {
      const corners = original.map((point) => fitVideoPoint(point, 640, 360, width, height));
      const matrix = markerPoseMatrix(corners, width, height, fov);
      assert.ok(matrix);
      const local = [[-.5, .5], [.5, .5], [.5, -.5], [-.5, -.5]];
      local.forEach(([x, y], i) => {
        const projected = new Vector3(x, y, 0).applyMatrix4(matrix).project(camera);
        close((projected.x + 1) * width / 2, corners[i].x);
        close((1 - projected.y) * height / 2, corners[i].y);
      });
      assert.ok(matrix.determinant() > 0, "logo must not be mirrored");
    }
  }
});

test("front-facing logo stays upright and depth protrudes towards the viewer", () => {
  const pose = markerPoseMatrix(square, 400, 400);
  const origin = new Vector3().applyMatrix4(pose);
  const top = new Vector3(0, .5, 0).applyMatrix4(pose);
  const front = new Vector3(0, 0, .2).applyMatrix4(pose);
  assert.ok(top.y > origin.y);
  assert.ok(front.z > origin.z);
});

test("invalid, mirrored, collapsed and non-finite detections are rejected", () => {
  for (const corners of [[square[0], square[2], square[1], square[3]], [...square].reverse(),
    square.map(() => ({ x: 1, y: 1 })), square.map((p) => ({ x: NaN, y: p.y }))]) {
    assert.equal(validCorners(corners), false);
    assert.equal(markerPoseMatrix(corners, 400, 400), null);
  }
});

test("marker identity uses complete QR/experience paths and supports distinct print slugs", () => {
  const slugs = ["printed-card", "logo-experience"];
  for (const path of ["https://qr.oddunit.be/q/printed-card", "https://qr.oddunit.be/x/logo-experience/?demo=1"])
    assert.equal(isMatchingQrData(path, slugs), true);
  for (const path of ["https://qr.oddunit.be/q/printed-card-2", "https://other.test/printed-card",
    "text printed-card", "https://other.test/?next=/q/printed-card", "javascript:/q/printed-card", "https://a.test/q/%bad"])
    assert.equal(isMatchingQrData(path, slugs), false);
});

test("successive frames move the anchor, with bounded prediction and no permanent lock", () => {
  const tracker = new MarkerTracker();
  tracker.update(square, 100);
  tracker.update(shifted(10, 5), 133);
  close(tracker.sample(133)[0].x, 110);
  assert.ok(tracker.sample(149)[0].x > 110);
  close(tracker.sample(230)[0].x, tracker.sample(165)[0].x);
  assert.equal(tracker.sample(283), null);
  tracker.update(shifted(250), 300);
  close(tracker.sample(300)[0].x, 350);
  tracker.reset();
  assert.equal(tracker.sample(301), null);
});

test("stationary jitter is reduced without delaying real motion or accepting old worker results", () => {
  const tracker = new MarkerTracker();
  tracker.update(square, 10);
  tracker.update(shifted(.25), 43);
  assert.ok(tracker.sample(43)[0].x < 100.25);
  assert.ok(tracker.sample(43)[0].x > 100);
  tracker.update(shifted(30), 76);
  close(tracker.sample(76)[0].x, 130);
  assert.equal(tracker.update(square, 42), false);
  close(tracker.sample(76)[0].x, 130);
});

function qrFrame(transform, capturedAt = 100, value = "https://qr.oddunit.be/q/printed-card", inverted = false) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "H" });
  const cells = qr.modules.size + 8;
  const width = 640, height = 480;
  const pixels = new Uint8ClampedArray(width * height * 4);
  const inverse = transform.clone().invert();
  const p = new Vector3();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    p.set(x + .5, y + .5, 1).applyMatrix3(inverse);
    const col = Math.floor(p.x / p.z * cells) - 4, row = Math.floor(p.y / p.z * cells) - 4;
    const dark = col >= 0 && col < qr.modules.size && row >= 0 && row < qr.modules.size && qr.modules.get(row, col);
    const color = Boolean(dark) !== inverted ? 0 : 255;
    const i = (y * width + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = color;
    pixels[i + 3] = 255;
  }
  return { pixels, width, height, capturedAt, slugs: ["printed-card", "logo-experience"] };
}

test("real QR pixels decode through moving, scaled, rotated and perspective frames", () => {
  const transforms = [
    new Matrix3().set(240, 0, 90, 0, 240, 90, 0, 0, 1),
    new Matrix3().set(265, -40, 150, 40, 265, 70, 0, 0, 1),
    new Matrix3().set(270, 30, 160, 15, 260, 90, .16, .08, 1),
    new Matrix3().set(180, 0, 400, 0, 180, 160, 0, 0, 1)
  ];
  let previous = null;
  for (const [i, transform] of transforms.entries()) {
    const frame = qrFrame(transform, 100 + i * 33);
    const result = detectQr(frame, previous);
    assert.ok(result.corners, `QR frame ${i} should decode, including ROI fallback`);
    assert.equal(result.wrongQr, false);
    const modules = QRCode.create("https://qr.oddunit.be/q/printed-card", { errorCorrectionLevel: "H" }).modules.size;
    const inset = 4 / (modules + 8);
    [[inset, inset], [1 - inset, inset], [1 - inset, 1 - inset], [inset, 1 - inset]].forEach(([x, y], index) => {
      const expected = new Vector3(x, y, 1).applyMatrix3(transform);
      close(result.corners[index].x, expected.x / expected.z, 5);
      close(result.corners[index].y, expected.y / expected.z, 5);
    });
    previous = result.corners;
  }
});

test("inverted codes work; another QR and an empty frame cannot keep a false lock", () => {
  const transform = new Matrix3().set(270, 0, 100, 0, 270, 100, 0, 0, 1);
  assert.ok(detectQr(qrFrame(transform, 100, undefined, true), null).corners);
  const wrong = detectQr(qrFrame(transform, 133, "https://qr.oddunit.be/q/someone-else"), square);
  assert.equal(wrong.wrongQr, true);
  assert.equal(wrong.corners, null);
  const blank = qrFrame(transform);
  blank.pixels.fill(255);
  assert.equal(detectQr(blank, square).corners, null);
});
