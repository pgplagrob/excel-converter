# Latest Excel Converter

เว็บแอปสำหรับแปลงข้อมูลจากไฟล์ Excel หลายรูปแบบให้เป็นไฟล์ตามเทมเพลตมาตรฐานของบริษัทVizzel Intel Access พร้อมตรวจสอบข้อมูล แนะนำการจับคู่คอลัมน์ และดาวน์โหลดผลลัพธ์เป็นไฟล์ `.xlsx` โดยแยก Next.js frontend และ API backend เป็นคนละ process

## ความสามารถหลัก

- รองรับไฟล์ `.xlsx` และ `.xls` ขนาดไม่เกิน 20 MB
- ตรวจทุกชีตและแปลงเฉพาะตารางข้อมูลรายสินทรัพย์ที่เข้ากับ Template
- ชีตสรุปที่อ้างอิงยอดจากชีตอื่น เช่น `แบบกข.` จะไม่แปลงซ้ำ และจะไม่ถูกคัดลอกเป็นชีตต้นฉบับในไฟล์ผลลัพธ์
- ตรวจจับรูปแบบชีตจากชื่อชีต header และ keyword
- รองรับ AssetData, ข้อมูลสินทรัพย์ใหม่, ทะเบียนครุภัณฑ์หลายแถว, ข้อมูลโอน/ย้าย และตารางรูปแบบยืดหยุ่น
- อ่านตารางที่ไม่มี header, header สองแถว และรหัสสินทรัพย์ที่แยกอยู่หลายคอลัมน์
- แปลงข้อมูลเป็นโครงสร้างกลาง พร้อม carry-forward หมวดหมู่จากแถวหัวกลุ่ม
- แนะนำ mapping ไปยังคอลัมน์ของเทมเพลตเฉพาะชื่อหัวคอลัมน์ที่ตรงกันหรือ alias ที่ระบุไว้อย่างชัดเจน ไม่เดาจากคำบางส่วนหรือ fuzzy matching
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

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Frontend จะ proxy request `/api/*` ไป backend อัตโนมัติ

ถ้า backend อยู่คนละ URL ให้กำหนด `BACKEND_URL` ก่อน build/run frontend เช่น PowerShell:

```powershell
$env:BACKEND_URL = "https://api.example.com"
npm.cmd run build
```

สำหรับ production:

```bash
npm run build
npm start
```

รันชุดทดสอบ:

```bash
npm test
```

Audit ไฟล์จริงทั้งหมดใต้ `backend/assets/เทศบาลนครลำปาง/`:

```bash
npm run audit:assets
```

ผลแบบ machine-readable จะอยู่ที่ `backend/reports/asset-audit.json` และมีสรุปรายไฟล์/รายชีต, profile, eligibility, row/error/warning count และเหตุผลที่ไม่ export

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
  -> แนะนำ mapping ตามคอลัมน์ของ template
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

- ไฟล์ที่อัปโหลดเก็บไว้ที่ `backend/data/templates/` (อยู่นอก git, ไม่ถูกลบเวลา restart server ต่างจาก `analysis-store` ที่เก็บในหน่วยความจำ) เก็บย้อนหลังสูงสุด 5 เวอร์ชัน กดย้อนกลับได้จากหน้า settings
- ตรวจสอบก่อนสลับเฉพาะสิ่งที่ทำให้แอปพังจริง: ไฟล์เปิดได้, มีชีต `Sheet1`/`Reference`, แถวหัวตารางไม่ว่าง — ไฟล์ที่มี data validation แบบเต็มคอลัมน์ (เช่น dropdown ที่ลากยาวทั้งคอลัมน์ใน Excel) จะถูก sanitize อัตโนมัติเหมือนไฟล์ที่ผู้ใช้อัปโหลดในหน้าแปลงไฟล์ปกติ ป้องกันปัญหาเซิร์ฟเวอร์ค้างที่เคยเกิดขึ้น
- ถ้าคอลัมน์ในไฟล์ใหม่ไม่ตรงกับ `TEMPLATE_COLUMNS` ใน `backend/lib/mapping.ts` (รายชื่อคอลัมน์ที่ระบบใช้แนะนำ mapping อัตโนมัติ) หน้า settings จะเตือนคอลัมน์ที่ขาด/เพิ่มมาให้เห็น แต่ยังให้สลับไฟล์ได้ตามปกติ — คอลัมน์ที่ต่างไปจะต้องจับคู่ mapping มือในหน้าแปลงไฟล์
- ไม่มีระบบ authentication/สิทธิ์การเข้าถึงหน้านี้ เช่นเดียวกับส่วนอื่นของแอป (เครื่องมือใช้ภายในทีมที่ไว้ใจเครือข่ายที่เข้าถึงได้)

## โครงสร้างโปรเจกต์

```text
package.json                   npm workspace และคำสั่งรวมสำหรับรันสอง service
run-apps.mjs                   เปิด/หยุด frontend กับ backend พร้อมกัน
frontend/app/                  หน้าเว็บหลัก, settings และ UI components
frontend/lib/                  type contract และ helper ที่ใช้เฉพาะใน browser
frontend/next.config.js        proxy /api/* ไป BACKEND_URL (ค่าเริ่มต้นพอร์ต 3001)
backend/app/api/v1/            route ของ parse, export, reparse และ admin template
backend/lib/                   Excel parsing, datasource, mapping, validation และ export logic
backend/assets/                factory template และไฟล์ต้นทางสำหรับ audit
backend/data/templates/        template ที่อัปโหลดผ่านหน้า settings (ไม่เก็บใน git)
backend/tests/                 ชุดทดสอบ backend และ conversion logic
backend/scripts/audit-assets.ts  audit ไฟล์ Excel จริงและสร้าง JSON report
backend/reports/asset-audit.json รายงาน audit ล่าสุด
```

## หมายเหตุ

- ใช้ `npm run build` เพื่อตรวจสอบ TypeScript และ production build
- จำกัดสูงสุด 100 ชีต, 50,000 แถวต่อชีต, 256 คอลัมน์ต่อชีต และ 1,000,000 เซลล์ต่อ workbook
- ชื่อชีตในไฟล์ export จะอ้างอิงชื่อชีตต้นทางและถูกตัดให้ไม่เกินข้อจำกัดของ Excel
- รายการที่มีรหัสสินทรัพย์ซ้ำยัง export ได้ หากข้อมูลคอลัมน์อื่นแตกต่างกัน ระบบจะแจ้งเตือนเฉพาะรายการที่ซ้ำแบบ exact duplicate
