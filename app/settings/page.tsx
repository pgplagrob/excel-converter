"use client";

import { useCallback, useEffect, useState, type DragEvent } from "react";

interface TemplateColumnDiff {
  missing: string[];
  extra: string[];
}

interface TemplateVersion {
  id: string;
  originalFileName: string;
  uploadedAt: number;
  columns: string[];
}

interface TemplateStoreStatus {
  isOverride: boolean;
  activeId: string | null;
  active: {
    id: string;
    originalFileName: string;
    uploadedAt: number;
    columns: string[];
    columnDiff: TemplateColumnDiff;
  } | null;
  history: TemplateVersion[];
}

const WORKBOOK_FILE_PATTERN = /\.xlsx?$/i;

function formatDate(ms: number): string {
  return new Date(ms).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export default function SettingsPage() {
  const [status, setStatus] = useState<TemplateStoreStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/v1/admin/template");
    const data = await res.json();
    setStatus(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const pickFile = (file: File) => {
    setError(null);
    if (!WORKBOOK_FILE_PATTERN.test(file.name)) {
      setError("รองรับเฉพาะไฟล์ .xlsx และ .xls");
      return;
    }
    setPendingFile(file);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) pickFile(file);
  };

  const upload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", pendingFile);
      const res = await fetch("/api/v1/admin/template", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "อัปโหลด template ไม่สำเร็จ");
        return;
      }
      setStatus(data);
      setPendingFile(null);
    } finally {
      setUploading(false);
    }
  };

  const rollback = async (versionId: string | null) => {
    setError(null);
    const res = await fetch("/api/v1/admin/template/rollback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "ย้อนกลับ template ไม่สำเร็จ");
      return;
    }
    setStatus(data);
  };

  const removeTemplate = async (version: TemplateVersion) => {
    const isActive = version.id === status?.activeId;
    const message = isActive
      ? `ลบ ${version.originalFileName} และกลับไปใช้ Template มาตรฐานหรือไม่?`
      : `ลบ ${version.originalFileName} ออกจากประวัติหรือไม่?`;
    if (!window.confirm(message)) return;

    setDeletingId(version.id);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/template", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: version.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ลบ template ไม่สำเร็จ");
        return;
      }
      setStatus(data);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || !status) {
    return (
      <div className="page">
        <div className="loading-bar">
          <div className="fill" />
        </div>
      </div>
    );
  }

  const activeColumnDiff = status.active?.columnDiff;
  const hasDiff = !!activeColumnDiff && (activeColumnDiff.missing.length > 0 || activeColumnDiff.extra.length > 0);

  return (
    <div className="settings-page">
      <div className="settings-topbar">
        <div className="settings-title-wrap">
          <div className="settings-title-icon">⚙</div>
          <div>
            <div className="settings-breadcrumb">การตั้งค่า / Template</div>
            <h1>ตั้งค่า Template</h1>
            <p>จัดการไฟล์แม่แบบที่ใช้สร้างผลลัพธ์จากการ export</p>
          </div>
        </div>
        <a href="/" className="btn secondary">
          ← กลับหน้าแปลงไฟล์
        </a>
      </div>

      <div className="settings-layout">
        <aside className="settings-sidebar">
          <div className="settings-sidebar-label">การตั้งค่า</div>
          <div className="settings-nav-item active">
            <span className="settings-nav-icon">▦</span>
            <span>Template สำหรับ export</span>
          </div>
          <p className="settings-sidebar-help">
            ไฟล์ Template จะถูกใช้เป็นโครงสร้างสำหรับไฟล์ผลลัพธ์ทุกครั้งที่แปลงข้อมูล
          </p>
          <div className="settings-sidebar-note">
            <span className="settings-note-dot" />
            <span>การเปลี่ยนแปลงมีผลกับการ export ครั้งถัดไป</span>
          </div>
        </aside>

        <main className="settings-content">
          {error && <div className="error-banner">{error}</div>}

          <section className="settings-card settings-current-card">
            <div className="settings-card-heading">
              <div>
                <p className="settings-kicker">สถานะการใช้งาน</p>
                <h2>Template ปัจจุบัน</h2>
              </div>
              <span className={`settings-status-pill ${status.isOverride ? "custom" : "default"}`}>
                {status.isOverride ? "กำหนดเอง" : "ค่าเริ่มต้น"}
              </span>
            </div>

            <div className="settings-current-summary">
              <div className="settings-status-icon">{status.isOverride ? "✓" : "□"}</div>
              <div className="settings-current-info">
                <h3>{status.isOverride && status.active ? status.active.originalFileName : "Template มาตรฐาน"}</h3>
                <p>
                  {status.isOverride && status.active
                    ? `อัปโหลดเมื่อ ${formatDate(status.active.uploadedAt)} · ${status.active.columns.length} คอลัมน์`
                    : "ระบบกำลังใช้ไฟล์ Template ที่มากับแอปเป็นค่าเริ่มต้น"}
                </p>
              </div>
            </div>

            {status.isOverride && status.active && (
              <div className="settings-card-actions">
                <button className="btn secondary" onClick={() => rollback(null)}>
                  ใช้ Template มาตรฐานแทน
                </button>
              </div>
            )}

            {hasDiff && (
              <div className="settings-warning">
                <strong>โครงสร้างคอลัมน์แตกต่างจาก Template มาตรฐาน</strong>
                <span>ระบบยังใช้งานได้ แต่คอลัมน์ที่แตกต่างอาจต้อง mapping เอง</span>
                {activeColumnDiff!.missing.length > 0 && (
                  <div>ขาดไป: {activeColumnDiff!.missing.join(", ")}</div>
                )}
                {activeColumnDiff!.extra.length > 0 && (
                  <div>เพิ่มใหม่: {activeColumnDiff!.extra.join(", ")}</div>
                )}
              </div>
            )}
          </section>

          <section className="settings-card">
            <div className="settings-card-heading">
              <div>
                <p className="settings-kicker">เปลี่ยน Template</p>
                <h2>อัปโหลดไฟล์ใหม่</h2>
              </div>
              <span className="settings-card-hint">รองรับ .xlsx และ .xls</span>
            </div>

            {!pendingFile ? (
              <label
                className={`settings-dropzone ${dragActive ? "drag" : ""}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
              >
                <div className="settings-upload-icon">↑</div>
                <div className="settings-dropzone-main">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</div>
                <div className="settings-dropzone-sub">ไฟล์ต้องมี Sheet1 และ Reference</div>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(event) => event.target.files?.[0] && pickFile(event.target.files[0])}
                />
              </label>
            ) : (
              <div className="settings-selected-file">
                <div className="settings-selected-file-icon">XLS</div>
                <div className="settings-selected-file-info">
                  <strong>{pendingFile.name}</strong>
                  <span>{(pendingFile.size / 1024).toFixed(0)} KB · พร้อมอัปโหลด</span>
                </div>
                <button onClick={() => setPendingFile(null)}>เปลี่ยนไฟล์</button>
              </div>
            )}

            <div className="settings-form-actions">
              <span>ไฟล์ใหม่จะถูกเพิ่มไว้ในประวัติ Template</span>
              <button className="btn amber" disabled={!pendingFile || uploading} onClick={upload}>
                {uploading ? "กำลังตรวจสอบและอัปโหลด..." : "บันทึกและใช้ Template นี้"}
              </button>
            </div>
          </section>

          {status.history.length > 0 && (
            <section className="settings-card">
              <div className="settings-card-heading">
                <div>
                  <p className="settings-kicker">จัดการเวอร์ชัน</p>
                  <h2>ประวัติ Template</h2>
                </div>
                <span className="settings-count">{status.history.length} เวอร์ชัน</span>
              </div>
              <div className="settings-history-list">
                {status.history.map((version) => {
                  const isActive = version.id === status.activeId;
                  return (
                    <div key={version.id} className={`settings-history-row ${isActive ? "active" : ""}`}>
                      <div className="settings-history-file-icon">XLS</div>
                      <div className="settings-history-info">
                        <div className="settings-history-name">
                          {version.originalFileName}
                          {isActive && <span className="settings-active-badge">กำลังใช้งาน</span>}
                        </div>
                        <div className="settings-history-meta">
                          {formatDate(version.uploadedAt)} · {version.columns.length} คอลัมน์
                        </div>
                      </div>
                      <div className="template-history-actions">
                        {!isActive && <button onClick={() => rollback(version.id)}>ใช้เวอร์ชันนี้</button>}
                        <button
                          className="danger-button"
                          disabled={deletingId === version.id}
                          onClick={() => removeTemplate(version)}
                        >
                          {deletingId === version.id ? "กำลังลบ..." : "ลบ"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
