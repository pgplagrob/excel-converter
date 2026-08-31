import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ตัวกลางแปลงไฟล์สินทรัพย์ | ทดสอบ",
  description: "แปลงไฟล์ Excel ข้อมูลสินทรัพย์ให้ตรงตามคอลัมน์ของเทมเพลตมาตรฐาน",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <a href="/settings" className="settings-link">
          ⚙ ตั้งค่า Template
        </a>
        {children}
      </body>
    </html>
  );
}
