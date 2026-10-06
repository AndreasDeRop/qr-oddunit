"use client";

import { useCallback, useRef, useState } from "react";
import * as THREE from "three";
import QRCode from "qrcode";
import { ArExperience } from "@/app/x/ar-experience";

type FixtureState = { x: number; tilt: number; roll: number; distance: number; visible: boolean; wrong: boolean; moving: boolean };
const initial: FixtureState = { x: 0, tilt: 0, roll: 0, distance: 3, visible: true, wrong: false, moving: false };

/** Synthetic camera passes through the real video -> worker -> pose -> WebGL pipeline. */
export function TrackingFixture() {
  const [settings, setSettings] = useState(initial);
  const current = useRef(initial);
  function update(patch: Partial<FixtureState>) {
    current.current = { ...current.current, ...patch };
    setSettings(current.current);
  }
  const cameraSource = useCallback(async () => {
    const qr = document.createElement("canvas"), other = document.createElement("canvas");
    await QRCode.toCanvas(qr, "https://qr.oddunit.be/q/oddunit-card", { width: 512, margin: 4, errorCorrectionLevel: "H" });
    await QRCode.toCanvas(other, "https://qr.oddunit.be/q/other-card", { width: 512, margin: 4, errorCorrectionLevel: "H" });
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(1280, 720);
    const camera = new THREE.PerspectiveCamera(52, 1280 / 720, .01, 100);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#c6c1b6");
    const texture = new THREE.CanvasTexture(qr), wrongTexture = new THREE.CanvasTexture(other);
    const geometry = new THREE.PlaneGeometry(1.7, 1.7);
    const material = new THREE.MeshBasicMaterial({ map: texture });
    const marker = new THREE.Mesh(geometry, material);
    scene.add(marker);
    const stream = renderer.domElement.captureStream(30);
    let frame = 0;
    function render(time: number) {
      if (!stream.active) {
        window.cancelAnimationFrame(frame);
        geometry.dispose(); material.dispose(); texture.dispose(); wrongTexture.dispose(); renderer.dispose();
        return;
      }
      const value = current.current;
      marker.position.set(value.x + (value.moving ? Math.sin(time * .0015) * .45 : 0), 0, -value.distance);
      marker.rotation.set(value.tilt * .45, value.tilt, value.roll);
      marker.visible = value.visible;
      material.map = value.wrong ? wrongTexture : texture;
      renderer.render(scene, camera);
      frame = window.requestAnimationFrame(render);
    }
    frame = window.requestAnimationFrame(render);
    return stream;
  }, []);
  return <>
    <ArExperience cameraSource={cameraSource} />
    <aside style={{ position: "fixed", zIndex: 10, top: 92, left: 12, padding: 12, background: "#070707", color: "white", width: 215, maxHeight: "45vh", overflow: "auto", fontSize: 14 }}>
      <strong>Gesimuleerde camera</strong>
      <p>Alleen lokaal. Geen fysieke camera.</p>
      {([['x', 'Positie', -1, 1], ['tilt', 'Kanteling', -.8, .8], ['roll', 'Draaiing', -3.14, 3.14], ['distance', 'Afstand', 2.5, 5]] as const).map(([key, label, min, max]) =>
        <label key={key} style={{ display: "block" }}>{label}
          <input aria-label={label} type="range" min={min} max={max} step="0.05" value={settings[key]} onChange={(event) => update({ [key]: Number(event.target.value) })} />
        </label>)}
      <button type="button" onClick={() => update({ moving: !settings.moving })}>{settings.moving ? "Stop beweging" : "Beweeg QR"}</button>
      <button type="button" onClick={() => update({ visible: !settings.visible })}>{settings.visible ? "Verberg QR" : "Toon QR"}</button>
      <button type="button" onClick={() => update({ wrong: !settings.wrong })}>{settings.wrong ? "Juiste QR" : "Verkeerde QR"}</button>
      <button type="button" onClick={() => update(initial)}>Reset test</button>
    </aside>
  </>;
}
