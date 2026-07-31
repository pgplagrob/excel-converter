# Latest Excel Converter

เว็บแอป Next.js สำหรับแปลงข้อมูลจากไฟล์ Excel หลายรูปแบบให้เป็นไฟล์ตามเทมเพลตมาตรฐาน 50 คอลัมน์ พร้อมตรวจสอบข้อมูล แนะนำการจับคู่คอลัมน์ และดาวน์โหลดผลลัพธ์เป็นไฟล์ `.xlsx`

## ความสามารถหลัก

- รองรับไฟล์ `.xlsx` และ `.xls` ขนาดไม่เกิน 20 MB
- ตรวจทุกชีตและแปลงเฉพาะตารางข้อมูลรายสินทรัพย์ที่เข้ากับ Template 50 คอลัมน์
- ชีตสรุปที่อ้างอิงยอดจากชีตอื่น เช่น `แบบกข.` จะไม่แปลงซ้ำ และจะไม่ถูกคัดลอกเป็นชีตต้นฉบับในไฟล์ผลลัพธ์
- ตรวจจับรูปแบบชีตจากชื่อชีต header และ keyword
- รองรับ AssetData, ข้อมูลสินทรัพย์ใหม่, ทะเบียนครุภัณฑ์หลายแถว, ข้อมูลโอน/ย้าย และตารางรูปแบบยืดหยุ่น
- อ่านตารางที่ไม่มี header, header สองแถว และรหัสสินทรัพย์ที่แยกอยู่หลายคอลัมน์
- แปลงข้อมูลเป็นโครงสร้างกลาง พร้อม carry-forward หมวดหมู่จากแถวหัวกลุ่ม
- แนะนำ mapping ไปยังเทมเพลต 50 คอลัมน์เฉพาะชื่อหัวคอลัมน์ที่ตรงกันหรือ alias ที่ระบุไว้อย่างชัดเจน ไม่เดาจากคำบางส่วนหรือ fuzzy matching
- แสดงทุกชีตพร้อม profile, eligibility, เหตุผล และจำนวนแถว/error/warning; ชีตที่ผ่านนโยบาย export ถูกเลือกโดยอัตโนมัติ ไม่มี checkbox ให้ผู้ใช้ปิด/เปิดเอง
- Advanced Mapping: override การจับคู่คอลัมน์เป็นรายคอลัมน์ต่อชีต, บังคับให้ช่องว่าง หรือคืนค่า auto ได้
- แก้ไขข้อมูลเฉพาะจุดจาก validation issue ได้ (แก้ค่าเซลล์ หรือตัดทั้งแถวออกจาก export) โดยไม่ต้องแก้ไฟล์ต้นฉบับ
- ตรวจ required fields, วันที่, ตัวเลข, สถานะ และรายการซ้ำ
- เมื่อแก้ mapping/เซลล์/ตัดแถวหลังตรวจสอบไปแล้ว ระบบจะแจ้งว่าเป็นผลลัพธ์เก่า (stale) จนกว่าจะกดตรวจสอบซ้ำ
- Export เป็นไฟล์ Excel ที่มีเฉพาะชีต Template ที่ผ่านการตรวจสอบ พร้อมเพิ่ม `Reference`

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

รันชุดทดสอบ:

```bash
npm test
```

Audit ไฟล์จริงทั้งหมดใต้ `assets/เทศบาลนครลำปาง/`:

```bash
npm run audit:assets
```

ผลแบบ machine-readable จะอยู่ที่ `reports/asset-audit.json` และมีสรุปรายไฟล์/รายชีต, profile, eligibility, row/error/warning count และเหตุผลที่ไม่ export

## วิธีใช้งาน

1. อัปโหลดหรือลากไฟล์ Excel เข้าหน้าเว็บ ระบบจะอ่านไฟล์และตรวจสอบทุกชีตให้อัตโนมัติ
2. เลือกชีตจากแถบ "เลือกชีตเพื่อตรวจสอบ" เพื่อดู preview, mapping และผล validation ของแต่ละชีต (ชีตที่เก็บต้นฉบับ/ข้ามจะแยกกลุ่มไว้ต่างหาก)
3. แก้ไขได้ตามจำเป็น: เปิด Advanced Mapping เพื่อจับคู่คอลัมน์เอง, แก้ค่าเซลล์ที่มีปัญหา หรือตัดแถวที่ไม่ต้องการออก
4. กด "ตรวจสอบชีตที่เลือกและไป Export" เพื่อตรวจสอบล่าสุดอีกครั้ง แล้วดาวน์โหลดไฟล์ผลลัพธ์

ไฟล์ที่ดาวน์โหลดจะใช้ชื่อรูปแบบ `converted_template_<ชื่อไฟล์ต้นทาง>.xlsx`

## Flow การทำงาน

```text
Upload Excel
  -> POST /api/v1/parse
  -> อ่าน workbook และตรวจจับรูปแบบชีต
  -> Normalize ข้อมูลต้นทาง
  -> แนะนำ mapping 50 คอลัมน์
  -> Preview และ validate
  -> POST /api/v1/export (mode=validate)
  -> ผู้ใช้แก้ mapping/เซลล์/ตัดแถวได้ตามต้องการ (ผลตรวจสอบเดิมจะถูกทำเครื่องหมายว่า stale)
  -> POST /api/v1/export (mode=validate) ซ้ำเพื่ออัปเดตผล
  -> POST /api/v1/export (mode=download)
  -> Download converted_template_<source>.xlsx
```

## API

### `POST /api/v1/parse`

รับ `multipart/form-data` โดยมี field ชื่อ `file` เป็นไฟล์ Excel และส่งกลับ `sheetOverview` ของทุกชีต พร้อม preview/mapping ของชีตที่มีข้อมูลรายสินทรัพย์สำหรับแปลงเป็น Template

### `POST /api/v1/export`

รับ JSON payload จากขั้นตอน parse โดยกำหนด `mode` ได้ 2 แบบ:

- `validate` แปลงข้อมูลและส่ง validation issues กลับเป็น JSON
- `download` แปลงข้อมูลและส่งไฟล์ `.xlsx` กลับให้ดาวน์โหลด

ทั้งสอง mode ตรวจและแปลงเฉพาะชีตที่ระบุใน `sheets` ของ request; ในโหมด `download` จะไม่คัดลอกชีตต้นฉบับที่ไม่ได้แปลงไปยังไฟล์ผลลัพธ์

### `POST /api/v1/reparse-sheet`

รับ `analysisId`, `sheetName` และ `headerRow` (พร้อม `dataStartRow`/`dataEndRow` ถ้าต้องระบุ) เพื่อวิเคราะห์ชีตเดิมใหม่โดยใช้แถวหัวตารางที่กำหนดเอง แล้วส่ง `sheet` ที่ parse ใหม่กลับมา

### `GET/POST /api/v1/admin/template`

`GET` ส่งสถานะ template ปัจจุบัน (ค่าเริ่มต้นหรือไฟล์ที่อัปโหลด, รายชื่อคอลัมน์, ความต่างจาก `TEMPLATE_COLUMNS`) พร้อมประวัติเวอร์ชัน

`POST` รับ `multipart/form-data` field `file` เพื่ออัปโหลด template ใหม่ ระบบตรวจว่าไฟล์เปิดได้, มีชีต `Sheet1`/`Reference` และแถวหัวตารางไม่ว่าง ก่อนสลับไปใช้ไฟล์นี้ทันที — คอลัมน์ที่ไม่ตรงกับ `TEMPLATE_COLUMNS` จะขึ้นเป็นคำเตือนแต่ไม่บล็อกการสลับ

### `POST /api/v1/admin/template/rollback`

รับ `{ versionId }` เพื่อย้อนกลับไปใช้ template เวอร์ชันก่อนหน้าที่ยังเก็บไว้ (สูงสุด 5 เวอร์ชันล่าสุด)

## ตั้งค่า Template (`/settings`)

บริษัทเปลี่ยนไฟล์ template บ่อย หน้า `/settings` (ลิงก์ "⚙ ตั้งค่า Template" มุมขวาบนของทุกหน้า) ให้สลับไฟล์ template ที่ระบบใช้สร้างผลลัพธ์ export ได้เองโดยไม่ต้องแก้โค้ดหรือ deploy ใหม่

- ไฟล์ที่อัปโหลดเก็บไว้ที่ `data/templates/` (อยู่นอก git, ไม่ถูกลบเวลา restart server ต่างจาก `analysis-store` ที่เก็บในหน่วยความจำ) เก็บย้อนหลังสูงสุด 5 เวอร์ชัน กดย้อนกลับได้จากหน้า settings
- ตรวจสอบก่อนสลับเฉพาะสิ่งที่ทำให้แอปพังจริง: ไฟล์เปิดได้, มีชีต `Sheet1`/`Reference`, แถวหัวตารางไม่ว่าง — ไฟล์ที่มี data validation แบบเต็มคอลัมน์ (เช่น dropdown ที่ลากยาวทั้งคอลัมน์ใน Excel) จะถูก sanitize อัตโนมัติเหมือนไฟล์ที่ผู้ใช้อัปโหลดในหน้าแปลงไฟล์ปกติ ป้องกันปัญหาเซิร์ฟเวอร์ค้างที่เคยเกิดขึ้น
- ถ้าคอลัมน์ในไฟล์ใหม่ไม่ตรงกับ `TEMPLATE_COLUMNS` ใน `lib/mapping.ts` (รายชื่อคอลัมน์ที่ระบบใช้แนะนำ mapping อัตโนมัติ) หน้า settings จะเตือนคอลัมน์ที่ขาด/เพิ่มมาให้เห็น แต่ยังให้สลับไฟล์ได้ตามปกติ — คอลัมน์ที่ต่างไปจะต้องจับคู่ mapping มือในหน้าแปลงไฟล์
- ไม่มีระบบ authentication/สิทธิ์การเข้าถึงหน้านี้ เช่นเดียวกับส่วนอื่นของแอป (เครื่องมือใช้ภายในทีมที่ไว้ใจเครือข่ายที่เข้าถึงได้)

## โครงสร้างโปรเจกต์

```text
app/page.tsx                   หน้าเว็บหลัก คุม state ของ upload, preview, mapping, fix และ download
app/components/                UI components ของแต่ละขั้นตอน (UploadStep, PreviewStep, SheetTabs,
                                MappingSummary, SourcePreviewTable, IssueList, DownloadStep, ...)
app/api/v1/parse/route.ts      อ่านไฟล์ Excel และสร้าง data source/mapping
app/api/v1/export/route.ts     validate หรือสร้างไฟล์ Excel ปลายทาง
app/api/v1/reparse-sheet/route.ts  วิเคราะห์ชีตเดิมใหม่ด้วยแถวหัวตารางที่กำหนดเอง
app/api/v1/admin/template/route.ts          สถานะ template ปัจจุบัน (GET) และอัปโหลด template ใหม่ (POST)
app/api/v1/admin/template/rollback/route.ts ย้อนกลับไปใช้ template เวอร์ชันก่อนหน้า
app/settings/page.tsx          หน้าตั้งค่า template (อัปโหลด/ดูความต่างของคอลัมน์/ย้อนกลับ)
lib/excel.ts                   อ่าน workbook และเก็บ metadata ของแถว
lib/xlsx-sanitize.ts           ตัด/ลดขอบเขต data validation แบบเต็มคอลัมน์ก่อนส่งให้ ExcelJS กันเซิร์ฟเวอร์ค้าง
lib/template-store.ts          เก็บ/ตรวจสอบ/ย้อนกลับไฟล์ template ที่อัปโหลดผ่านหน้า settings (data/templates/)
lib/sheet-profile.ts           ตรวจจับรูปแบบของชีต
lib/datasource.ts              public facade และ orchestration ของ datasource
lib/datasource/                types, helpers, profile detection และ parser แยกตามรูปแบบชีต
lib/build-sheet-data.ts        ประกอบ SheetData (rows + mapping + summary) ที่ client ใช้
lib/mapping.ts                 template columns, aliases และ logic แนะนำ mapping
lib/mapping-profiles.ts        จำ mapping ที่เคยยืนยันไว้ต่อ header signature
lib/manual-mapping.ts          จัดการ override การจับคู่คอลัมน์ที่ผู้ใช้ตั้งเอง
lib/row-fixes.ts               ใช้ cell override และ excluded rows กับข้อมูลก่อน export
lib/reparse-sheet.ts           ตรรกะ reparse ชีตเดิมด้วยแถวหัวตารางใหม่
lib/reparse-request.ts         แปลง/ตรวจสอบ payload ของ /api/v1/reparse-sheet
lib/export-request.ts          แปลง/ตรวจสอบ payload ของ /api/v1/export
lib/transform.ts               แปลงข้อมูลเป็น template 50 คอลัมน์
lib/validate.ts                ตรวจสอบระดับชีตและระดับแถว
lib/client-types.ts            types ที่ใช้ร่วมกันระหว่าง client และ API
lib/sheet-selection.ts         นโยบายเลือกชีตอัตโนมัติสำหรับ UI/export
lib/analysis-store.ts          เก็บผล parse ต่อ analysisId ไว้ในหน่วยความจำสำหรับ export/reparse
scripts/audit-assets.ts        audit ไฟล์ Excel จริงทั้งชุดและสร้าง JSON report
reports/asset-audit.json       รายงาน audit ล่าสุด
```

## หมายเหตุ

- ใช้ `npm run build` เพื่อตรวจสอบ TypeScript และ production build
- จำกัดสูงสุด 100 ชีต, 50,000 แถวต่อชีต, 256 คอลัมน์ต่อชีต และ 1,000,000 เซลล์ต่อ workbook
- ชื่อชีตในไฟล์ export จะอ้างอิงชื่อชีตต้นทางและถูกตัดให้ไม่เกินข้อจำกัดของ Excel
- รายการที่มีรหัสสินทรัพย์ซ้ำยัง export ได้ หากข้อมูลคอลัมน์อื่นแตกต่างกัน ระบบจะแจ้งเตือนเฉพาะรายการที่ซ้ำแบบ exact duplicate
