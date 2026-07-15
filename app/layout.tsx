import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ตัวกลางแปลงไฟล์สินทรัพย์ | ทดสอบ",
  description: "แปลงไฟล์ Excel ข้อมูลสินทรัพย์ให้ตรงตามเทมเพลตมาตรฐาน 50 คอลัมน์",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
