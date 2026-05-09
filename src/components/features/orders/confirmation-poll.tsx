"use client";

// Auto-refresh de la page de confirmation quand l'Order est PENDING.
// Utile pour les paiements CinetPay : l'utilisateur revient sur le site avant
// que le webhook IPN ait fini de traiter (ou si Mobile Money met du temps à
// confirmer côté opérateur). On rafraîchit toutes les 5 s, max 12 fois (1 min).

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ConfirmationPollProps {
  /** Status de l'order au render serveur. Si PENDING/PROCESSING → on poll. */
  status: string;
}

const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 12;

export function ConfirmationPoll({ status }: ConfirmationPollProps) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "PENDING" && status !== "PROCESSING") return;
    let count = 0;
    const id = setInterval(() => {
      count++;
      router.refresh();
      if (count >= MAX_POLLS) clearInterval(id);
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [status, router]);

  return null;
}
