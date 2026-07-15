# Latest Excel Converter

เว็บแอป Next.js สำหรับแปลงข้อมูลจากไฟล์ Excel หลายรูปแบบให้เป็นไฟล์ตามเทมเพลตมาตรฐาน 44 คอลัมน์ พร้อมตรวจสอบข้อมูล แนะนำการจับคู่คอลัมน์ และดาวน์โหลดผลลัพธ์เป็นไฟล์ `.xlsx`

## ความสามารถหลัก

- รองรับไฟล์ `.xlsx` และ `.xls` ขนาดไม่เกิน 20 MB
- ตรวจทุกชีตและแปลงเฉพาะตารางข้อมูลรายสินทรัพย์ที่เข้ากับ Template 44 คอลัมน์
- ชีตสรุปที่อ้างอิงยอดจากชีตอื่น เช่น `แบบกข.` จะไม่แปลงซ้ำ และจะไม่ถูกคัดลอกเป็นชีตต้นฉบับในไฟล์ผลลัพธ์
- ตรวจจับรูปแบบชีตจากชื่อชีต header และ keyword
- รองรับ AssetData, ข้อมูลสินทรัพย์ใหม่, ทะเบียนครุภัณฑ์หลายแถว, ข้อมูลโอน/ย้าย และตารางรูปแบบยืดหยุ่น
- อ่านตารางที่ไม่มี header, header สองแถว และรหัสสินทรัพย์ที่แยกอยู่หลายคอลัมน์
- แปลงข้อมูลเป็นโครงสร้างกลาง พร้อม carry-forward หมวดหมู่จากแถวหัวกลุ่ม
- แนะนำ mapping ไปยังเทมเพลต 44 คอลัมน์เฉพาะชื่อหัวคอลัมน์ที่ตรงกันหรือ alias ที่ระบุไว้อย่างชัดเจน ไม่เดาจากคำบางส่วนหรือ fuzzy matching
- แสดงทุกชีตพร้อม profile, eligibility, เหตุผล, จำนวนแถว/error/warning และ checkbox เลือกเฉพาะชีตที่จะ export
- เลือกเริ่มต้นเฉพาะชีต ready/warning ที่ผ่าน validation; review/unsupported/skipped ไม่ถูกเลือก
- ตรวจ required fields, วันที่, ตัวเลข, สถานะ และรายการซ้ำ
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

1. อัปโหลดหรือลากไฟล์ Excel เข้าหน้าเว็บ แล้วกดอ่านไฟล์
2. ตรวจสอบ Sheet Overview แล้วเลือก checkbox เฉพาะชีตที่ต้องการ export
3. ตรวจ preview และ mapping ที่ระบบแนะนำ หรือเปิด Advanced Mapping เพื่อแก้ไข
4. ตรวจสอบ validation ของชีตที่เลือกอีกครั้ง แล้วดาวน์โหลดไฟล์ผลลัพธ์

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

รับ `multipart/form-data` โดยมี field ชื่อ `file` เป็นไฟล์ Excel และส่งกลับ `sheetOverview` ของทุกชีต พร้อม preview/mapping ของชีตที่มีข้อมูลรายสินทรัพย์สำหรับแปลงเป็น Template

### `POST /api/v1/export`

รับ JSON payload จากขั้นตอน parse โดยกำหนด `mode` ได้ 2 แบบ:

- `validate` แปลงข้อมูลและส่ง validation issues กลับเป็น JSON
- `download` แปลงข้อมูลและส่งไฟล์ `.xlsx` กลับให้ดาวน์โหลด

ทั้งสอง mode ตรวจและแปลงเฉพาะชีตที่ระบุใน `sheets` ของ request; ในโหมด `download` จะไม่คัดลอกชีตต้นฉบับที่ไม่ได้แปลงไปยังไฟล์ผลลัพธ์

## โครงสร้างโปรเจกต์

```text
app/page.tsx                 หน้าเว็บหลักสำหรับ upload, preview, mapping และ download
app/components/              UI components ของแต่ละขั้นตอน
app/api/v1/parse/route.ts    อ่านไฟล์ Excel และสร้าง data source/mapping
app/api/v1/export/route.ts   validate หรือสร้างไฟล์ Excel ปลายทาง
lib/excel.ts                 อ่าน workbook และเก็บ metadata ของแถว
lib/sheet-profile.ts         ตรวจจับรูปแบบของชีต
lib/datasource.ts            public facade และ orchestration ของ datasource
lib/datasource/              types, helpers, profile detection และ parser แยกตามรูปแบบชีต
lib/mapping.ts               template columns, aliases และ logic แนะนำ mapping
lib/transform.ts             แปลงข้อมูลเป็น template 44 คอลัมน์
lib/validate.ts               ตรวจสอบระดับชีตและระดับแถว
lib/client-types.ts           types ที่ใช้ร่วมกันระหว่าง client และ API
lib/sheet-selection.ts        นโยบายเลือกชีตเริ่มต้นสำหรับ UI/export
scripts/audit-assets.ts       audit ไฟล์ Excel จริงทั้งชุดและสร้าง JSON report
reports/asset-audit.json      รายงาน audit ล่าสุด
```

## หมายเหตุ

- ใช้ `npm run build` เพื่อตรวจสอบ TypeScript และ production build
- จำกัดสูงสุด 100 ชีต, 50,000 แถวต่อชีต, 256 คอลัมน์ต่อชีต และ 1,000,000 เซลล์ต่อ workbook
- ชื่อชีตในไฟล์ export จะอ้างอิงชื่อชีตต้นทางและถูกตัดให้ไม่เกินข้อจำกัดของ Excel
- รายการที่มีรหัสสินทรัพย์ซ้ำยัง export ได้ หากข้อมูลคอลัมน์อื่นแตกต่างกัน ระบบจะแจ้งเตือนเฉพาะรายการที่ซ้ำแบบ exact duplicate
