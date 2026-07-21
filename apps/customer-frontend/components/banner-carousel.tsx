"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { resolveAssetUrl, type HomeData } from "@/lib/api";

type Banner = HomeData["banners"][number];

export function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const banner = banners[index];

  useEffect(() => {
    if (banners.length < 2 || isPaused) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % banners.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [banners.length, isPaused]);

  if (!banner) return null;

  const image = resolveAssetUrl(banner.imageUrl);
  const next = () => setIndex((current) => (current + 1) % banners.length);
  const target = banner.collection?.slug ? `/collections/${banner.collection.slug}` : banner.buttonLink;

  return <section className="hero" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)} onFocus={() => setIsPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false); }} aria-live="polite">
    <div className="hero-media" key={`${banner.id}-${index}`} style={{ backgroundImage: image ? `linear-gradient(90deg, rgba(17,24,39,.9), rgba(17,24,39,.2)), url(${image})` : undefined }} />
    <div className="hero-copy" key={`copy-${banner.id}-${index}`}><span className="eyebrow">New season</span><h1>{banner.title}</h1><p>{banner.subtitle ?? "Comfort and performance for every run."}</p>{target ? <Link href={target} className="button">{banner.buttonText || "Shop the collection"}</Link> : null}</div>
    <div className="banner-controls"><span>{index + 1} / {banners.length}</span><button type="button" onClick={next} className="banner-next" aria-label="Show next banner">Next →</button></div>
  </section>;
}
