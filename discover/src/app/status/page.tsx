interface ComponentStatus {
  name: string;
  status: "operational" | "degraded" | "outage" | "unknown";
  detail?: string;
}

export const dynamic = "force-dynamic";

async function getComponentStatuses(): Promise<ComponentStatus[]> {
  const out: ComponentStatus[] = [];
  const env = {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  };
  const reqHeaders = {
    "Content-Type": "application/json",
    apikey: env.key,
    Authorization: `Bearer ${env.key}`,
  };

  try {
    const r = await fetch(`${env.url}/rest/v1/tutor_profiles?select=id&limit=1`, {
      headers: reqHeaders,
      cache: "no-store",
    });
    out.push({
      name: "Database",
      status: r.ok ? "operational" : r.status >= 500 ? "outage" : "degraded",
      detail: r.ok
        ? `${r.headers.get("content-length") ?? 0} bytes returned`
        : `HTTP ${r.status}`,
    });
  } catch (e) {
    out.push({ name: "Database", status: "outage", detail: String(e) });
  }

  try {
    const r = await fetch(`${env.url}/storage/v1/bucket/avatars`, {
      headers: reqHeaders,
      cache: "no-store",
    });
    out.push({
      name: "Storage",
      status: r.ok ? "operational" : r.status >= 500 ? "outage" : "degraded",
      detail: r.ok ? "avatars bucket accessible" : `HTTP ${r.status}`,
    });
  } catch (e) {
    out.push({ name: "Storage", status: "outage", detail: String(e) });
  }

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  if (backendUrl) {
    try {
      const r = await fetch(`${backendUrl}/api/v1/readyz`, { cache: "no-store" });
      const data = await r.json();
      out.push({
        name: "API",
        status: data.status === "ready" ? "operational" : "degraded",
        detail: data.worker_heartbeat
          ? `worker last run ${data.worker_heartbeat.last_run_at}`
          : "no heartbeat",
      });
      out.push({
        name: "Background worker",
        status: data.worker_heartbeat?.status === "ok" ? "operational" : "degraded",
        detail: data.worker_heartbeat?.last_error ?? "no error",
      });
    } catch (e) {
      out.push({ name: "API", status: "outage", detail: String(e) });
    }
  } else {
    out.push({ name: "API", status: "unknown", detail: "NEXT_PUBLIC_BACKEND_URL not set" });
  }

  return out;
}

const statusColor = (s: ComponentStatus["status"]): string => {
  switch (s) {
    case "operational":
      return "text-emerald-600";
    case "degraded":
      return "text-amber-600";
    case "outage":
      return "text-red-600";
    default:
      return "text-zinc-500";
  }
};

export default async function StatusPage() {
  const components = await getComponentStatuses();
  const allOk = components.every((c) => c.status === "operational");
  const anyOut = components.some((c) => c.status === "outage");

  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-serif mb-2">Tutoria Status</h1>
      <p
        className={`text-sm mb-6 ${allOk ? "text-emerald-600" : anyOut ? "text-red-600" : "text-amber-600"}`}
      >
        {allOk
          ? "All systems operational"
          : anyOut
            ? "Service disruption in progress"
            : "Some systems degraded"}
      </p>

      <div className="border rounded-lg divide-y">
        {components.map((c) => (
          <div key={c.name} className="p-4 flex items-center justify-between">
            <div>
              <div className="font-medium">{c.name}</div>
              {c.detail && <div className="text-xs text-zinc-500 mt-1">{c.detail}</div>}
            </div>
            <div className={`text-sm font-medium ${statusColor(c.status)}`}>{c.status}</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-zinc-500 mt-8">
        For real-time incident updates, visit{" "}
        <a className="underline" href="https://status.tutoria.com">
          status.tutoria.com
        </a>
        .
      </p>
    </main>
  );
}
