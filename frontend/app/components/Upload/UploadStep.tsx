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
  error: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M7 3.5h7l4 4V20.5H7z" />
      <path d="M14 3.5v4h4M9.5 12h5M9.5 15.5h5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.2 2.2 4.8-5" />
    </svg>
  );
}

function TipIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M9 18h6M9.5 21h5M8.2 14.8a7 7 0 1 1 7.6 0c-.9.7-1.3 1.4-1.3 2.2h-5c0-.8-.4-1.5-1.3-2.2Z" />
    </svg>
  );
}

function StepNavigation() {
  return (
    <>
      <header className="upload-topbar">
        <div className="upload-topbar-inner">
          <a className="upload-product-name" href="/">Excel Converter</a>
          <nav className="upload-topnav" aria-label="เมนูหลัก">
            <a className="active" href="/">Main Converter</a>
            <a href="/settings">ตั้งค่าเทมเพลต</a>
            <span>ช่วยเหลือ</span>
          </nav>

        </div>
      </header>

      <aside className="upload-sidebar">
        <div className="upload-sidebar-heading">
          <strong>ขั้นตอนการแปลงไฟล์</strong>
          <span>3-Step Process</span>
        </div>
        <nav aria-label="ขั้นตอนการแปลงไฟล์">
          <div className="upload-sidebar-step active">
            <span className="upload-sidebar-icon">⇧</span>
            <span>อัปโหลด</span>
          </div>
          <div className="upload-sidebar-step">
            <span className="upload-sidebar-icon">✓</span>
            <span>ตรวจสอบ</span>
          </div>
          <div className="upload-sidebar-step">
            <span className="upload-sidebar-icon">↓</span>
            <span>ดาวน์โหลด</span>
          </div>
        </nav>
      </aside>
    </>
  );
}

function ProgressSteps() {
  return (
    <div className="upload-progress" aria-label="ขั้นตอนที่ 1 จาก 3">
      <div className="upload-progress-line" />
      {[
        ["1", "อัปโหลด", true],
        ["2", "ตรวจสอบ", false],
        ["3", "ดาวน์โหลด", false],
      ].map(([number, label, active]) => (
        <div className={`upload-progress-step ${active ? "active" : ""}`} key={label as string}>
          <span className="upload-progress-number">{number}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
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
  error,
}: UploadStepProps) {
  const openFilePicker = () => {
    if (!inputRef.current || loading) return;
    inputRef.current.value = "";
    inputRef.current.click();
  };

  const removeFile = () => {
    if (inputRef.current) inputRef.current.value = "";
    setFile(null);
  };

  const fileInput = (
    <input
      ref={inputRef}
      className="upload-file-input"
      type="file"
      accept=".xlsx,.xls"
      onChange={(event) => event.target.files?.[0] && handleFile(event.target.files[0])}
    />
  );

  return (
    <div className="upload-shell">
      <StepNavigation />

      <main className="upload-main">
        <div className="upload-main-inner">
          <ProgressSteps />

          {error && (
            <div className="upload-error" role="alert">
              <strong>ไม่สามารถตรวจสอบไฟล์ได้</strong>
              <span>{error}</span>
            </div>
          )}

          {loading && file ? (
            <section className="upload-processing" aria-live="polite">
              <div className="upload-processing-icon">
                <FileIcon />
              </div>
              <h1>กำลังตรวจสอบไฟล์และข้อมูลในแต่ละชีต...</h1>
              <p>
                โปรดรอสักครู่ ระบบกำลังอ่านข้อมูลและเตรียมผลการตรวจสอบ
                ระยะเวลาอาจแตกต่างกันตามขนาดและจำนวนชีตในไฟล์
              </p>
              <div className="upload-processing-file">
                <span>{file.name}</span>
                <span>{formatFileSize(file.size)}</span>
              </div>
              <div className="upload-indeterminate" aria-label="กำลังประมวลผล">
                <span />
              </div>
            </section>
          ) : !file ? (
            <section className="upload-empty-state">
              <div className="upload-copy">
                <h1>แปลงไฟล์ Excel ให้ตรงกับเทมเพลตได้ง่าย ๆ</h1>
                <p>
                  อัปโหลดไฟล์ Excel แล้วระบบจะตรวจสอบชีต จัดระเบียบข้อมูล
                  และเตรียมไฟล์ผลลัพธ์ให้โดยอัตโนมัติ
                </p>
              </div>

              <div
                className={`upload-dropzone ${dragActive ? "drag" : ""}`}
                onClick={openFilePicker}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
              >
                <div className="upload-dropzone-icon">
                  <UploadIcon />
                </div>
                <strong>ลากไฟล์ Excel มาวางที่นี่</strong>
                <span>หรือคลิกเพื่อเลือกไฟล์</span>
                <button type="button" onClick={(event) => {
                  event.stopPropagation();
                  openFilePicker();
                }}>
                  เลือกไฟล์ Excel
                </button>
                <small>รองรับ .xlsx และ .xls ขนาดไม่เกิน 20 MB</small>
                {fileInput}
              </div>
            </section>
          ) : (
            <section className="upload-selected-state">
              <div className="upload-selected-heading">
                <h1>อัปโหลดไฟล์ของคุณ</h1>
                <p>อัปโหลดไฟล์ Excel เพื่อเริ่มต้นกระบวนการแปลงข้อมูล</p>
              </div>

              <div className="upload-selected-grid">
                <div className="upload-file-card">
                  <div className="upload-file-card-main">
                    <div className="upload-file-icon"><FileIcon /></div>
                    <div className="upload-file-details">
                      <strong>{file.name}</strong>
                      <span>{formatFileSize(file.size)} · ไฟล์ Excel</span>
                    </div>
                    <div className="upload-file-actions">
                      <button type="button" onClick={openFilePicker}>เปลี่ยนไฟล์</button>
                      <button className="danger" type="button" onClick={removeFile}>ลบไฟล์</button>
                    </div>
                  </div>
                  <div className="upload-file-success">
                    <CheckIcon />
                    <span>เลือกไฟล์เรียบร้อยแล้ว</span>
                  </div>
                  {fileInput}
                </div>

                <aside className="upload-tip-card">
                  <div className="upload-tip-icon"><TipIcon /></div>
                  <strong>เคล็ดลับการแปลงไฟล์</strong>
                  <p>รองรับไฟล์ Excel ที่มีหลายชีต ระบบจะตรวจสอบทุกชีตโดยอัตโนมัติ</p>
                </aside>
              </div>

              <div className="upload-selected-actions">
                <button type="button" onClick={onNext}>
                  ตรวจสอบไฟล์
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
