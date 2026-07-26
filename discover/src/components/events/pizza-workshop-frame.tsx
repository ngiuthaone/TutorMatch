"use client";

import { useCallback, useEffect, useRef } from "react";
import type { EventDetail } from "@/lib/event-data";

interface PizzaWorkshopFrameProps {
  event: EventDetail;
}

export function PizzaWorkshopFrame({ event }: PizzaWorkshopFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const loadBridge = useCallback(() => {
    const document = frameRef.current?.contentDocument;
    if (!document?.body) return;

    const sendEventData = () => frameRef.current?.contentWindow?.postMessage({ type: "tutoria-event-data", event }, window.location.origin);
    if (document.querySelector("script[data-workshop-template-bridge]")) {
      window.setTimeout(sendEventData, 0);
      return;
    }

    const bridge = document.createElement("script");
    bridge.src = "/workshop-template-bridge.js";
    bridge.dataset.workshopTemplateBridge = "true";
    bridge.onload = () => window.setTimeout(sendEventData, 0);
    document.body.append(bridge);
  }, [event]);

  useEffect(() => { loadBridge(); }, [loadBridge]);

  return <iframe ref={frameRef} title={event.title} src="/pizza-workshop.html" onLoad={loadBridge} style={{ width: "100%", height: "100dvh", border: 0, display: "block", background: "#09090b" }} />;
}
