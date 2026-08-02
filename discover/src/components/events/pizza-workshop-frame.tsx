"use client";

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import type { EventDetail } from "@/lib/event-data";

interface PizzaWorkshopFrameProps {
  event: EventDetail;
}

export function PizzaWorkshopFrame({ event }: PizzaWorkshopFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const accountSnapshot = useSyncExternalStore(subscribeToAccount, getAccountSnapshot, () => "");
  const currentAccountId = useMemo(() => accountIdFromSnapshot(accountSnapshot), [accountSnapshot]);
  const isOwner = Boolean(event.creatorId && String(event.creatorId).trim().toLowerCase() === currentAccountId);
  const syncEditControls = useCallback(() => {
    const document = frameRef.current?.contentDocument;
    if (!document?.head) return;

    let style = document.getElementById("tutoria-owner-edit-visibility");
    if (isOwner) {
      style?.remove();
      return;
    }

    if (!style) {
      style = document.createElement("style");
      style.id = "tutoria-owner-edit-visibility";
      document.head.append(style);
    }
    style.textContent = `
      [data-edit-section],
      #advancedEditorModal,
      #contentEditorModal {
        display: none !important;
      }
    `;
  }, [isOwner]);

  useEffect(() => {
    syncEditControls();
  }, [syncEditControls]);

  return (
    <iframe
      ref={frameRef}
      title={event.title}
      src="/pizza-workshop.html"
      onLoad={syncEditControls}
      style={{ width: "100%", height: "100dvh", border: 0, display: "block", background: "#09090b" }}
    />
  );
}

function getAccountSnapshot() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("tutoria_signup") || "";
}

function subscribeToAccount(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function accountIdFromSnapshot(snapshot: string) {
  try {
    const account = JSON.parse(snapshot || "{}");
    return account.completed && account.email ? String(account.email).trim().toLowerCase() : "";
  } catch {
    return "";
  }
}
