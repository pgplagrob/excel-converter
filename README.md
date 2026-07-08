# Excel Template Converter

เว็บแอป Next.js สำหรับแปลงไฟล์ Excel ข้อมูลสินทรัพย์และครุภัณฑ์หลายรูปแบบให้เป็นไฟล์ Excel ตามเทมเพลตมาตรฐาน 44 คอลัมน์ ระบบอ่าน workbook แบบหลายชีต ตรวจรูปแบบชีต แปลงข้อมูลเป็นโครงสร้างกลาง ตรวจสอบ error/warning และให้ผู้ใช้แก้ mapping ก่อนดาวน์โหลดไฟล์ปลายทาง

## ความสามารถหลัก

- อัปโหลดไฟล์ `.xlsx` หรือ `.xls`
- อ่านทุกชีตใน workbook และข้ามชีตว่างหรือชีตสรุปที่ไม่ใช่รายการสินทรัพย์
- ตรวจจับรูปแบบชีตจากชื่อชีต, header และ keyword ภายในชีต
- รองรับข้อมูลครุภัณฑ์ใหม่, ทะเบียนครุภัณฑ์แบบหลายแถว header, รับโอน/โอน และชีตอื่นที่อ่านด้วย fallback header detection
- normalize ข้อมูลต้นทางเป็น field กลาง เช่น รหัสสินทรัพย์, ชื่อสินทรัพย์, รายละเอียด, มูลค่า, วันที่ได้รับ, หน่วยงานรับผิดชอบ และสถานะ
- carry-forward หมวดหรือกลุ่มสินทรัพย์จากแถวหัวกลุ่ม เช่น `ครุภัณฑ์สำนักงาน` หรือ `โต๊ะ (400)` ไปยังรายการจริง
- แนะนำ mapping จากคอลัมน์ต้นทางไปยังเทมเพลต 44 คอลัมน์ด้วย exact, alias และ fuzzy match
- แสดง preview, sheet summary, validation result และ Advanced Mapping สำหรับแก้ mapping รายชีต
- ตรวจปัญหาหลังแปลง เช่น required field หาย, header/summary หลุดมาเป็นข้อมูล, วันที่ผิดรูปแบบ, ตัวเลขผิดรูปแบบ, สถานะไม่รองรับ และแถวซ้ำแบบ exact duplicate
- ดาวน์โหลดไฟล์ `.xlsx` โดยสร้าง 1 ชีตปลายทางต่อ 1 ชีตต้นทางที่แปลงได้

## การติดตั้งและรัน

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

build และรัน production:

```bash
npm run build
npm start
```

## วิธีใช้งานบนหน้าเว็บ

1. **Upload**
   เลือกไฟล์ Excel หรือลากไฟล์มาวาง แล้วกดอ่านไฟล์

2. **Sheet overview / Preview**
   ระบบแสดงชีตที่แปลงได้ ชีตที่ถูกข้าม จำนวนแถว แถว header ที่ตรวจพบ ตัวอย่างข้อมูล และผล validation เบื้องต้น

3. **Mapping**
   ระบบจับคู่คอลัมน์ให้อัตโนมัติ ผู้ใช้สามารถเปิด Advanced Mapping เพื่อแก้ source column ของแต่ละ template column ได้

4. **Export**
   ระบบ validate อีกครั้งก่อนดาวน์โหลด ผู้ใช้สามารถย้อนกลับไปแก้ mapping หรือดาวน์โหลดไฟล์ Excel ได้ทันที

ไฟล์ที่ดาวน์โหลดจะใช้ชื่อ:

```text
converted_template_<ชื่อไฟล์ต้นทาง>.xlsx
```

## Flow การทำงาน

```text
Upload Excel
  -> POST /api/v1/parse
  -> Read workbook with xlsx-js-style
  -> Detect sheet profile
  -> Skip empty/summary sheets
  -> Normalize source rows
  -> Suggest 44-column mapping
  -> Preview + validate
  -> User adjusts mapping
  -> POST /api/v1/export with mode=validate
  -> Transform rows to template dataset
  -> Validate mapped rows
  -> POST /api/v1/export with mode=download
  -> Download converted_template_<source>.xlsx
```

## รูปแบบชีตที่รองรับ

ระบบตรวจ profile ชั้นแรกเป็น `registry`, `newAsset`, `transfer`, `disposal`, `summary` หรือ `unknown` จาก `lib/sheet-profile.ts` แล้วแปลงเป็น legacy profile ที่ใช้ใน data source และ export:

- `NEW_ASSET_2567`: ชีตครุภัณฑ์ใหม่ หรือชีตที่มีโครงสร้างรหัสสินทรัพย์, ชนิดสินทรัพย์, รายละเอียดสินทรัพย์ และราคา
- `REGISTER_3_ROW_HEADER`: ทะเบียนครุภัณฑ์ที่มี header หลายแถว เช่น ลำดับ, รายการ, รหัสครุภัณฑ์, วันที่ได้รับ, มูลค่า และสภาพครุภัณฑ์
- `TRANSFER_2567`: ชีตรับโอน/โอนที่มีเลขที่หนังสือ, รายการ, หมวดครุภัณฑ์, รหัสครุภัณฑ์, หน่วยงาน และแหล่งที่มา
- `SUMMARY_SKIP`: ชีตสรุปหรือแบบ กข ที่ระบบข้ามและไม่ส่งออก
- `UNKNOWN`: ชีตอื่น ๆ ที่ระบบพยายามอ่านด้วย header row ที่ได้คะแนนดีที่สุด

ถ้าชีตไม่มีแถวข้อมูลสินทรัพย์หลัง parse ระบบจะข้ามชีตนั้นและแสดงเหตุผลในหน้า preview

## API

### `POST /api/v1/parse`

รับ `multipart/form-data` ที่มี field `file` เป็น Excel file แล้วตอบกลับข้อมูลสำหรับหน้า preview:

- `fileName`: ชื่อไฟล์ต้นทาง
- `sheets`: ชีตที่ parse ได้ พร้อม headers, sampleRows, rows, mapping และ summary
- `skippedSheets`: รายชื่อชีตที่ถูกข้าม
- `skippedSheetSummaries`: summary ของชีตที่ถูกข้าม
- `sheetProfileDebug`: debug information ของการตรวจ profile

### `POST /api/v1/export`

รับ JSON payload ของชีตที่ parse แล้ว โดยกำหนด `mode` ได้ 2 แบบ:

- `validate`: แปลงข้อมูลและส่ง validation issues กลับเป็น JSON
- `download`: แปลงข้อมูลและส่งไฟล์ `.xlsx` กลับให้ดาวน์โหลด

## โครงสร้างโปรเจกต์

```text
app/page.tsx                 UI หลักสำหรับ upload, preview, mapping, validation และ download
app/components/              component ของแต่ละขั้นตอนและส่วนแสดงผล
app/api/v1/parse/route.ts    รับไฟล์ Excel, อ่าน workbook, สร้าง data source และ mapping เริ่มต้น
app/api/v1/export/route.ts   validate ข้อมูลหรือสร้างไฟล์ Excel ปลายทาง

lib/excel.ts                 อ่าน workbook ด้วย xlsx-js-style และเก็บ row metadata บางส่วน
lib/sheet-profile.ts         ตรวจ profile ของชีตจาก header, keyword และชื่อชีต
lib/datasource.ts            normalize ข้อมูลต้นทาง, ข้ามชีตที่ไม่ใช้, carry-forward กลุ่มสินทรัพย์
lib/mapping.ts               รายชื่อ template 44 คอลัมน์, aliases และ logic suggest mapping
lib/transform.ts             แปลง row ต้นทางให้เป็น row ตามเทมเพลต 44 คอลัมน์
lib/validate.ts              ตรวจ sheet-level และ row-level error/warning
lib/client-types.ts          type ที่ใช้ร่วมกันระหว่าง client และ API routes
```

## การปรับแต่ง

### แก้คอลัมน์เทมเพลต

แก้ `TEMPLATE_COLUMNS` ใน `lib/mapping.ts` ลำดับใน array นี้คือลำดับคอลัมน์ในไฟล์ export

### เพิ่มคำพ้องสำหรับ mapping

แก้ `COLUMN_ALIASES` ใน `lib/mapping.ts` เพื่อให้ระบบจับคู่ header จากไฟล์ต้นทางรูปแบบใหม่ได้แม่นขึ้น

### แก้ logic ตรวจรูปแบบชีต

แก้ keyword และ scoring ใน `lib/sheet-profile.ts` หรือ logic แปลง profile ใน `lib/datasource.ts`

### แก้การ normalize ข้อมูลต้นทาง

แก้ parser เฉพาะรูปแบบใน `lib/datasource.ts`:

- `parseNewAssetSheet`
- `parseRegisterSheet`
- `parseTransferSheet`
- `parseUnknownSheet`

### แก้การแปลงเป็นเทมเพลต

แก้ `lib/transform.ts` โดยเฉพาะ logic ของ profile ที่รู้จัก (`NEW_ASSET_2567`, `REGISTER_3_ROW_HEADER`, `TRANSFER_2567`) และ fallback mapping สำหรับชีต `UNKNOWN`

### แก้กฎ validation

แก้ `lib/validate.ts`:

- `REQUIRED_COLUMNS`: คอลัมน์ที่ต้องมีข้อมูล
- `DATE_COLUMNS`: คอลัมน์ที่ควรเป็นวันที่รูปแบบ `dd/mm/yyyy`
- `NUMERIC_COLUMNS`: คอลัมน์ที่ควรเป็นตัวเลข
- `VALID_STATUSES`: สถานะที่ระบบยอมรับ

## หมายเหตุ

- ชื่อชีตในไฟล์ export จะอิงชื่อชีตต้นทาง และถูกตัดให้ไม่เกิน 31 ตัวอักษรตามข้อจำกัดของ Excel
- คอลัมน์สำคัญบางตัว เช่น `ชื่อสินทรัพย์`, `รายละเอียด`, `ชนิดสินทรัพย์` และ `รายการสินทรัพย์` ถูกเติมจาก normalized field เป็นหลัก เพื่อเลี่ยงการ map แถวหัวกลุ่มผิดเป็นรายการจริง
- แถวที่มีรหัสสินทรัพย์ซ้ำยังสามารถ export ได้ ถ้าข้อมูลช่องอื่นแตกต่างกัน ระบบเตือนเฉพาะแถวที่ซ้ำกันแบบ exact ทั้ง row
- โปรเจกต์นี้ยังไม่มี test script ใน `package.json`; ใช้ `npm run build` เป็นการตรวจ TypeScript และ production build หลักก่อนส่งงาน
