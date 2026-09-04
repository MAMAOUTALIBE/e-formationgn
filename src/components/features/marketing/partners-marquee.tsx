"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";

import { Container } from "@/components/ui/container";

import styles from "./partners-marquee.module.css";

const ANIMATION_DURATION_MS = 100_000;
const ARROW_STEP_MS = 2_400;

const PARTNERS = [
  { name: "ACTIS", src: "/images/partners/actis.png", width: 157, height: 41 },
  { name: "Zolpan", src: "/images/partners/zolpan.png", width: 121, height: 37 },
  { name: "Biofib", src: "/images/partners/biofib.png", width: 106, height: 44 },
  { name: "Knauf", src: "/images/partners/knauf.png", width: 113, height: 40 },
  { name: "Isover", src: "/images/partners/isover.png", width: 133, height: 41 },
  { name: "ATES", src: "/images/partners/ates.png", width: 88, height: 37 },
  { name: "MC France", src: "/images/partners/mc-france.png", width: 119, height: 35 },
  { name: "Art & Blind", src: "/images/partners/ART-AND-BLIND.png", width: 191, height: 47 },
  { name: "Pavatex", src: "/images/partners/pavatex.png", width: 123, height: 53 },
  { name: "Isochemie", src: "/images/partners/isochemie.png", width: 80, height: 80 },
  { name: "Quickciel", src: "/images/partners/quickciel.png", width: 128, height: 29 },
  { name: "Métisse", src: "/images/partners/metisse.png", width: 160, height: 33 },
  { name: "Parexlanko", src: "/images/partners/Parexlanko.png", width: 138, height: 40 },
  { name: "Dörken", src: "/images/partners/doerken.png", width: 162, height: 33 },
  { name: "SIGA", src: "/images/partners/siga.png", width: 112, height: 33 },
  { name: "URSA", src: "/images/partners/ursa.png", width: 116, height: 62 },
  { name: "Rockwool", src: "/images/partners/rockwool.png", width: 157, height: 27 },
  { name: "Lemasson", src: "/images/partners/pac_lemasson-4.png", width: 179, height: 47 },
  { name: "Anjos", src: "/images/partners/anjos-2.png", width: 147, height: 45 },
  { name: "Atlantic", src: "/images/partners/atlantic-1.png", width: 207, height: 57 },
  { name: "Intuis", src: "/images/partners/Intuis-Auer-300x74.jpg", width: 300, height: 74 },
  { name: "SETP", src: "/images/partners/setp-1.png", width: 104, height: 104 },
  { name: "LEDVANCE", src: "/images/partners/osram-ledvance.png", width: 154, height: 37 },
  { name: "OSRAM", src: "/images/partners/osram.png", width: 73, height: 37 },
  { name: "Gossen Metrawatt", src: "/images/partners/gossen.png", width: 99, height: 19 },
  { name: "Easy Énergie", src: "/images/partners/easy-energie.png", width: 152, height: 32 },
  { name: "Hero Système", src: "/images/partners/herosysteme.png", width: 118, height: 59 },
  { name: "SFERENO", src: "/images/partners/SFERENO.png", width: 93, height: 46 },
  { name: "Sylvania", src: "/images/partners/sylvania.png", width: 134, height: 26 },
  { name: "Delta Dore", src: "/images/partners/DELTA_DORE.png", width: 119, height: 37 },
  { name: "L'Instrument", src: "/images/partners/linstrument.png", width: 94, height: 81 },
  { name: "Cap Renov+", src: "/images/partners/cap-renov.png", width: 130, height: 35 },
  { name: "Testo", src: "/images/partners/testo.png", width: 163, height: 64 },
  { name: "Legrand", src: "/images/partners/legrand-2.png", width: 131, height: 33 },
  { name: "FIR", src: "/images/partners/fir-1.png", width: 81, height: 65 },
  { name: "Bati-Cube", src: "/images/partners/Bati-Cube-2.png", width: 112, height: 36 },
  { name: "CAPEB", src: "/images/partners/capeb.png", width: 118, height: 57 },
  {
    name: "Région Île-de-France",
    src: "/images/partners/logo-conseil-regional-idf-150x48.png",
    width: 150,
    height: 48,
  },
  { name: "ADEME", src: "/images/partners/ademe.png", width: 97, height: 111 },
  { name: "AIE Formation", src: "/images/partners/aie.png", width: 116, height: 84 },
] as const;

function PartnerGroup({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul
      className={`${styles.group} ${duplicate ? styles.duplicate : ""}`}
      aria-hidden={duplicate || undefined}
      data-partner-copy={duplicate ? "duplicate" : "primary"}
    >
      {PARTNERS.map((partner) => (
        <li key={partner.name} className={styles.card}>
          <Image
            src={partner.src}
            width={partner.width}
            height={partner.height}
            alt={duplicate ? "" : partner.name}
            className={styles.logo}
            unoptimized
          />
        </li>
      ))}
    </ul>
  );
}

export function PartnersMarquee() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  function move(direction: -1 | 1) {
    const animation = trackRef.current?.getAnimations()[0];

    if (animation) {
      const currentTime = Number(animation.currentTime ?? 0);
      animation.currentTime =
        (currentTime + direction * ARROW_STEP_MS + ANIMATION_DURATION_MS) %
        ANIMATION_DURATION_MS;
      return;
    }

    viewportRef.current?.scrollBy({
      left: direction * 180,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }

  return (
    <section
      className="overflow-hidden py-8 sm:py-9"
      aria-labelledby="partners-title"
    >
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="partners-title"
            className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            Nos partenaires
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Des acteurs reconnus aux côtés d&apos;Aiduca.
          </p>
        </div>

        <div className="relative mt-5">
          <div
            ref={viewportRef}
            className={styles.viewport}
            data-partner-viewport
          >
            <div
              ref={trackRef}
              className={styles.track}
              data-partner-track
            >
              <PartnerGroup />
              <PartnerGroup duplicate />
            </div>
          </div>

          <button
            type="button"
            className={`${styles.arrow} ${styles.previous}`}
            aria-label="Afficher les partenaires précédents"
            onClick={() => move(-1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className={`${styles.arrow} ${styles.next}`}
            aria-label="Afficher les partenaires suivants"
            onClick={() => move(1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </Container>
    </section>
  );
}
