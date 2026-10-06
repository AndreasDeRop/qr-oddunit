"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Box,
  Download,
  ExternalLink,
  FileUp,
  Palette,
  RefreshCw,
  RotateCw,
  ScanQrCode,
  SlidersHorizontal
} from "lucide-react";
import QRCode from "qrcode";
import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import { QrPreview } from "@/components/qr-preview";
import type { ArPlacement } from "@/lib/types";

type EditorSettings = {
  materialColor: string;
  backgroundColor: string;
  thickness: number;
  bevelSize: number;
  bevelSegments: number;
  metalness: number;
  roughness: number;
  scale: number;
  spinSpeed: number;
};

type ModelStats = {
  meshes: number;
  shapes: number;
  sourceName: string;
};

type BuiltModel = {
  group: THREE.Group;
  stats: ModelStats;
};

type PublishedQr = {
  slug: string;
  url: string;
  modelUrl: string;
};

const defaultSvgUrl = "/logos/logo-black-studio.svg";
const targetPreviewSize = 3.2;

const defaultSettings: EditorSettings = {
  materialColor: "#071414",
  backgroundColor: "#ff6b00",
  thickness: 0.32,
  bevelSize: 0.012,
  bevelSegments: 3,
  metalness: 0.2,
  roughness: 0.46,
  scale: 1,
  spinSpeed: 0.9
};

const arPlacementCopy: Record<ArPlacement, string> = {
  "vertical-spin": "Op QR plaatsen",
  "horizontal-rise": "Uit QR komen"
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

function shapeBounds(shapes: THREE.Shape[]) {
  const box = new THREE.Box2();

  shapes.forEach((shape) => {
    shape.getPoints(36).forEach((point) => box.expandByPoint(point));
    shape.holes.forEach((hole) => {
      hole.getPoints(36).forEach((point) => box.expandByPoint(point));
    });
  });

  return box;
}

function centerAndFit(group: THREE.Group, targetSize: number) {
  group.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());
  const maxAxis = Math.max(size.x, size.y, size.z);

  if (Number.isFinite(maxAxis) && maxAxis > 0) {
    group.scale.multiplyScalar(targetSize / maxAxis);
  }

  group.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(group);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

  group.position.sub(scaledCenter);
  group.updateMatrixWorld(true);
}

function buildSvgModel(svgText: string, sourceName: string, settings: EditorSettings): BuiltModel {
  const loader = new SVGLoader();
  const parsed = loader.parse(svgText);
  const shapes = parsed.paths.flatMap((path) => SVGLoader.createShapes(path));

  if (shapes.length === 0) {
    throw new Error("Geen gevulde vectorvormen gevonden in deze SVG.");
  }

  const bounds = shapeBounds(shapes);
  const boundsSize = bounds.getSize(new THREE.Vector2());
  const maxSvgAxis = Math.max(boundsSize.x, boundsSize.y, 1);
  const depth = maxSvgAxis * clamp(settings.thickness, 0.01, 1.2);
  const bevelSize = maxSvgAxis * clamp(settings.bevelSize, 0, 0.12);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(settings.materialColor),
    metalness: settings.metalness,
    roughness: settings.roughness,
    side: THREE.DoubleSide
  });
  const group = new THREE.Group();

  group.name = "OddUnitThicknessModel";
  group.scale.y = -1;

  shapes.forEach((shape, index) => {
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevelSize > 0,
      bevelSize,
      bevelThickness: bevelSize,
      bevelSegments: settings.bevelSegments,
      curveSegments: 16
    });

    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, material.clone());
    mesh.name = `logo-shape-${index + 1}`;
    group.add(mesh);
  });

  centerAndFit(group, targetPreviewSize * settings.scale);

  return {
    group,
    stats: {
      meshes: group.children.length,
      shapes: shapes.length,
      sourceName
    }
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFileBase(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "logo";
}

function clientSlugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function titleFromSource(name: string) {
  const base = name
    .replace(/\.[^.]+$/, "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  return base ? base.replace(/\b\w/g, (letter) => letter.toUpperCase()) : "AR Logo";
}

function autoQrSlug(name: string) {
  const base = clientSlugify(safeFileBase(name)).slice(0, 34) || "ar-logo";
  const time = Date.now().toString(36).slice(-5);
  const suffix = Math.random().toString(36).slice(2, 7);

  return clientSlugify(`${base}-${time}-${suffix}`);
}

async function readApiError(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as { error?: string } | null;
  return payload?.error || fallback;
}

export function ThicknessEditor() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const pivotRef = useRef<THREE.Group | null>(null);
  const settingsRef = useRef(defaultSettings);

  const [settings, setSettings] = useState(defaultSettings);
  const [svgText, setSvgText] = useState("");
  const [sourceName, setSourceName] = useState("logo-black-studio.svg");
  const [stats, setStats] = useState<ModelStats>({
    meshes: 0,
    shapes: 0,
    sourceName: "logo-black-studio.svg"
  });
  const [notice, setNotice] = useState("Preset laden...");
  const [exporting, setExporting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [arPlacement, setArPlacement] = useState<ArPlacement>("vertical-spin");
  const [publishedQr, setPublishedQr] = useState<PublishedQr | null>(null);
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("oddunit_qr_admin_token") || ""
  );

  const downloadName = useMemo(() => `${safeFileBase(sourceName)}-thick.gltf`, [sourceName]);
  const publicOrigin = useMemo(() => {
    if (typeof window === "undefined") {
      return "https://qr.oddunit.be";
    }

    return window.location.origin.replace(/\/$/, "");
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (token) {
      window.localStorage.setItem("oddunit_qr_admin_token", token);
    }
  }, [token]);

  const applyPreset = useCallback((text: string) => {
    setSvgText(text);
    setSourceName("logo-black-studio.svg");
    setNotice("OddUnit preset geladen.");
  }, []);

  const loadPreset = useCallback(async () => {
    setNotice("Preset laden...");

    try {
      const response = await fetch(defaultSvgUrl);

      if (!response.ok) {
        throw new Error("Preset SVG niet gevonden.");
      }

      applyPreset(await response.text());
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Preset laden is mislukt.");
    }
  }, [applyPreset]);

  useEffect(() => {
    let active = true;

    fetch(defaultSvgUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Preset SVG niet gevonden.");
        }

        return response.text();
      })
      .then((text) => {
        if (active) {
          applyPreset(text);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setNotice(error instanceof Error ? error.message : "Preset laden is mislukt.");
        }
      });

    return () => {
      active = false;
    };
  }, [applyPreset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const preview = previewRef.current;

    if (!canvas || !preview) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true
    });
    const pivot = new THREE.Group();
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
    const fillLight = new THREE.DirectionalLight(0xffffff, 1.4);
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x21312e, 2.1);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    camera.position.set(0, 0.1, 7.2);
    camera.lookAt(0, 0, 0);

    keyLight.position.set(3.5, 4.5, 6);
    fillLight.position.set(-4, -2, 5);
    scene.add(ambientLight, keyLight, fillLight, pivot);

    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    pivotRef.current = pivot;

    const resize = () => {
      const width = Math.max(preview.clientWidth, 1);
      const height = Math.max(preview.clientHeight, 1);

      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(preview);

    let animationId = 0;
    const clock = new THREE.Clock();

    const render = () => {
      const activeSettings = settingsRef.current;
      scene.background = new THREE.Color(activeSettings.backgroundColor);
      pivot.rotation.y = clock.getElapsedTime() * activeSettings.spinSpeed;
      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(render);
    };

    render();

    return () => {
      window.cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      disposeObject(pivot);
      renderer.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      pivotRef.current = null;
    };
  }, []);

  useEffect(() => {
    const pivot = pivotRef.current;

    if (!pivot || !svgText) {
      return;
    }

    let active = true;

    disposeObject(pivot);
    pivot.clear();

    try {
      const built = buildSvgModel(svgText, sourceName, settings);
      pivot.add(built.group);
      queueMicrotask(() => {
        if (active) {
          setStats(built.stats);
          setNotice(`${built.stats.shapes} vectorvormen klaar voor export.`);
        }
      });
    } catch (error) {
      queueMicrotask(() => {
        if (active) {
          setStats({
            meshes: 0,
            shapes: 0,
            sourceName
          });
          setNotice(error instanceof Error ? error.message : "SVG kon niet worden omgezet.");
        }
      });
    }

    return () => {
      active = false;
    };
  }, [settings, sourceName, svgText]);

  function updateSetting<Key extends keyof EditorSettings>(key: Key, value: EditorSettings[Key]) {
    setSettings((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".svg") && file.type !== "image/svg+xml") {
      setNotice("Gebruik een SVG voor echte logo-dikte.");
      event.target.value = "";
      return;
    }

    setSvgText(await file.text());
    setSourceName(file.name);
    setNotice(`${file.name} geladen.`);
  }

  async function exportGltf() {
    if (!svgText || exporting) {
      return;
    }

    setExporting(true);
    setNotice("GLTF maken...");

    try {
      const json = await createGltfJson();
      const blob = new Blob([json], { type: "model/gltf+json" });

      downloadBlob(blob, downloadName);
      setNotice(`${downloadName} gedownload.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Export is mislukt.");
    } finally {
      setExporting(false);
    }
  }

  async function downloadQrPng(qrUrl: string, slug: string) {
    const dataUrl = await QRCode.toDataURL(qrUrl, {
      width: 2048,
      margin: 4,
      errorCorrectionLevel: "H",
      color: {
        dark: "#071414",
        light: "#ffffff"
      }
    });
    const link = document.createElement("a");

    link.href = dataUrl;
    link.download = `oddunit-qr-${slug}.png`;
    link.click();
  }

  async function createGltfJson() {
    const built = buildSvgModel(svgText, sourceName, settings);

    try {
      const exporter = new GLTFExporter();
      const result = await exporter.parseAsync(built.group, {
        binary: false,
        onlyVisible: true,
        trs: true
      });

      if (result instanceof ArrayBuffer) {
        throw new Error("GLB export is niet ingeschakeld voor deze actie.");
      }

      return JSON.stringify(result, null, 2);
    } finally {
      disposeObject(built.group);
    }
  }

  async function applyToArQr() {
    if (!svgText || applying) {
      return;
    }

    if (!token) {
      setNotice("Activatiecode is nodig om je AR QR te publiceren.");
      return;
    }

    setApplying(true);
    setPublishedQr(null);
    setNotice("Model opslaan...");

    try {
      const gltf = await createGltfJson();
      const modelResponse = await fetch("/api/models", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": token
        },
        body: JSON.stringify({
          name: downloadName,
          gltf
        })
      });

      if (!modelResponse.ok) {
        throw new Error(await readApiError(modelResponse, "Model opslaan is mislukt."));
      }

      const modelPayload = (await modelResponse.json()) as { modelUrl: string };

      setNotice("QR naar AR model zetten...");

      let createdSlug = "";
      let createdQrUrl = "";

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const slug = autoQrSlug(sourceName);
        const qrResponse = await fetch("/api/qrcodes", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-admin-token": token
          },
          body: JSON.stringify({
            title: titleFromSource(sourceName),
            slug,
            kind: "ar",
            destinationUrl: "https://oddunit.be",
            modelUrl: modelPayload.modelUrl,
            arPlacement,
            arSpinSpeed: settings.spinSpeed,
            arScale: settings.scale,
            ctaLabel: "Open oddunit.be"
          })
        });

        if (qrResponse.status === 409) {
          continue;
        }

        if (!qrResponse.ok) {
          throw new Error(await readApiError(qrResponse, "QR aanmaken is mislukt."));
        }

        const qrPayload = (await qrResponse.json()) as { item: { slug: string } };
        createdSlug = qrPayload.item.slug;
        createdQrUrl = `${publicOrigin}/q/${createdSlug}`;
        break;
      }

      if (!createdSlug || !createdQrUrl) {
        throw new Error("QR aanmaken is mislukt. Probeer opnieuw.");
      }

      setPublishedQr({
        slug: createdSlug,
        url: createdQrUrl,
        modelUrl: modelPayload.modelUrl
      });
      await downloadQrPng(createdQrUrl, createdSlug);
      setNotice(`QR ${createdSlug} is klaar en gedownload.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AR QR aanmaken is mislukt.");
    } finally {
      setApplying(false);
    }
  }

  async function downloadPublishedQr() {
    if (!publishedQr) {
      return;
    }

    try {
      await downloadQrPng(publishedQr.url, publishedQr.slug);
      setNotice("QR PNG gedownload.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "QR downloaden is mislukt.");
    }
  }

  async function updatePublishedQr() {
    if (!publishedQr || !svgText || applying) {
      return;
    }

    setApplying(true);
    setNotice("Model updaten...");

    try {
      const gltf = await createGltfJson();
      const modelResponse = await fetch("/api/models", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": token
        },
        body: JSON.stringify({
          name: downloadName,
          gltf
        })
      });

      if (!modelResponse.ok) {
        throw new Error(await readApiError(modelResponse, "Model updaten is mislukt."));
      }

      const modelPayload = (await modelResponse.json()) as { modelUrl: string };
      const qrResponse = await fetch(`/api/qrcodes/${encodeURIComponent(publishedQr.slug)}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-admin-token": token
        },
        body: JSON.stringify({
          modelUrl: modelPayload.modelUrl,
          arPlacement,
          arSpinSpeed: settings.spinSpeed,
          arScale: settings.scale
        })
      });

      if (!qrResponse.ok) {
        throw new Error(await readApiError(qrResponse, "QR updaten is mislukt."));
      }

      setPublishedQr((current) => (current ? { ...current, modelUrl: modelPayload.modelUrl } : current));
      setNotice(`QR ${publishedQr.slug} gebruikt nu ${arPlacementCopy[arPlacement]} op schaal ${settings.scale.toFixed(2)}x.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "AR QR updaten is mislukt.");
    } finally {
      setApplying(false);
    }
  }

  function resetSettings() {
    setSettings(defaultSettings);
    setNotice("Instellingen gereset.");
  }

  return (
    <main className="shell editor-shell">
      <header className="topbar">
        <Link className="brand brand-full" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logos/logo-black-studio.svg" alt="OddUnit Studio" />
          <span>3D logo editor</span>
        </Link>
        <nav className="nav">
          <Link href="/#pricing">Prijzen</Link>
          <Link href="/x/oddunit-card/">AR demo</Link>
          <Link className="nav-cta" href="/checkout/?plan=studio">Bestellen</Link>
        </nav>
      </header>

      <section className="editor-grid">
        <div className="editor-preview-panel">
          <div className="editor-preview-head">
            <div>
              <p className="eyebrow">SVG naar GLTF</p>
              <h1>Logo thickness editor</h1>
            </div>
            <button className="button" type="button" onClick={loadPreset}>
              <RefreshCw size={18} />
              Preset
            </button>
          </div>

          <div className="editor-preview" ref={previewRef}>
            <canvas ref={canvasRef} aria-label="3D preview" />
          </div>

          <div className="editor-status">
            <span>{notice}</span>
            <span>{stats.meshes} meshes</span>
            <span>{stats.sourceName}</span>
          </div>
        </div>

        <aside className="panel editor-controls" aria-label="Logo instellingen">
          <label className="editor-upload">
            <FileUp size={20} />
            <span>SVG uploaden</span>
            <input accept=".svg,image/svg+xml" type="file" onChange={handleUpload} />
          </label>

          <div className="editor-section">
            <div className="editor-section-title">
              <Palette size={18} />
              <span>Kleur</span>
            </div>
            <label>
              Logo
              <input
                type="color"
                value={settings.materialColor}
                onChange={(event) => updateSetting("materialColor", event.target.value)}
              />
            </label>
            <label>
              Achtergrond
              <input
                type="color"
                value={settings.backgroundColor}
                onChange={(event) => updateSetting("backgroundColor", event.target.value)}
              />
            </label>
          </div>

          <div className="editor-section">
            <div className="editor-section-title">
              <SlidersHorizontal size={18} />
              <span>Vorm</span>
            </div>
            <label>
              Dikte {Math.round(settings.thickness * 100)}%
              <input
                max="1.2"
                min="0.02"
                step="0.01"
                type="range"
                value={settings.thickness}
                onChange={(event) => updateSetting("thickness", Number(event.target.value))}
              />
            </label>
            <label>
              Afronding {Math.round(settings.bevelSize * 100)}%
              <input
                max="0.08"
                min="0"
                step="0.002"
                type="range"
                value={settings.bevelSize}
                onChange={(event) => updateSetting("bevelSize", Number(event.target.value))}
              />
            </label>
            <label>
              Bevel segments {settings.bevelSegments}
              <input
                max="8"
                min="1"
                step="1"
                type="range"
                value={settings.bevelSegments}
                onChange={(event) => updateSetting("bevelSegments", Number(event.target.value))}
              />
            </label>
            <label>
              AR grootte {settings.scale.toFixed(2)}x
              <input
                max="1.8"
                min="0.45"
                step="0.05"
                type="range"
                value={settings.scale}
                onChange={(event) => updateSetting("scale", Number(event.target.value))}
              />
            </label>
          </div>

          <div className="editor-section">
            <div className="editor-section-title">
              <Box size={18} />
              <span>Materiaal</span>
            </div>
            <label>
              Metaal {settings.metalness.toFixed(2)}
              <input
                max="1"
                min="0"
                step="0.01"
                type="range"
                value={settings.metalness}
                onChange={(event) => updateSetting("metalness", Number(event.target.value))}
              />
            </label>
            <label>
              Ruwheid {settings.roughness.toFixed(2)}
              <input
                max="1"
                min="0"
                step="0.01"
                type="range"
                value={settings.roughness}
                onChange={(event) => updateSetting("roughness", Number(event.target.value))}
              />
            </label>
          </div>

          <div className="editor-section">
            <div className="editor-section-title">
              <RotateCw size={18} />
              <span>Animatie</span>
            </div>
            <label>
              Previewrotatie {settings.spinSpeed.toFixed(2)}
              <input
                max="3"
                min="0"
                step="0.05"
                type="range"
                value={settings.spinSpeed}
                onChange={(event) => updateSetting("spinSpeed", Number(event.target.value))}
              />
            </label>
          </div>

          <div className="editor-section">
            <div className="editor-section-title">
              <ScanQrCode size={18} />
              <span>AR QR</span>
            </div>
            <div className="segmented editor-mode-toggle" aria-label="AR plaatsing">
              {(Object.keys(arPlacementCopy) as ArPlacement[]).map((placement) => (
                <button
                  className={placement === arPlacement ? "active" : ""}
                  key={placement}
                  type="button"
                  onClick={() => setArPlacement(placement)}
                >
                  {arPlacementCopy[placement]}
                </button>
              ))}
            </div>
            <label>
              Activatiecode
              <input
                autoComplete="current-password"
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
            </label>
            <button
              className="button primary full-width"
              disabled={!svgText || applying}
              type="button"
              onClick={publishedQr ? updatePublishedQr : applyToArQr}
            >
              <ScanQrCode size={18} />
              {applying ? "Opslaan..." : publishedQr ? "Update deze QR" : "Maak AR QR"}
            </button>
            {publishedQr ? (
              <div className="editor-qr-result">
                <QrPreview value={publishedQr.url} size={176} />
                <div>
                  <strong>QR klaar</strong>
                  <code>{publishedQr.url}</code>
                  <div className="editor-qr-actions">
                    <button className="icon-button" type="button" onClick={downloadPublishedQr} aria-label="Download QR PNG">
                      <Download size={18} />
                    </button>
                    <Link className="icon-button" href={`/x/${publishedQr.slug}/`} aria-label="Open AR">
                      <ExternalLink size={18} />
                    </Link>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="editor-actions">
            <button className="button primary" disabled={!svgText || exporting} type="button" onClick={exportGltf}>
              <Download size={18} />
              {exporting ? "Export..." : "Download GLTF"}
            </button>
            <button className="button ghost" type="button" onClick={resetSettings}>
              <RefreshCw size={18} />
              Reset
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}
