"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import Link from "next/link";
import { ArrowUpRight, Camera, Loader2, ScanQrCode } from "lucide-react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { cameraFov, fitVideoPoint, markerPoseMatrix, MarkerTracker, type QrCorners } from "@/lib/ar/marker-tracking";
import type { ScanResult } from "@/lib/ar/qr-detector";
import type { AnalyticsEventType, PublicExperience } from "@/lib/types";

type TrackerState = "loading" | "starting" | "searching" | "tracking" | "permission" | "unsupported" |
  "camera-error" | "model-error" | "tracking-error" | "unavailable";

const statusCopy: Record<TrackerState, string> = {
  loading: "AR laden", starting: "Camera starten", searching: "Richt je camera op de QR-code",
  tracking: "Logo volgt de QR-code", permission: "Geef toegang tot je camera", unsupported: "Camera niet beschikbaar",
  "camera-error": "Camera kon niet starten", "model-error": "3D-logo kon niet laden",
  "tracking-error": "AR kon niet starten", unavailable: "Deze AR-ervaring is niet beschikbaar"
};
const recoveryCopy: Partial<Record<TrackerState, string>> = {
  permission: "Sta cameratoegang toe in je browserinstellingen en probeer opnieuw.",
  unsupported: "Open deze pagina via HTTPS in Safari of Chrome op je telefoon.",
  "camera-error": "Sluit andere apps die je camera gebruiken en probeer opnieuw.",
  "model-error": "Controleer je internetverbinding en laad het logo opnieuw.",
  "tracking-error": "Je browser kon de AR-weergave niet openen. Probeer opnieuw of open de pagina in Safari of Chrome.",
  unavailable: "De QR-code is mogelijk gepauzeerd of de verbinding is onderbroken. Probeer opnieuw."
};

function trackEvent(slug: string, event: AnalyticsEventType) {
  const body = JSON.stringify({ event });
  const endpoint = `/api/analytics/${encodeURIComponent(slug)}`;
  if (navigator.sendBeacon?.(endpoint, new Blob([body], { type: "application/json" }))) return;
  void fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
}

function disposeObject(object: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
      material.dispose();
    }
  });
  textures.forEach((texture) => texture.dispose());
}

/** Normalize in a parent so authored GLTF node transforms remain intact. */
function fitModel(object: THREE.Object3D) {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const extent = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(extent) || extent < 1e-6) throw new Error("Empty model");
  const centered = new THREE.Group();
  centered.add(object);
  centered.position.set(-center.x, -center.y, -bounds.min.z);
  const fitted = new THREE.Group();
  fitted.add(centered);
  fitted.scale.setScalar(1 / extent);
  return fitted;
}

export function ArExperience({ slug = "oddunit-card", cameraSource }: {
  slug?: string;
  /** Used by the development-only camera fixture, never selected by URL input. */
  cameraSource?: () => Promise<MediaStream>;
}) {
  const [experience, setExperience] = useState<PublicExperience | null>(null);
  const [trackerState, setTrackerState] = useState<TrackerState>("loading");
  const [attempt, setAttempt] = useState(0);
  const stageRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitTestRef = useRef<((x: number, y: number) => boolean) | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/experiences/${encodeURIComponent(slug)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Experience unavailable");
        const payload = await response.json() as PublicExperience;
        if (!controller.signal.aborted) setExperience(payload);
      } catch {
        if (!controller.signal.aborted) setTrackerState("unavailable");
      }
    }
    void load();
    return () => controller.abort();
  }, [slug, attempt]);

  useEffect(() => {
    const stage = stageRef.current, video = videoRef.current, canvas = canvasRef.current;
    if (!experience || !stage || !video || !canvas) return;
    let disposed = false, failed = false;
    let frameId = 0, videoFrameId = 0;
    let stream: MediaStream | null = null;
    let worker: Worker | null = null;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let anchor: THREE.Group | null = null;
    let content: THREE.Group | null = null;
    let state: TrackerState = "loading";
    let busy = false, lastScanAt = -Infinity, lastVideoTime = -1;
    let scanWidth = 1, scanHeight = 1;
    let appearedAt = 0, trackedOnce = false;
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reducedMotion = motionPreference.matches;
    const tracker = new MarkerTracker();
    const scanCanvas = document.createElement("canvas");
    const scanContext = scanCanvas.getContext("2d", { willReadFrequently: true });
    const analyticsSlug = experience.qrSlugs?.[0] || slug;
    const markerSlugs = [...new Set([slug, experience.slug, ...(experience.qrSlugs || [])])];
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function applyState(next: TrackerState) {
      if (!disposed && state !== next) { state = next; setTrackerState(next); }
    }
    function release() {
      window.cancelAnimationFrame(frameId);
      if (videoFrameId) video!.cancelVideoFrameCallback?.(videoFrameId);
      worker?.terminate();
      worker = null;
      stream?.getTracks().forEach((track) => track.stop());
      if (video!.srcObject === stream) video!.srcObject = null;
      stream = null;
      if (scene) disposeObject(scene);
      scene = null;
      renderer?.dispose();
      renderer = null;
      canvas!.width = canvas!.height = 1;
      hitTestRef.current = null;
      tracker.reset();
    }
    function fail(next: TrackerState) {
      if (disposed || failed) return;
      failed = true;
      applyState(next);
      release();
    }
    function resize() {
      if (!renderer || !camera || !video!.videoWidth) return;
      const width = Math.max(stage!.clientWidth, 1), height = Math.max(stage!.clientHeight, 1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = cameraFov(video!.videoWidth, video!.videoHeight, width, height);
      camera.updateProjectionMatrix();
    }
    function scan(now: number) {
      if (disposed || failed || document.hidden || busy || !worker || !scanContext ||
          video!.readyState < 2 || !video!.videoWidth || now - lastScanAt < 30 || video!.currentTime === lastVideoTime) return;
      const scale = Math.min(1, 960 / Math.max(video!.videoWidth, video!.videoHeight));
      const width = Math.round(video!.videoWidth * scale), height = Math.round(video!.videoHeight * scale);
      if (scanCanvas.width !== width || scanCanvas.height !== height) {
        scanCanvas.width = width;
        scanCanvas.height = height;
        scanWidth = width;
        scanHeight = height;
        tracker.reset();
        resize();
      }
      try {
        scanContext.drawImage(video!, 0, 0, width, height);
        const { data } = scanContext.getImageData(0, 0, width, height);
        busy = true;
        lastScanAt = now;
        lastVideoTime = video!.currentTime;
        worker.postMessage({ pixels: data, width, height, capturedAt: now, slugs: markerSlugs }, [data.buffer]);
      } catch { fail("tracking-error"); }
    }
    function onVideoFrame(now: number) {
      if (disposed || failed) return;
      scan(now);
      videoFrameId = video!.requestVideoFrameCallback(onVideoFrame);
    }
    function render(now: number) {
      if (disposed || failed || !renderer || !scene || !camera || !anchor || !content) return;
      if (typeof video!.requestVideoFrameCallback !== "function") scan(now);
      const measured = document.hidden ? null : tracker.sample(now);
      const corners = measured?.map((p) => fitVideoPoint(p, scanWidth, scanHeight, stage!.clientWidth, stage!.clientHeight)) as QrCorners | undefined;
      const pose = corners ? markerPoseMatrix(corners, stage!.clientWidth, stage!.clientHeight, camera.fov) : null;
      if (pose) {
        if (!anchor.visible) appearedAt = now;
        anchor.visible = true;
        anchor.matrix.copy(pose);
        anchor.matrixWorldNeedsUpdate = true;
        // Appearance is marker-local; the anchor always follows the QR.
        const entrance = reducedMotion ? 1 : Math.min((now - appearedAt) / 350, 1);
        const ease = 1 - Math.pow(1 - entrance, 3);
        content.scale.setScalar(.86 * THREE.MathUtils.clamp(experience!.arScale ?? 1, .35, 2.4));
        content.scale.z *= experience!.arPlacement === "horizontal-rise" ? Math.max(.001, ease) : 1;
        // No independent wobble: orientation comes entirely from the QR marker.
        content.rotation.set(0, 0, 0);
        applyState("tracking");
        if (!trackedOnce) { trackedOnce = true; trackEvent(analyticsSlug, "marker_lock"); }
      } else {
        anchor.visible = false;
        applyState("searching");
      }
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(render);
    }
    const resizeObserver = new ResizeObserver(resize);
    function onVisibility() {
      tracker.reset();
      if (anchor) anchor.visible = false;
      stream?.getVideoTracks().forEach((track) => { track.enabled = !document.hidden; });
    }
    function onMotionChange(event: MediaQueryListEvent) { reducedMotion = event.matches; }
    function onContextLost(event: Event) { event.preventDefault(); fail("tracking-error"); }
    function onPageHide() { fail("camera-error"); }

    async function start() {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { fail("unsupported"); return; }
      applyState("starting");
      let phase: TrackerState = "camera-error";
      try {
        const acquired = await (cameraSource ? cameraSource() : navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 60 } }
        }));
        if (disposed || failed) { acquired.getTracks().forEach((track) => track.stop()); return; }
        stream = acquired;
        video!.srcObject = stream;
        stream.getVideoTracks().forEach((track) => track.addEventListener("ended", () => fail("camera-error"), { once: true }));
        await video!.play();
        if (disposed || failed) return;
        phase = "tracking-error";
        if (!scanContext) throw new Error("Canvas unavailable");
        worker = new Worker(new URL("../../lib/ar/qr-tracker.worker.ts", import.meta.url));
        worker.onmessage = ({ data }: MessageEvent<ScanResult>) => {
          busy = false;
          if (disposed || failed || document.hidden || data.width !== scanWidth || data.height !== scanHeight) return;
          if (data.wrongQr) tracker.reset();
          else if (data.corners) tracker.update(data.corners, data.capturedAt);
        };
        worker.onerror = () => fail("tracking-error");
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, canvas: canvas!, powerPreference: "high-performance" });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        scene = new THREE.Scene();
        camera = new THREE.PerspectiveCamera(52, 1, .01, 1000);
        scene.add(new THREE.AmbientLight(0xffffff, 2.2));
        const light = new THREE.DirectionalLight(0xffffff, 2.8);
        light.position.set(2, 4, 5);
        scene.add(light);
        anchor = new THREE.Group();
        anchor.matrixAutoUpdate = false;
        anchor.visible = false;
        scene.add(anchor);
        phase = "model-error";
        const gltf = await new GLTFLoader().loadAsync(experience!.modelUrl);
        if (disposed || failed) { disposeObject(gltf.scene); return; }
        anchor.add(gltf.scene);
        const fitted = fitModel(gltf.scene);
        content = new THREE.Group();
        content.add(fitted);
        anchor.add(content);
        hitTestRef.current = (x, y) => {
          if (!anchor?.visible || !camera || !tracker.sample(performance.now())) return false;
          pointer.set(x / stage!.clientWidth * 2 - 1, 1 - y / stage!.clientHeight * 2);
          raycaster.setFromCamera(pointer, camera);
          return raycaster.intersectObject(anchor, true).length > 0;
        };
        resize();
        resizeObserver.observe(stage!);
        video!.addEventListener("resize", resize);
        canvas!.addEventListener("webglcontextlost", onContextLost);
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("pagehide", onPageHide);
        motionPreference.addEventListener("change", onMotionChange);
        applyState("searching");
        if (typeof video!.requestVideoFrameCallback === "function") videoFrameId = video!.requestVideoFrameCallback(onVideoFrame);
        frameId = window.requestAnimationFrame(render);
      } catch (error) {
        const name = error instanceof DOMException ? error.name : "";
        fail(name === "NotAllowedError" || name === "SecurityError" ? "permission" : phase);
      }
    }
    void start();
    return () => {
      disposed = true;
      resizeObserver.disconnect();
      video.removeEventListener("resize", resize);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      motionPreference.removeEventListener("change", onMotionChange);
      release();
    };
  }, [experience, slug, cameraSource]);

  function retry() {
    setExperience(null);
    setTrackerState("loading");
    setAttempt((value) => value + 1);
  }
  function onStageClick(event: MouseEvent<HTMLElement>) {
    if (!experience || (event.target as HTMLElement).closest("button, a")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (hitTestRef.current?.(event.clientX - rect.left, event.clientY - rect.top)) {
      trackEvent(experience.qrSlugs?.[0] || slug, "cta_click");
      window.location.assign(experience.destinationUrl);
    }
  }
  const recovery = recoveryCopy[trackerState];
  return (
    <main className="experience-page">
      <h1 className="sr-only">{experience?.title || "QR-logo in augmented reality"}</h1>
      <header className="experience-toolbar ar-toolbar">
        <Link className="experience-brand" href="/" aria-label="OddUnit QR+AR — home">
          <img className="experience-logo" src={experience?.logoUrl || "/logos/logo-black-studio.svg"} alt={experience?.title || "OddUnit Studio"} />
        </Link>
        {experience ? (
          <a className="button compact" href={experience.destinationUrl} onClick={() => trackEvent(experience.qrSlugs?.[0] || slug, "cta_click")}>
            <ArrowUpRight size={17} aria-hidden="true" />{experience.ctaLabel}
          </a>
        ) : null}
      </header>
      <section className="ar-camera-stage" ref={stageRef} onClick={onStageClick} aria-label="AR-camera">
        <video className="ar-camera-feed" ref={videoRef} playsInline muted autoPlay aria-hidden="true" />
        <canvas className="ar-render-canvas" ref={canvasRef} aria-hidden="true" />
        {trackerState === "searching" ? <div className="ar-guide" aria-hidden="true"><ScanQrCode strokeWidth={.7} /></div> : null}
        {recovery ? (
          <div className="ar-recovery" role="alert">
            <Camera size={28} aria-hidden="true" />
            <h2>{statusCopy[trackerState]}</h2>
            <p>{recovery}</p>
            <button className="button primary" type="button" onClick={retry}>Opnieuw proberen</button>
            <Link href="/">Terug naar de website</Link>
          </div>
        ) : null}
        {!recovery ? <div className={`ar-status ${trackerState}`} role="status" aria-live="polite" aria-atomic="true">
          {trackerState === "loading" || trackerState === "starting" ? <Loader2 className="spin" size={17} aria-hidden="true" /> : <ScanQrCode size={17} aria-hidden="true" />}
          <span>{statusCopy[trackerState]}</span>
        </div> : null}
        {trackerState === "searching" ? <p className="ar-hint">Houd de volledige QR-code in beeld, met voldoende licht.</p> : null}
      </section>
    </main>
  );
}
