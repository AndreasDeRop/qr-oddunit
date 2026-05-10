"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Box,
  Clipboard,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Shield
} from "lucide-react";
import { QrPreview } from "@/components/qr-preview";
import type { QrKind, QrLink, QrStatus } from "@/lib/types";

type FormState = {
  title: string;
  slug: string;
  kind: QrKind;
  destinationUrl: string;
  modelUrl: string;
  iosModelUrl: string;
  ctaLabel: string;
};

type DraftState = {
  title: string;
  destination_url: string;
  status: QrStatus;
};

const defaultForm: FormState = {
  title: "OddUnit business card",
  slug: "oddunit-card",
  kind: "ar",
  destinationUrl: "https://oddunit.be",
  modelUrl: "/models/oddunit-logo.gltf",
  iosModelUrl: "",
  ctaLabel: "Open oddunit.be"
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function adminHeaders(token: string) {
  return {
    "content-type": "application/json",
    "x-admin-token": token
  };
}

export function AdminDashboard() {
  const [token, setToken] = useState(() =>
    typeof window === "undefined" ? "" : window.localStorage.getItem("oddunit_qr_admin_token") || ""
  );
  const [form, setForm] = useState<FormState>(defaultForm);
  const [items, setItems] = useState<QrLink[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const origin = useMemo(() => {
    if (typeof window === "undefined") {
      return process.env.NEXT_PUBLIC_SITE_URL || "https://qr.oddunit.be";
    }

    return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
  }, []);

  const loadItems = useCallback(async (activeToken = token) => {
    if (!activeToken) {
      return;
    }

    setLoading(true);
    setNotice("");

    try {
      const response = await fetch("/api/qrcodes", {
        headers: adminHeaders(activeToken)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const payload = (await response.json()) as { items: QrLink[] };
      setItems(payload.items);
      setDrafts(
        Object.fromEntries(
          payload.items.map((item) => [
            item.slug,
            {
              title: item.title,
              destination_url: item.destination_url || "",
              status: item.status
            }
          ])
        )
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Kon QR-codes niet laden.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    window.localStorage.setItem("oddunit_qr_admin_token", token);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadItems(token);
  }, [loadItems, token]);

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice("");

    try {
      const response = await fetch("/api/qrcodes", {
        method: "POST",
        headers: adminHeaders(token),
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setNotice("QR-code aangemaakt.");
      setForm({ ...defaultForm, slug: "", title: "", kind: "redirect" });
      await loadItems();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Opslaan is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function updateItem(slug: string, patch: Partial<DraftState>) {
    setSaving(true);
    setNotice("");

    try {
      const draft = drafts[slug];
      const response = await fetch(`/api/qrcodes/${slug}`, {
        method: "PATCH",
        headers: adminHeaders(token),
        body: JSON.stringify({
          ...draft,
          ...patch
        })
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      setNotice("Wijziging opgeslagen.");
      await loadItems();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Wijziging is mislukt.");
    } finally {
      setSaving(false);
    }
  }

  function updateDraft(slug: string, patch: Partial<DraftState>) {
    setDrafts((current) => ({
      ...current,
      [slug]: {
        ...current[slug],
        ...patch
      }
    }));
  }

  async function copyQrUrl(slug: string) {
    await navigator.clipboard.writeText(`${origin}/q/${slug}`);
    setNotice("QR URL gekopieerd.");
  }

  return (
    <main className="shell admin-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">OU</span>
          <span>QR admin</span>
        </Link>
        <nav className="nav">
          <Link href="/">Home</Link>
          <button className="icon-button" type="button" onClick={() => loadItems()} aria-label="Ververs lijst">
            <RefreshCw size={18} />
          </button>
        </nav>
      </header>

      <section className="admin-grid">
        <form className="panel admin-form" onSubmit={createItem}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Nieuwe code</p>
              <h1>QR aanmaken</h1>
            </div>
            <Plus size={22} />
          </div>

          <label>
            Admin token
            <span className="input-with-icon">
              <Shield size={17} />
              <input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="Cloudflare QR_ADMIN_TOKEN"
                type="password"
              />
            </span>
          </label>

          <label>
            Naam
            <input
              value={form.title}
              onChange={(event) => {
                const title = event.target.value;
                setForm((current) => ({
                  ...current,
                  title,
                  slug: current.slug ? current.slug : slugify(title)
                }));
              }}
              placeholder="OddUnit business card"
            />
          </label>

          <label>
            Slug
            <input
              value={form.slug}
              onChange={(event) => setForm((current) => ({ ...current, slug: slugify(event.target.value) }))}
              placeholder="oddunit-card"
            />
          </label>

          <div className="field-group">
            <span>Type</span>
            <div className="segmented" role="group" aria-label="QR type">
              {(["redirect", "ar", "vcard"] as const).map((kind) => (
                <button
                  className={form.kind === kind ? "active" : ""}
                  key={kind}
                  type="button"
                  onClick={() => setForm((current) => ({ ...current, kind }))}
                >
                  {kind === "ar" ? <Box size={15} /> : null}
                  {kind}
                </button>
              ))}
            </div>
          </div>

          <label>
            Bestemming
            <input
              value={form.destinationUrl}
              onChange={(event) => setForm((current) => ({ ...current, destinationUrl: event.target.value }))}
              placeholder="https://oddunit.be"
              type="url"
            />
          </label>

          {form.kind === "ar" ? (
            <>
              <label>
                GLB/GLTF model
                <input
                  value={form.modelUrl}
                  onChange={(event) => setForm((current) => ({ ...current, modelUrl: event.target.value }))}
                  placeholder="/models/oddunit-logo.gltf"
                />
              </label>

              <label>
                USDZ voor iPhone
                <input
                  value={form.iosModelUrl}
                  onChange={(event) => setForm((current) => ({ ...current, iosModelUrl: event.target.value }))}
                  placeholder="/models/oddunit-logo.usdz"
                />
              </label>

              <label>
                CTA label
                <input
                  value={form.ctaLabel}
                  onChange={(event) => setForm((current) => ({ ...current, ctaLabel: event.target.value }))}
                  placeholder="Open oddunit.be"
                />
              </label>
            </>
          ) : null}

          <button className="button primary" type="submit" disabled={!token || saving}>
            {saving ? <Loader2 className="spin" size={18} /> : <Save size={18} />}
            Opslaan
          </button>

          {notice ? <p className="notice">{notice}</p> : null}
        </form>

        <section className="panel qr-list">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Bestaande codes</p>
              <h2>{loading ? "Laden" : `${items.length} codes`}</h2>
            </div>
            {loading ? <Loader2 className="spin" size={22} /> : <QrIcon />}
          </div>

          <div className="list-stack">
            {items.map((item) => {
              const draft = drafts[item.slug];
              const qrUrl = `${origin}/q/${item.slug}`;

              return (
                <article className="qr-row" key={item.id}>
                  <QrPreview value={qrUrl} size={132} />

                  <div className="qr-row-main">
                    <div className="row-title">
                      <div>
                        <strong>{item.title}</strong>
                        <code>{qrUrl}</code>
                      </div>
                      <span className={`status-pill ${item.status}`}>{item.status}</span>
                    </div>

                    <div className="row-fields">
                      <label>
                        Naam
                        <input
                          value={draft?.title || ""}
                          onChange={(event) => updateDraft(item.slug, { title: event.target.value })}
                        />
                      </label>
                      <label>
                        Bestemming
                        <input
                          value={draft?.destination_url || ""}
                          onChange={(event) => updateDraft(item.slug, { destination_url: event.target.value })}
                        />
                      </label>
                      <label>
                        Status
                        <select
                          value={draft?.status || item.status}
                          onChange={(event) => updateDraft(item.slug, { status: event.target.value as QrStatus })}
                        >
                          <option value="active">active</option>
                          <option value="paused">paused</option>
                          <option value="archived">archived</option>
                        </select>
                      </label>
                    </div>

                    <div className="row-actions">
                      <button className="icon-button" type="button" onClick={() => updateItem(item.slug, {})} aria-label="Bewaar">
                        <Save size={17} />
                      </button>
                      <button className="icon-button" type="button" onClick={() => copyQrUrl(item.slug)} aria-label="Kopieer QR URL">
                        <Clipboard size={17} />
                      </button>
                      <Link className="icon-button" href={`/q/${item.slug}`} aria-label="Open QR route">
                        <ExternalLink size={17} />
                      </Link>
                      <button
                        className="icon-button danger"
                        type="button"
                        onClick={() => updateItem(item.slug, { status: "archived" })}
                        aria-label="Archiveer"
                      >
                        <Archive size={17} />
                      </button>
                      <span className="scan-count">KV</span>
                    </div>
                  </div>
                </article>
              );
            })}

            {!items.length && !loading ? (
              <div className="empty-state">
                <QrIcon />
                <strong>Nog geen QR-codes geladen.</strong>
                <span>Vul de admin token in of maak de eerste code aan.</span>
              </div>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}

function QrIcon() {
  return (
    <span className="qr-mini" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
