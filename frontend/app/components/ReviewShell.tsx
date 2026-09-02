import type { ReactNode } from "react";

interface ReviewShellProps {
  children: ReactNode;
}

export function ReviewShell({ children }: ReviewShellProps) {
  return (
    <div className="upload-shell review-ready-shell">
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
          <div className="upload-sidebar-step done">
            <span className="upload-sidebar-icon">✓</span>
            <span>อัปโหลด</span>
          </div>
          <div className="upload-sidebar-step active" aria-current="step">
            <span className="upload-sidebar-icon">✓</span>
            <span>ตรวจสอบ</span>
          </div>
          <div className="upload-sidebar-step">
            <span className="upload-sidebar-icon">↓</span>
            <span>ดาวน์โหลด</span>
          </div>
        </nav>
      </aside>

      <main className="upload-main">
        <div className="upload-main-inner">
          <div className="upload-progress" aria-label="ขั้นตอนที่ 2 จาก 3">
            <div className="upload-progress-line" />
            <div className="upload-progress-step done">
              <span className="upload-progress-number">✓</span>
              <span>อัปโหลด</span>
            </div>
            <div className="upload-progress-step active">
              <span className="upload-progress-number">2</span>
              <span>ตรวจสอบ</span>
            </div>
            <div className="upload-progress-step">
              <span className="upload-progress-number">3</span>
              <span>ดาวน์โหลด</span>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
