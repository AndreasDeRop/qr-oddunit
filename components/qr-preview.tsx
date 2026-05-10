"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type QrPreviewProps = {
  value: string;
  size?: number;
};

export function QrPreview({ value, size = 164 }: QrPreviewProps) {
  const [src, setSrc] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    QRCode.toDataURL(value, {
      width: size,
      margin: 2,
      color: {
        dark: "#071414",
        light: "#ffffff"
      }
    }).then((dataUrl) => {
      if (!cancelled) {
        setSrc(dataUrl);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [size, value]);

  if (!src) {
    return <div className="qr-placeholder" style={{ width: size, height: size }} />;
  }

  return <img className="qr-image" src={src} width={size} height={size} alt={`QR ${value}`} />;
}
