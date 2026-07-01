# Excel Template Converter

เว็บแอปสำหรับแปลงไฟล์ Excel ข้อมูลสินทรัพย์ให้เป็นไฟล์ template มาตรฐาน 44 คอลัมน์ โดยรองรับ workbook ที่มีหลายชีต และให้ผู้ใช้ตรวจสอบ/แก้ไข mapping ก่อนดาวน์โหลดไฟล์ `.xlsx` ที่แปลงแล้ว

## สิ่งที่แอปทำได้

- อัปโหลดไฟล์ `.xlsx` หรือ `.xls`
- อ่านทุกชีตใน workbook และข้ามชีตที่ไม่มีข้อมูล
- ตรวจหาแถว header อัตโนมัติจาก 15 แถวแรก
- แสดงตัวอย่างข้อมูลต้นทางก่อนแปลง
- แนะนำ mapping จากคอลัมน์ต้นทางไปยัง template 44 คอลัมน์ ด้วย exact, alias และ fuzzy match
- ให้ผู้ใช้แก้ mapping เองผ่าน dropdown ได้ทุกชีต
- ตรวจสอบข้อมูลหลังแปลง พร้อมแสดง error/warning
- ดาวน์โหลดไฟล์ `converted_template.xlsx` โดยสร้าง 1 ชีตต่อ 1 ชีตต้นทาง

## วิธีใช้งาน

ติดตั้ง dependencies:

```bash
npm install
```

รัน development server:

```bash
npm run dev
```

เปิดเว็บที่:

```text
http://localhost:3000
```

สำหรับ production:

```bash
npm run build
npm start
```

## ขั้นตอนบนหน้าเว็บ

1. **อัปโหลดไฟล์**
   เลือกหรือลากไฟล์ Excel มาวาง รองรับ `.xlsx` และ `.xls`

2. **ตรวจสอบข้อมูล**
   แอปจะแสดงชีตที่อ่านได้ จำนวนแถว แถว header ที่ตรวจพบ และตัวอย่างข้อมูลจาก Excel ต้นทาง

3. **จับคู่คอลัมน์**
   แอปจะแนะนำ mapping ไปยัง template 44 คอลัมน์ ผู้ใช้สามารถเปลี่ยนคอลัมน์ต้นทางของแต่ละช่องได้เอง

4. **ตรวจสอบและดาวน์โหลด**
   แอปจะแสดงจำนวนแถวทั้งหมด error และ warning จากนั้นสามารถดาวน์โหลดไฟล์ `.xlsx` ที่แปลงแล้ว หรือย้อนกลับไปแก้ mapping ได้

## โครงสร้างหลัก

```text
app/page.tsx              หน้าเว็บหลัก 4 ขั้นตอน
app/api/parse/route.ts    รับไฟล์ Excel, อ่าน workbook, เตรียม Data Source และ mapping เริ่มต้น
app/api/export/route.ts   validate ข้อมูลหรือสร้างไฟล์ converted_template.xlsx

lib/excel.ts              อ่าน workbook ด้วย xlsx/SheetJS
lib/datasource.ts         หา header row, ข้ามชีตว่าง, สร้างข้อมูลต้นทางต่อชีต
lib/mapping.ts            รายชื่อ template 44 คอลัมน์และ logic แนะนำ mapping
lib/transform.ts          แปลง row ต้นทางให้เรียงตาม template
lib/validate.ts           ตรวจ required columns, date columns และ numeric columns
```

## Flow การทำงาน

```text
Upload Excel
  -> Parse workbook
  -> Detect usable sheets and header rows
  -> Preview source data
  -> Suggest column mapping
  -> User edits mapping
  -> Transform rows to 44-column template
  -> Validate mapped rows
  -> Download converted_template.xlsx
```

## การปรับแต่ง

### เพิ่มหรือแก้คำพ้องสำหรับ mapping

แก้ที่ `lib/mapping.ts` ในตัวแปร `ALIASES` เพื่อให้ระบบจับคู่คอลัมน์จากไฟล์ต้นทางรูปแบบใหม่ได้แม่นขึ้น

### แก้รายชื่อคอลัมน์ template

แก้ที่ `lib/mapping.ts` ใน `TEMPLATE_COLUMNS` โดยลำดับใน array นี้คือลำดับคอลัมน์ในไฟล์ export

### แก้กฎตรวจสอบข้อมูล

แก้ที่ `lib/validate.ts`:

- `REQUIRED_COLUMNS` คือคอลัมน์ที่ต้องมีข้อมูล
- `DATE_COLUMNS` คือคอลัมน์ที่ควรอยู่ในรูปแบบวันที่
- `NUMERIC_COLUMNS` คือคอลัมน์ที่ควรเป็นตัวเลข

## หมายเหตุ

- ไฟล์ที่ดาวน์โหลดจะชื่อ `converted_template.xlsx`
- ในโหมด download แอปจะสร้างชีตในไฟล์ปลายทางตามชื่อชีตต้นทาง โดยตัดชื่อชีตให้ไม่เกิน 31 ตัวอักษรตามข้อจำกัดของ Excel
- ถ้าไฟล์ต้นทางมีแถวชื่อหมวดสินทรัพย์แยกจากแถวรายการจริง แอปจะพยายามเติมค่ากลับเข้า `ชื่อสินทรัพย์` ผ่านข้อมูล `sourceAssetName`
