# Excel Template Converter

เว็บแอป Next.js สำหรับแปลงข้อมูลจากไฟล์ Excel หลายรูปแบบให้เป็นไฟล์ตามเทมเพลตมาตรฐาน 44 คอลัมน์ พร้อมตรวจสอบข้อมูล แนะนำการจับคู่คอลัมน์ และดาวน์โหลดผลลัพธ์เป็นไฟล์ `.xlsx`

## ความสามารถหลัก

- รองรับไฟล์ `.xlsx` และ `.xls`
- อ่าน workbook หลายชีต พร้อมข้ามชีตว่างและชีตสรุปที่ไม่ใช่ข้อมูลสินทรัพย์
- ตรวจจับรูปแบบชีตจากชื่อชีต header และ keyword
- รองรับข้อมูลสินทรัพย์ใหม่ ทะเบียนครุภัณฑ์หลายแถว และข้อมูลโอน/ย้าย
- แปลงข้อมูลเป็นโครงสร้างกลาง พร้อม carry-forward หมวดหมู่จากแถวหัวกลุ่ม
- แนะนำ mapping ไปยังเทมเพลต 44 คอลัมน์ด้วย exact, alias และ fuzzy matching
- แสดง preview, สรุปแต่ละชีต, validation issues และ Advanced Mapping
- ตรวจ required fields, วันที่, ตัวเลข, สถานะ และรายการซ้ำ
- Export เป็นไฟล์ Excel โดยสร้างชีตปลายทางต่อหนึ่งชีตต้นทางที่แปลงสำเร็จ

## การติดตั้งและรัน

```bash
npm install
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

สำหรับ production:

```bash
npm run build
npm start
```

## วิธีใช้งาน

1. อัปโหลดหรือลากไฟล์ Excel เข้าหน้าเว็บ แล้วกดอ่านไฟล์
2. ตรวจสอบ Sheet Overview, preview และผล validation เบื้องต้น
3. ตรวจสอบ mapping ที่ระบบแนะนำ หรือเปิด Advanced Mapping เพื่อแก้ไข
4. ตรวจสอบ validation อีกครั้ง แล้วดาวน์โหลดไฟล์ผลลัพธ์

ไฟล์ที่ดาวน์โหลดจะใช้ชื่อรูปแบบ `converted_template_<ชื่อไฟล์ต้นทาง>.xlsx`

## Flow การทำงาน

```text
Upload Excel
  -> POST /api/v1/parse
  -> อ่าน workbook และตรวจจับรูปแบบชีต
  -> Normalize ข้อมูลต้นทาง
  -> แนะนำ mapping 44 คอลัมน์
  -> Preview และ validate
  -> POST /api/v1/export (mode=validate)
  -> ผู้ใช้แก้ mapping ได้ตามต้องการ
  -> POST /api/v1/export (mode=download)
  -> Download converted_template_<source>.xlsx
```

## API

### `POST /api/v1/parse`

รับ `multipart/form-data` โดยมี field ชื่อ `file` เป็นไฟล์ Excel และส่งกลับข้อมูล preview, sheets, mappings และรายการชีตที่ถูกข้าม

### `POST /api/v1/export`

รับ JSON payload จากขั้นตอน parse โดยกำหนด `mode` ได้ 2 แบบ:

- `validate` แปลงข้อมูลและส่ง validation issues กลับเป็น JSON
- `download` แปลงข้อมูลและส่งไฟล์ `.xlsx` กลับให้ดาวน์โหลด

## โครงสร้างโปรเจกต์

```text
app/page.tsx                 หน้าเว็บหลักสำหรับ upload, preview, mapping และ download
app/components/              UI components ของแต่ละขั้นตอน
app/api/v1/parse/route.ts    อ่านไฟล์ Excel และสร้าง data source/mapping
app/api/v1/export/route.ts   validate หรือสร้างไฟล์ Excel ปลายทาง
lib/excel.ts                 อ่าน workbook และเก็บ metadata ของแถว
lib/sheet-profile.ts         ตรวจจับรูปแบบของชีต
lib/datasource.ts            normalize ข้อมูลและแปลงตามรูปแบบชีต
lib/mapping.ts               template columns, aliases และ logic แนะนำ mapping
lib/transform.ts             แปลงข้อมูลเป็น template 44 คอลัมน์
lib/validate.ts               ตรวจสอบระดับชีตและระดับแถว
lib/client-types.ts           types ที่ใช้ร่วมกันระหว่าง client และ API
```

## หมายเหตุ

- ใช้ `npm run build` เพื่อตรวจสอบ TypeScript และ production build
- ชื่อชีตในไฟล์ export จะอ้างอิงชื่อชีตต้นทางและถูกตัดให้ไม่เกินข้อจำกัดของ Excel
- รายการที่มีรหัสสินทรัพย์ซ้ำยัง export ได้ หากข้อมูลคอลัมน์อื่นแตกต่างกัน ระบบจะแจ้งเตือนเฉพาะรายการที่ซ้ำแบบ exact duplicate
