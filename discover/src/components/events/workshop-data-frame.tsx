"use client";

import { useEffect, useRef } from "react";
import type { WorkshopData } from "@/lib/workshop-payload";

interface WorkshopDataFrameProps {
  payload: WorkshopData;
}

/**
 * WorkshopDataFrame
 *
 * Renders the shared workshop template (public/pizza-workshop.html) in an
 * iframe and injects a host-created event's content via a
 * tutoria-workshop-data postMessage. The template applies the payload to its
 * state, re-renders the consistent workshop design (Overview / Details /
 * Packages / Schedule / FAQ / Reviews / You-may-also-like), and shows the
 * event's own content instead of the demo Pizza 4P's copy.
 */
export function WorkshopDataFrame({ payload }: WorkshopDataFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const payloadRef = useRef(payload);

  useEffect(() => {
    payloadRef.current = payload;
  }, [payload]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const sendData = () => {
      const win = frame.contentWindow;
      if (!win) return;
      win.postMessage({ type: "tutoria-workshop-data", payload: payloadRef.current }, window.location.origin);
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      const data = event.data || {};
      if (data.type === "tutoria-iframe-ready") {
        sendData();
      }
      if (data.type === "tutoria-booking-auth-required") {
        window.location.assign(`/auth/sign-in?next=${encodeURIComponent(window.location.href)}`);
      }
    };

    window.addEventListener("message", handleMessage);

    const handleLoad = () => {
      sendData();
    };
    frame.addEventListener("load", handleLoad);

    return () => {
      window.removeEventListener("message", handleMessage);
      frame.removeEventListener("load", handleLoad);
    };
  }, []);

  return (
    <iframe
      ref={frameRef}
      title={payload.hero.title}
      src="/pizza-workshop.html"
      style={{ display: "block", width: "100%", height: "100dvh", border: 0, background: "#09090b" }}
    />
  );
}
