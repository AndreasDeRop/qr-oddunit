import type { Metadata } from "next";
import { ThicknessEditor } from "./thickness-editor";

export const metadata: Metadata = {
  title: "3D-logo editor voor QR en AR",
  description: "Zet je SVG-logo om naar een 3D-model. Pas kleur, dikte en schaal aan en maak een QR-code voor je AR-ervaring.",
  alternates: { canonical: "/editor" }
};

export default function EditorPage() {
  return <ThicknessEditor />;
}
