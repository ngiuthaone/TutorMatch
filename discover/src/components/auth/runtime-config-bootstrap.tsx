"use client";

import { useEffect, useRef } from "react";
import { loadExternalConfig } from "@/lib/auth/config";

export function RuntimeConfigBootstrap() {
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void loadExternalConfig();
  }, []);
  return null;
}