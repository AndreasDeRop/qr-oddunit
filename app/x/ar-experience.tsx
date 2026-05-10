"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Box, Loader2 } from "lucide-react";
import type { PublicExperience } from "@/lib/types";

const fallbackExperience: PublicExperience = {
  slug: "oddunit-card",
  title: "OddUnit",
  destinationUrl: "https://oddunit.be",
  modelUrl: "/models/oddunit-logo.gltf",
  iosModelUrl: null,
  logoUrl: null,
  ctaLabel: "Open oddunit.be"
};

export function ArExperience() {
  const [experience, setExperience] = useState<PublicExperience>(fallbackExperience);
  const [loading, setLoading] = useState(true);

  const slug = useMemo(() => {
    if (typeof window === "undefined") {
      return fallbackExperience.slug;
    }

    const parts = window.location.pathname.split("/").filter(Boolean);
    return parts[0] === "x" && parts[1] ? decodeURIComponent(parts[1]) : fallbackExperience.slug;
  }, []);

  useEffect(() => {
    void import("@google/model-viewer");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadExperience() {
      try {
        const response = await fetch(`/api/experiences/${slug}`);
        if (!response.ok) {
          throw new Error("Experience unavailable");
        }

        const payload = (await response.json()) as PublicExperience;
        if (!cancelled) {
          setExperience(payload);
        }
      } catch {
        if (!cancelled) {
          setExperience({ ...fallbackExperience, slug });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadExperience();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  function openDestination() {
    window.location.assign(experience.destinationUrl);
  }

  return (
    <main className="experience-page">
      <header className="experience-toolbar">
        <Link className="brand" href="/">
          <span className="brand-mark">OU</span>
          <span>{experience.title}</span>
        </Link>
        <a className="button compact" href={experience.destinationUrl}>
          <ArrowUpRight size={17} />
          {experience.ctaLabel}
        </a>
      </header>

      <section className="model-stage">
        {loading ? (
          <div className="loading-state">
            <Loader2 className="spin" size={28} />
          </div>
        ) : null}

        <model-viewer
          src={experience.modelUrl}
          ios-src={experience.iosModelUrl || undefined}
          alt={experience.title}
          ar
          ar-modes="webxr scene-viewer quick-look"
          ar-scale="fixed"
          camera-controls
          auto-rotate
          shadow-intensity="0.8"
          shadow-softness="0.6"
          exposure="0.95"
          environment-image="neutral"
          touch-action="pan-y"
          interaction-prompt="none"
          camera-orbit="25deg 68deg 4.2m"
          onClick={openDestination}
        >
          <button className="ar-button" slot="ar-button">
            <Box size={18} />
            AR
          </button>
        </model-viewer>
      </section>
    </main>
  );
}
