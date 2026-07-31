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
    <div className="page">
      <div className="header">
        <div className="brand">
          <div className="brand-tag" />
          <div>
            <h1>ตั้งค่า Template</h1>
            <p>อัปโหลดหรือย้อนกลับไฟล์ template ที่ใช้สร้างผลลัพธ์ export</p>
          </div>
        </div>
        <a href="/" className="btn secondary">
          ← กลับหน้าแปลงไฟล์
        </a>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        <p className="eyebrow">Template ปัจจุบัน</p>
        {status.isOverride && status.active ? (
          <>
            <h2>{status.active.originalFileName}</h2>
            <p className="lead">
              อัปโหลดเมื่อ {formatDate(status.active.uploadedAt)} — {status.active.columns.length} คอลัมน์
            </p>
            <button onClick={() => rollback(null)}>ใช้ Template มาตรฐาน (ค่าเริ่มต้น)</button>
          </>
        ) : (
          <>
            <h2>Template มาตรฐาน (ค่าเริ่มต้น)</h2>
            <p className="lead">ยังไม่มีการอัปโหลด template ใหม่ ระบบใช้ไฟล์ที่มากับแอปอยู่</p>
          </>
        )}

        {hasDiff && (
          <div className="error-banner" style={{ background: "var(--tag-amber-soft)", color: "var(--tag-amber)", borderColor: "var(--tag-amber)" }}>
            <strong>คอลัมน์ไม่ตรงกับที่ระบบใช้แนะนำ mapping อัตโนมัติ</strong> — ยังสลับ template ได้ตามปกติ
            แต่คอลัมน์ที่ต่างไปอาจต้อง mapping มือ:
            {activeColumnDiff!.missing.length > 0 && (
              <div style={{ marginTop: 6 }}>ขาดไป: {activeColumnDiff!.missing.join(", ")}</div>
            )}
            {activeColumnDiff!.extra.length > 0 && (
              <div style={{ marginTop: 6 }}>เพิ่มใหม่: {activeColumnDiff!.extra.join(", ")}</div>
            )}
          </div>
        )}

        <div style={{ marginTop: 28 }}>
          {!pendingFile ? (
            <label
              className={`dropzone ${dragActive ? "drag" : ""}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
            >
              <div className="icon" />
              <div className="main">ลากไฟล์ template มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</div>
              <div className="sub">.xlsx / .xls</div>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(event) => event.target.files?.[0] && pickFile(event.target.files[0])}
              />
            </label>
          ) : (
            <div className="filebar">
              <span className="name">
                📄 {pendingFile.name}{" "}
                <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>
                  ({(pendingFile.size / 1024).toFixed(0)} KB)
                </span>
              </span>
              <button onClick={() => setPendingFile(null)}>ลบไฟล์</button>
            </div>
          )}

          <div className="actions">
            <span />
            <button className="btn amber" disabled={!pendingFile || uploading} onClick={upload}>
              {uploading ? "กำลังตรวจสอบและอัปโหลด..." : "ใช้ไฟล์นี้เป็น template →"}
            </button>
          </div>
        </div>
      </div>

      {status.history.length > 0 && (
        <div className="panel" style={{ marginTop: 24 }}>
          <p className="eyebrow">ประวัติ template ({status.history.length})</p>
          {status.history.map((version) => {
            const isActive = version.id === status.activeId;
            return (
              <div key={version.id} className="filebar" style={{ marginBottom: 10 }}>
                <span className="name">
                  📄 {version.originalFileName}{" "}
                  <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>
                    ({formatDate(version.uploadedAt)}, {version.columns.length} คอลัมน์)
                  </span>
                  {isActive && (
                    <span className="status-badge" style={{ marginLeft: 8 }}>
                      กำลังใช้งาน
                    </span>
                  )}
                </span>
                {!isActive && <button onClick={() => rollback(version.id)}>ย้อนกลับมาใช้ไฟล์นี้</button>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
