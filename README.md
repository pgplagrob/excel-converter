# ตัวกลางแปลงไฟล์สินทรัพย์ (Excel → Template Converter)

เว็บแอป Next.js สำหรับแปลงไฟล์ Excel ข้อมูลสินทรัพย์ (หลายชีต, หลายรูปแบบหัวคอลัมน์) ให้ตรงกับเทมเพลตมาตรฐาน 44 คอลัมน์ ตาม pipeline:

```
Excel → Read → Parse → Normalize → Mapping → Validate → Generate Template
```

## วิธีใช้งาน (รันในเครื่อง)

```bash
npm install
npm run dev
```

แล้วเปิด http://localhost:3000

สำหรับ production:

```bash
npm run build
npm start
```

## โครงสร้างโปรเจกต์ (ตาม Architecture ที่ออกแบบไว้)

```
Upload (UI step 1)
   ↓
Excel Parser        → lib/excel.ts  (อ่านไฟล์ด้วย xlsx/SheetJS)
   ↓
Sheet Detector       → lib/excel.ts  (หาแถวหัวตาราง + ข้ามชีตว่าง)
   ↓
Row Parser           → lib/excel.ts  (แปลงแต่ละแถวเป็น object + normalize วันที่)
   ↓
Mapping Engine        → lib/mapping.ts (จับคู่หัวคอลัมน์อัตโนมัติ: exact/alias/fuzzy)
   ↓
Validation            → lib/validate.ts (ตรวจคอลัมน์บังคับ, รูปแบบวันที่, ตัวเลข)
   ↓
Export                → app/api/export/route.ts (สร้างไฟล์ .xlsx ตามเทมเพลต 44 คอลัมน์)
```

## หน้า UI (4 ขั้นตอน)

1. **Upload File** — ลากวางหรือเลือกไฟล์ .xlsx/.xls
2. **Preview Data** — ดูตัวอย่างข้อมูลแต่ละชีตที่ตรวจพบ
3. **Mapping Result** — ตรวจ/แก้ไขการจับคู่คอลัมน์ต้นทาง → คอลัมน์เทมเพลต 44 ช่อง
4. **Download Template** — ดูผลตรวจสอบ (errors/warnings) แล้วดาวน์โหลดไฟล์เทมเพลตที่แปลงแล้ว

## การปรับแต่งการจับคู่คอลัมน์ (Mapping)

แก้ไข/เพิ่มคำพ้องของแต่ละคอลัมน์ได้ที่ `lib/mapping.ts` ในตัวแปร `ALIASES` เพื่อให้ระบบจับคู่ไฟล์ต้นทางรูปแบบใหม่ ๆ ได้แม่นยำขึ้นโดยไม่ต้องแก้ logic หลัก

## การปรับแต่งกฎตรวจสอบ (Validation)

แก้ไขได้ที่ `lib/validate.ts`:
- `REQUIRED_COLUMNS` — คอลัมน์ที่ห้ามว่าง
- `DATE_COLUMNS` — คอลัมน์ที่ต้องเป็นรูปแบบวันที่
- `NUMERIC_COLUMNS` — คอลัมน์ที่ต้องเป็นตัวเลข

## หมายเหตุ

- ระบบจะตรวจหาแถวหัวตาราง (header row) อัตโนมัติในแต่ละชีต โดยสแกน 15 แถวแรกหาแถวที่มีคำใกล้เคียงกับชื่อคอลัมน์เทมเพลตมากที่สุด
- ชีตที่ไม่มีข้อมูล (น้อยกว่า 1 แถวข้อมูล) จะถูกข้ามอัตโนมัติ และแสดงรายชื่อในขั้นตอน Preview
- ไฟล์เทมเพลตที่ดาวน์โหลดจะมี 1 ชีตต่อ 1 ชีตต้นทาง โดยใช้ชื่อชีตเดิม และคอลัมน์เรียงตามลำดับเทมเพลต 44 คอลัมน์เสมอ
