# Excel Template Converter

เว็บแอป Next.js สำหรับแปลงไฟล์ Excel ข้อมูลสินทรัพย์/ครุภัณฑ์หลายรูปแบบให้เป็นไฟล์ Excel ตามเทมเพลตมาตรฐาน 44 คอลัมน์ โดยระบบจะอ่าน workbook หลายชีต ตรวจรูปแบบชีต แปลงข้อมูลให้อยู่ในรูปกลาง ตรวจสอบความถูกต้อง และให้ผู้ใช้แก้ mapping ก่อนดาวน์โหลดไฟล์ปลายทาง

## ความสามารถหลัก

- อัปโหลดไฟล์ `.xlsx` หรือ `.xls`
- อ่านทุกชีตใน workbook และข้ามชีตว่างหรือชีตสรุปที่ไม่ใช่รายการสินทรัพย์
- ตรวจ profile ของชีต เช่นทะเบียนครุภัณฑ์, ครุภัณฑ์ใหม่, รับโอน/โอน และชีตสรุป
- ตรวจหาแถว header และ normalize ข้อมูลต้นทางเป็น field กลาง เช่นรหัสสินทรัพย์, ชื่อสินทรัพย์, รายละเอียด, มูลค่า, วันที่ได้รับ, หน่วยงานรับผิดชอบ และสถานะ
- carry-forward หมวด/กลุ่มสินทรัพย์จากแถวหัวกลุ่ม เช่น `ครุภัณฑ์สำนักงาน` และ `โต๊ะ (400)` ไปยังรายการจริง
- แนะนำ mapping จากคอลัมน์ต้นทางไปยังเทมเพลต 44 คอลัมน์ด้วย exact, alias และ fuzzy match
- ให้ผู้ใช้ดู preview, validation result และแก้ mapping รายชีตผ่าน Advanced Mapping
- ตรวจ error/warning หลังแปลง เช่นข้อมูล required หาย, header/summary หลุดมาเป็นข้อมูล, วันที่ผิดรูปแบบ, ตัวเลขผิดรูปแบบ, สถานะไม่อยู่ในชุดที่รองรับ และแถวซ้ำแบบ exact duplicate
- ดาวน์โหลดไฟล์ `.xlsx` ที่มี 1 ชีตปลายทางต่อ 1 ชีตต้นทาง โดยเรียงคอลัมน์ตามเทมเพลต 44 คอลัมน์

## การใช้งาน

ติดตั้ง dependencies:

```bash
npm install
```

รัน development server:

```bash
npm run dev
```

เปิดเว็บ:

```text
http://localhost:3000
```

Build และรัน production:

```bash
npm run build
npm start
```

## ขั้นตอนบนหน้าเว็บ

1. **Upload**
   เลือกหรือลากไฟล์ Excel มาวาง แล้วกดอ่านไฟล์

2. **Sheet overview / Preview**
   ระบบแสดงชีตที่แปลงได้ ชีตที่ถูกข้าม จำนวนแถว แถว header ที่ตรวจพบ ตัวอย่างข้อมูล และผล validation เบื้องต้น

3. **Mapping**
   ระบบจับคู่คอลัมน์ให้อัตโนมัติ ผู้ใช้สามารถเปิด Advanced Mapping เพื่อแก้ source column ของแต่ละ template column ได้

4. **Export**
   ระบบ validate อีกครั้งก่อนดาวน์โหลด ผู้ใช้สามารถย้อนกลับไปแก้ mapping หรือดาวน์โหลดไฟล์ Excel ได้ทันที

ไฟล์ที่ดาวน์โหลดจะชื่อ:

```text
converted_template_<ชื่อไฟล์ต้นทาง>.xlsx
```

## Flow การทำงาน

```text
Upload Excel
  -> /api/parse
  -> Read workbook with xlsx-js-style
  -> Detect sheet profile
  -> Skip empty/summary sheets
  -> Normalize source rows
  -> Suggest 44-column mapping
  -> Preview + validate
  -> User adjusts mapping
  -> /api/export?mode=validate
  -> Transform rows to template dataset
  -> Validate mapped rows
  -> /api/export?mode=download
  -> Download converted_template_<source>.xlsx
```

## รูปแบบชีตที่รองรับ

ระบบตรวจ profile จากชื่อชีตและ header/content ภายในชีต:

- `NEW_ASSET_2567`: ชีตครุภัณฑ์ใหม่ ปี 2567 หรือชีตที่มีโครงสร้างรหัสสินทรัพย์/ชนิดสินทรัพย์/รายละเอียด/ราคา
- `REGISTER_3_ROW_HEADER`: ทะเบียนครุภัณฑ์ที่มี header หลายแถวและมีคอลัมน์ลำดับ, รายการ, รหัสครุภัณฑ์, วันที่ได้รับ, มูลค่า, สภาพครุภัณฑ์
- `TRANSFER_2567`: ชีตรับโอน/โอน ที่มีเลขที่หนังสือ, รายการ, หมวดครุภัณฑ์, รหัสครุภัณฑ์, หน่วยงาน และแหล่งที่มา
- `SUMMARY_SKIP`: ชีตสรุปหรือแบบ กข ที่ระบบข้าม ไม่ส่งออกเป็นรายการ
- `UNKNOWN`: ชีตอื่น ๆ ที่ระบบพยายามอ่านด้วย header row ที่คะแนนดีที่สุด

## โครงสร้างโปรเจกต์

```text
app/page.tsx              UI หลักสำหรับ upload, preview, mapping, validation และ download
app/api/parse/route.ts    รับไฟล์ Excel, อ่าน workbook, สร้าง data source และ mapping เริ่มต้น
app/api/export/route.ts   validate ข้อมูลหรือสร้างไฟล์ Excel ปลายทาง

lib/excel.ts              อ่าน workbook ด้วย xlsx-js-style และเก็บ row metadata บางส่วน
lib/sheet-profile.ts      ตรวจ profile ของชีตจาก header, keyword และชื่อชีต
lib/datasource.ts         normalize ข้อมูลต้นทาง, ข้ามชีตที่ไม่ใช้, carry-forward กลุ่มสินทรัพย์
lib/mapping.ts            รายชื่อ template 44 คอลัมน์, aliases และ logic suggest mapping
lib/transform.ts          แปลง row ต้นทางให้เป็น row ตามเทมเพลต 44 คอลัมน์
lib/validate.ts           ตรวจ sheet-level และ row-level error/warning

scripts/check-conversion.ts  regression/diagnostic script สำหรับตรวจผลแปลงจากไฟล์ตัวอย่าง
```

## การปรับแต่ง

### แก้คอลัมน์เทมเพลต

แก้ `TEMPLATE_COLUMNS` ใน `lib/mapping.ts` ลำดับใน array นี้คือลำดับคอลัมน์ในไฟล์ export

### เพิ่มคำพ้องสำหรับ mapping

แก้ `COLUMN_ALIASES` ใน `lib/mapping.ts` เพื่อให้ระบบจับคู่ header จากไฟล์ต้นทางรูปแบบใหม่ได้แม่นขึ้น

### แก้ logic ตรวจรูปแบบชีต

แก้ keyword และ scoring ใน `lib/sheet-profile.ts` หรือ logic แปลงเฉพาะ profile ใน `lib/datasource.ts`

### แก้การแปลงข้อมูล

แก้ `lib/transform.ts` โดยเฉพาะส่วนที่ map profile ที่รู้จัก (`NEW_ASSET_2567`, `REGISTER_3_ROW_HEADER`, `TRANSFER_2567`) และ fallback mapping สำหรับชีต `UNKNOWN`

### แก้กฎ validation

แก้ `lib/validate.ts`:

- `REQUIRED_COLUMNS`: คอลัมน์ที่ต้องมีข้อมูล
- `DATE_COLUMNS`: คอลัมน์ที่ควรเป็นวันที่รูปแบบ `dd/mm/yyyy`
- `NUMERIC_COLUMNS`: คอลัมน์ที่ควรเป็นตัวเลข
- `VALID_STATUSES`: สถานะที่ระบบยอมรับ


## หมายเหตุ

- ชื่อชีตในไฟล์ export จะอิงชื่อชีตต้นทาง และถูกตัดให้ไม่เกิน 31 ตัวอักษรตามข้อจำกัดของ Excel
- คอลัมน์สำคัญบางตัว เช่น `ชื่อสินทรัพย์`, `รายละเอียด`, `ชนิดสินทรัพย์` และ `รายการสินทรัพย์` ถูกเติมจาก normalized field เป็นหลัก เพื่อเลี่ยงการ map แถวหัวกลุ่มผิดเป็นรายการจริง
- แถวที่มีรหัสสินทรัพย์ซ้ำยังสามารถ export ได้ ถ้าข้อมูลแถวอื่นต่างกัน ระบบเตือนเฉพาะแถวที่ซ้ำกันแบบ exact ทั้ง row
