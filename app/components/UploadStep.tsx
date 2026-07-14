"use client";

import type { DragEvent, RefObject } from "react";

interface UploadStepProps {
  file: File | null;
  dragActive: boolean;
  setDragActive: (active: boolean) => void;
  onDrop: (event: DragEvent) => void;
  inputRef: RefObject<HTMLInputElement | null>;
  handleFile: (file: File) => void;
  setFile: (file: File | null) => void;
  onNext: () => void;
  loading: boolean;
}

export function UploadStep({
  file,
  dragActive,
  setDragActive,
  onDrop,
  inputRef,
  handleFile,
  setFile,
  onNext,
  loading,
}: UploadStepProps) {
  return (
    <>
      <p className="eyebrow">Step 1</p>
      <h2>อัปโหลดไฟล์ Excel</h2>
      <p className="lead">
        รองรับไฟล์ .xlsx และ .xls ที่มีหลายชีต
        ระบบจะตรวจหาชีตที่มีข้อมูลสินทรัพย์ให้อัตโนมัติ
      </p>

      {!file ? (
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
          <div className="main">ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์</div>
          <div className="sub">.xlsx / .xls — ไม่จำกัดจำนวนชีต</div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])}
          />
        </label>
      ) : (
        <div className="filebar">
          <span className="name">
            📄 {file.name}{" "}
            <span style={{ color: "var(--ink-soft)", fontWeight: 400 }}>
              ({(file.size / 1024).toFixed(0)} KB)
            </span>
          </span>
          <button onClick={() => setFile(null)}>ลบไฟล์</button>
        </div>
      )}

      <div className="actions">
        <span />
        <button className="btn amber" disabled={!file || loading} onClick={onNext}>
          {loading ? "กำลังอ่านไฟล์..." : "อ่านไฟล์และดำเนินการต่อ →"}
        </button>
      </div>
    </>
  );
}
