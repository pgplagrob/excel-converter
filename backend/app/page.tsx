import { getUploadStatus } from "@/lib/upload-status";

export const dynamic = "force-dynamic";

const statePresentation = {
  idle: { label: "ยังไม่ได้รับไฟล์", color: "#64748b", background: "#f1f5f9" },
  processing: { label: "กำลังประมวลผลไฟล์...", color: "#b45309", background: "#fffbeb" },
  success: { label: "ประมวลผลเสร็จแล้ว", color: "#15803d", background: "#f0fdf4" },
  error: { label: "ประมวลผลไม่สำเร็จ", color: "#b91c1c", background: "#fef2f2" },
} as const;

const statusPollingScript = `
(() => {
  const views = {
    idle: { label: "ยังไม่ได้รับไฟล์", color: "#64748b", background: "#f1f5f9" },
    processing: { label: "กำลังประมวลผลไฟล์...", color: "#b45309", background: "#fffbeb" },
    success: { label: "ประมวลผลเสร็จแล้ว", color: "#15803d", background: "#f0fdf4" },
    error: { label: "ประมวลผลไม่สำเร็จ", color: "#b91c1c", background: "#fef2f2" }
  };

  async function refreshStatus() {
    const backend = document.getElementById("backend-status");
    try {
      const response = await fetch("/api/status", { cache: "no-store" });
      if (!response.ok) throw new Error("status request failed");
      const status = await response.json();
      const view = views[status.state];
      if (!view) throw new Error("unknown status");

      backend.textContent = "● ออนไลน์";
      backend.style.color = "#15803d";
      const card = document.getElementById("file-status-card");
      card.style.background = view.background;
      card.style.color = view.color;
      document.getElementById("file-status-label").textContent = view.label;

      const message = document.getElementById("file-status-message");
      message.textContent = status.message || "";
      message.style.display = status.message && status.message !== view.label ? "block" : "none";
      document.getElementById("file-name").textContent = status.fileName || "-";

      const updatedAt = new Date(status.updatedAt);
      document.getElementById("updated-at").textContent = Number.isNaN(updatedAt.getTime())
        ? "-"
        : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "medium" }).format(updatedAt);
    } catch {
      backend.textContent = "● ไม่สามารถเชื่อมต่อได้";
      backend.style.color = "#b91c1c";
    }
  }

  refreshStatus();
  window.setInterval(refreshStatus, 1000);
})();
`;

function formatUpdatedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
}

export default function BackendHome() {
  const status = getUploadStatus();
  const presentation = statePresentation[status.state];

  return (
    <main
      style={{
        boxSizing: "border-box",
        display: "grid",
        minHeight: "100vh",
        placeItems: "center",
        padding: 24,
        background: "#f8fafc",
        color: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <section
        style={{
          width: "min(100%, 560px)",
          boxSizing: "border-box",
          padding: 32,
          border: "1px solid #e2e8f0",
          borderRadius: 18,
          background: "white",
          boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)",
        }}
      >
        <p style={{ margin: "0 0 8px", color: "#64748b", fontSize: 14 }}>Excel Converter API</p>
        <h1 style={{ margin: "0 0 28px", fontSize: 28 }}>สถานะ Backend</h1>

        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span style={{ color: "#475569" }}>Backend</span>
            <strong id="backend-status" style={{ color: "#15803d" }}>● ออนไลน์</strong>
          </div>

          <div
            id="file-status-card"
            style={{
              padding: 20,
              borderRadius: 14,
              background: presentation.background,
              color: presentation.color,
            }}
          >
            <div style={{ marginBottom: 6, fontSize: 13, fontWeight: 700 }}>สถานะไฟล์</div>
            <div id="file-status-label" style={{ fontSize: 21, fontWeight: 700 }}>{presentation.label}</div>
            <div
              id="file-status-message"
              style={{
                display: status.message !== presentation.label ? "block" : "none",
                marginTop: 8,
                fontSize: 14,
              }}
            >
              {status.message}
            </div>
          </div>

          <dl style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: "10px 16px", margin: 0 }}>
            <dt style={{ color: "#64748b" }}>ชื่อไฟล์</dt>
            <dd id="file-name" style={{ margin: 0, overflowWrap: "anywhere", fontWeight: 600 }}>
              {status.fileName ?? "-"}
            </dd>
            <dt style={{ color: "#64748b" }}>อัปเดตล่าสุด</dt>
            <dd id="updated-at" style={{ margin: 0 }}>{formatUpdatedAt(status.updatedAt)}</dd>
          </dl>
        </div>
      </section>
      <script dangerouslySetInnerHTML={{ __html: statusPollingScript }} />
    </main>
  );
}
