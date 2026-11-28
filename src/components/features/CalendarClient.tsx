"use client";

import dynamic from "next/dynamic";
import Loader from "@/components/Loader";

// FullCalendar reads the browser's month and local timezone. Client-only
// rendering avoids a server/client month mismatch near midnight or month rollover.
const FullCalendar = dynamic(() => import("./FullCalendar"), {
  ssr: false,
  loading: () => (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Loader />
    </div>
  ),
});

export default function CalendarClient() {
  return <FullCalendar />;
}
