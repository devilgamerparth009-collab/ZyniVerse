import type { Metadata } from "next";
import type { ReactNode } from "react";
import AgeGate from "@/components/AgeGate";

/**
 * Age-gated segment. Everything under /doujinshi is 18+ metadata: the server
 * marks the whole segment `noindex, nofollow` so search engines never receive
 * it, and `AgeGate` keeps the client-rendered catalogue behind a confirmation.
 */
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function DoujinshiLayout({ children }: { children: ReactNode }) {
  return (
    <AgeGate storageKey="zyniverse:age-verified" subject="the Doujinshi catalogue">
      {children}
    </AgeGate>
  );
}
