# ปัญหาใหญ่ของระบบ Excel Converter

สถานะเอกสาร: ตรวจจากโค้ด frontend/backend, test suite, Template จริง, ไฟล์เทศบาลตัวอย่าง และภาพระบบปลายทาง ณ วันที่ 2026-09-05

เอกสารนี้เป็นรายการปัญหาและข้อเสนอเชิงออกแบบ ยังไม่มีการแก้ production code

## 1. ขอบเขตที่ตรวจ

- Frontend: flow อัปโหลด → ตรวจสอบ → Advanced Mapping → ดาวน์โหลด และหน้าจัดการ Template
- Backend: parse, profile detection, header detection, mapping, validation, reparse, export, template store และ analysis store
- ไฟล์ Template: `backend/assets/asset-template.xlsx`
- ไฟล์เทศบาลตัวอย่าง: `backend/assets/ครุภัณฑ์สำนักปลัดเทศบาล67 แบบ กข แก้ไข15-11-67.xlsx`
- ภาพระบบปลายทาง VizzelTrack ที่ผู้ใช้แนบ: หน้ารายการสินทรัพย์และหน้าแก้ไขสินทรัพย์
- การตรวจอัตโนมัติ: test, typecheck, production build และ asset audit

## 2. กติกาธุรกิจที่ต้องถือเป็นหลัก

1. ข้อมูลจากไฟล์ต้นฉบับต้องไม่หายทั้งระดับแถว คอลัมน์ และค่าในเซลล์
2. ระบบทำหน้าที่จับคู่/ย้ายข้อมูลเข้า Template ไม่ใช่แก้ข้อเท็จจริงในไฟล์เทศบาล
3. ค่าว่างต้องคงว่าง ระบบแจ้งเตือนได้แต่ห้ามเดาหรือเติมข้อมูลแทนผู้ใช้
4. คอลัมน์ต้นฉบับหนึ่งคอลัมน์ต้องไม่ถูกคัดลอกซ้ำไปหลายช่องโดยไม่ตั้งใจ
5. ไฟล์ผลลัพธ์ต้องคงโครงสร้างที่เว็บปลายทางยอมรับ จึงห้ามเพิ่มคอลัมน์หรือชีตเองก่อนยืนยันสัญญาการนำเข้า
6. ทุกการเปลี่ยน Header Row และ Mapping ต้องตรวจสอบย้อนหลังได้ว่าใครเปลี่ยนอะไร จากค่าใดเป็นค่าใด
7. คำว่า “พร้อมส่งออก” ใช้ได้ต่อเมื่อพิสูจน์ความครบถ้วนและผ่านกติกาของเว็บปลายทาง ไม่ใช่เพียงไม่มี validation error ในระบบนี้

## 3. ภาพรวมไฟล์จริง

### Template

- `Sheet1` มี 53 คอลัมน์
- `Reference` มี 15 กลุ่มข้อมูลอ้างอิง
- รายชื่อและลำดับ 53 คอลัมน์ในไฟล์ตรงกับ `TEMPLATE_COLUMNS` ในโค้ดปัจจุบัน
- จากขั้นตอนธุรกิจและภาพระบบปลายทาง ต้องถือว่าโครงสร้างนี้เป็น contract แบบตายตัวจนกว่าจะทดสอบนำเข้าจริง

### ไฟล์เทศบาลตัวอย่าง

- มี 21 ชีต
- ระบบ parse เป็นข้อมูล 20 ชีต และข้ามชีตสรุป `แบบกข.`
- ระบบสร้างแถวผลลัพธ์รวม 2,602 แถว
- validation ปัจจุบันรายงาน 0 errors แต่มี 9,514 warnings
- warning หลักมาจากค่าไม่อยู่ใน Reference:
  - ชนิดสินทรัพย์ 2,565 รายการ
  - รายการสินทรัพย์ 2,326 รายการ
  - งาน 2,286 รายการ
  - สถานะ 2,148 รายการ
- ตัวเลข “0 errors” ยังไม่พิสูจน์ว่าไม่มีข้อมูลหาย เพราะ parser ตัดบางแถวก่อน validation และระบบไม่มีรายงาน reconciliation

### รูปแบบ Header ที่พบจริง

- `สำนักงาน`: แถว 1–2 เป็นชื่อรายงาน, แถว 3 ว่าง, แถว 4–6 เป็นหัวตาราง 3 ชั้น
- `โอน2567`: แถว 1–3 เป็นชื่อรายงานซ้ำจาก merged cells, แถว 4 เป็นหัวตาราง, แถว 5 เริ่มข้อมูล
- `ครุภัณฑ์ใหม่2567`: หัวตารางอยู่แถว 1 แต่วันที่ถูกแยกเป็น 3 คอลัมน์ที่มีชื่อเหมือนกัน
- หลายชีตมีแถวหมวดหมู่/กลุ่มรายการคั่นอยู่ระหว่างข้อมูลจริง

## 4. P0 — ต้องแก้ก่อนเชื่อถือไฟล์ผลลัพธ์

### P0-01: มีโอกาสทิ้งแถวข้อมูลก่อนเข้าสู่ validation แบบเงียบ ๆ

Parser หลายตัวใช้เงื่อนไขตัดแถวทิ้ง เช่น ต้องมีรหัสที่ดูเหมือนรหัสสินทรัพย์และต้องมีชื่อ จึงจะสร้าง row สำหรับขั้นตอนถัดไป

หลักฐาน:

- `backend/lib/datasource/parsers/register.ts:199-207`
- `backend/lib/datasource/parsers/new-asset.ts:23-52`
- `backend/lib/datasource/parsers/transfer.ts:17-25`
- `backend/lib/datasource/parsers/asset-data.ts:38-42`
- `backend/lib/datasource/parsers/flexible.ts:231-234`

ผลกระทบ:

- แถวที่ข้อมูลไม่ครบอาจหายไปแทนที่จะถูกส่งออกโดยคงช่องว่าง
- validation มองไม่เห็นแถวที่ parser ทิ้งแล้ว จึงอาจแสดง 0 errors ทั้งที่ข้อมูลต้นฉบับบางแถวไม่อยู่ในผลลัพธ์
- ขัดกับกติกา “ข้อมูลห้ามตกหล่น” โดยตรง

สิ่งที่ต้องมี:

- ทุก candidate row ต้องมี disposition: `แปลงแล้ว`, `ไม่ใช่แถวข้อมูล`, หรือ `รอผู้ใช้ยืนยัน`
- ห้ามมีการ `continue` ทิ้งแถวโดยไม่มี reason code ที่ตรวจย้อนหลังได้
- ก่อนดาวน์โหลดต้องแสดง `แถวต้นฉบับที่เป็นข้อมูล X → แถวผลลัพธ์ Y → รอตรวจสอบ Z`
- หากมีแถวที่ระบบยังจำแนกไม่ได้ ให้บล็อก export ชีตนั้น

### P0-02: คอลัมน์ต้นฉบับที่ไม่ถูก Mapping หายจากผลลัพธ์โดยไม่มีคำเตือน

ระบบสร้าง output เฉพาะ 53 คอลัมน์ของ Template และหน้าจอนับความครบถ้วนจากฝั่ง Template เท่านั้น ยังไม่มี source-column coverage

หลักฐาน:

- `backend/lib/transform.ts:51-54`
- `backend/lib/template.ts:174-205`
- `frontend/app/components/MappingSummary.tsx:113-142`
- `backend/tests/converter.test.ts:676-732`

ผลกระทบ:

- คอลัมน์ต้นฉบับที่มีข้อมูลแต่ไม่มี destination อาจหายแบบเงียบ ๆ
- ตัวเลข Mapping เช่น `40/53` ไม่ตอบว่าคอลัมน์ต้นฉบับถูกใช้ครบหรือไม่

สิ่งที่ต้องมี:

- เพิ่ม source-first coverage: ทุกคอลัมน์ต้นฉบับที่มีค่าต้องมีสถานะ `จับคู่แล้ว` หรือ `ระบบใช้สร้างค่าใด`
- เนื่องจากผู้ใช้ยืนยันว่าไม่ให้ข้อมูลตกหล่น จึงไม่ควรมีปุ่ม Ignore ทั่วไป
- หาก Template ไม่มีช่องรองรับ ต้องหยุดและให้ผู้ดูแลตัดสินใจ ห้ามเพิ่มคอลัมน์ต่อท้ายเองเพราะเว็บปลายทางตรวจ Template

### P0-03: รูปแบบไฟล์ Export ยังไม่ได้ยืนยันกับเว็บปลายทาง

โค้ด export แบบหลายชีตลบ `Sheet1` เดิม แล้วสร้างชีตใหม่ตามชื่อชีตต้นฉบับ ก่อนเพิ่ม `Reference` กลับเข้าไป

หลักฐาน:

- `backend/lib/template.ts:330-399`
- `backend/app/api/v1/export/route.ts:173-176`

ความเสี่ยง:

- เว็บปลายทางอาจกำหนดว่าต้องมีชีตชื่อ `Sheet1` เพียงชีตเดียว หรือกำหนดชื่อ/จำนวน/ลำดับชีตแบบตายตัว
- การเลือกดาวน์โหลดหลายชีตในไฟล์เดียวอาจสร้าง workbook ที่ระบบปลายทางปฏิเสธ แม้หัวคอลัมน์แต่ละชีตถูกต้อง
- ภาพที่แนบยืนยันว่ามี flow “เทมเพลต → นำเข้า” แต่ยังไม่เพียงพอที่จะรู้ validation contract ของเว็บ

สิ่งที่ต้องทำก่อนสรุป design ของ Download:

- ทำ acceptance test กับเว็บปลายทางด้วยไฟล์ 1 ชีตและหลายชีต
- บันทึกข้อกำหนดจริง: sheet names, จำนวนชีต, header order, data types, date format, boolean format, Reference sheet และ data validations
- สร้าง golden output file ที่นำเข้าผ่านจริง แล้วใช้เป็น regression fixture

### P0-04: ระบบปัจจุบันสามารถแก้ค่าและตัดแถว ซึ่งขัดกับกติกาความเที่ยงตรง

Frontend มี cell editor และปุ่ม `ตัดแถวนี้ออก`; backend รับ cell overrides และ excluded rows แล้วใช้กับ export

หลักฐาน:

- `frontend/app/components/IssueList.tsx:142-193`
- `frontend/app/page.tsx:313-354`
- `backend/lib/row-fixes.ts:13-45`
- `backend/app/api/v1/export/route.ts:84-90`

นอกจากนี้ transformer เติมค่าบางช่องอัตโนมัติ เช่น `ต้องตรวจนับ=True` และ boolean อื่นเป็น False รวมทั้ง normalize วันที่ในเส้นทาง auto

- `backend/lib/transform.ts:428-455`
- `backend/lib/transform.ts:303-342`

ผลกระทบ:

- ผู้ใช้สามารถสร้างไฟล์ที่ข้อมูลไม่ตรงกับต้นฉบับโดยไม่มีหลักฐานเพียงพอ
- คำว่า “คัดลอกค่าตามต้นฉบับ” ไม่จริงกับทุกเส้นทางของ transformer

ข้อเสนอ:

- เอาความสามารถแก้เซลล์และตัดแถวออกจาก user flow ปกติ
- Advanced Mapping ควรเปลี่ยนเฉพาะ destination ของคอลัมน์ ไม่เปลี่ยนค่าข้อมูล
- ค่าที่ระบบสร้าง/normalize ต้องติดป้าย `ค่าที่ระบบสร้าง` และมี rule/version ใน audit manifest
- ค่าว่างจากต้นฉบับคงว่าง และแจ้ง warning แบบไม่บล็อกตามข้อสรุปของผู้ใช้

### P0-05: ไม่มี audit trail สำหรับงานเอกสารที่ต้องตรวจสอบย้อนหลัง

Analysis เก็บใน memory สูงสุด 20 งานและหมดอายุภายใน 30 นาที ไม่มี conversion history แบบถาวร

หลักฐาน:

- `backend/lib/analysis-store.ts:13-14`
- `backend/lib/analysis-store.ts:24-50`
- `backend/lib/mapping-profiles.ts:10-13`
- `backend/lib/mapping-profiles.ts:78-97`

Mapping profile ที่เก็บอยู่เป็น learning cache ตาม signature ของ header ไม่ใช่ประวัติว่าใครแปลงไฟล์ใด

ขั้นต่ำที่ต้องเก็บต่อหนึ่ง export:

- Job ID, ผู้ใช้ และเวลา
- ชื่อ/ขนาด/SHA-256 ของไฟล์ต้นฉบับ
- รายชื่อชีตและจำนวนแถว/คอลัมน์ต้นฉบับ
- Template version และ SHA-256
- Header range ที่ระบบตรวจพบและค่าที่ผู้ใช้เปลี่ยน
- Mapping สุดท้ายทุกคอลัมน์
- จำนวนแถว/คอลัมน์ก่อนและหลัง พร้อม disposition ของสิ่งที่ไม่ได้ส่งออก
- การแก้ไขทั้งหมดแบบ before/after; ตามกติกาใหม่ควรมีเฉพาะการเปลี่ยน mapping/header
- ผล validation และ warning snapshot
- SHA-256 ของไฟล์ผลลัพธ์และเวลา download

### P0-06: ไม่มี authentication/authorization ในโค้ดปัจจุบัน

ไม่พบ middleware, session, role หรือ permission check ใน frontend/backend ขณะที่ API ฝั่ง admin เปิดให้อัปโหลด, rollback และลบ Template ได้โดยตรง

หลักฐาน:

- `backend/app/api/v1/admin/template/route.ts:18-65`
- `backend/app/api/v1/admin/template/rollback/route.ts:6-14`
- ไม่พบ auth/session/middleware ใน repository

ผลกระทบ:

- หากระบบถูกเปิดนอกเครื่องหรือเครือข่ายที่ควบคุม ผู้ใช้ทั่วไปอาจเปลี่ยน Template กลางและกระทบทุกการแปลง
- ไฟล์ข้อมูลสินทรัพย์ของหน่วยงานไม่มีขอบเขตผู้ใช้หรือหน่วยงานกำกับ

ข้อเสนอ:

- Production ต้องมี login และอย่างน้อยสอง role: `operator` กับ `template_admin`
- Template changes ต้องบันทึกผู้กระทำและ require confirmation
- หาก deployment ปัจจุบันเป็น prototype ภายใน ให้ระบุข้อจำกัดนี้ชัดเจนและห้ามเปิด public

## 5. P1 — ความเสี่ยงสูงต่อ workflow และความเข้าใจผู้ใช้

### P1-01: Backend มี reparse แต่หน้าเว็บไม่มี Header Row selector

Frontend มีฟังก์ชันเรียก `/api/v1/reparse-sheet` และส่ง prop เข้า `PreviewStep` แต่ `PreviewStep` ไม่ได้เรียกใช้ prop นี้จริง

หลักฐาน:

- `frontend/app/page.tsx:357-427`
- `frontend/app/components/PreviewStep.tsx:44-49`
- `frontend/app/components/PreviewStep.tsx:163`
- `backend/app/api/v1/reparse-sheet/route.ts`

วัตถุดิบสำหรับ UI มีแล้วบางส่วน เพราะ API ส่ง raw preview 40 แถวแรก

- `backend/lib/build-sheet-data.ts:91-94`

### P1-02: Data model ของ Header Row ยังไม่พอสำหรับไฟล์จริง

API reparse รับ `headerRow` เพียงแถวเดียว และ optional data start/end ส่วน parser แบบ flexible รวม header ได้สูงสุดสองแถว

หลักฐาน:

- `backend/lib/reparse-request.ts:1-6`
- `backend/lib/reparse-sheet.ts:46-56`
- `backend/lib/datasource/parsers/flexible.ts:45-59`

แต่ไฟล์ `สำนักงาน` ใช้ header 3 ชั้นจริง การปักแถว 4 แล้ว reparse เป็น generic `standard-table` อาจสูญเสียความหมายที่ dedicated register parser อ่านได้อยู่แล้ว

Contract ที่เสนอ:

```ts
type HeaderSelection = {
  headerStartRow: number;
  headerEndRow: number;   // รองรับ 1–3 แถว
  dataStartRow: number;
  dataEndRow?: number;
};
```

ระบบต้องส่ง preview ของชื่อคอลัมน์ที่ประกอบแล้วกลับมาก่อนให้ผู้ใช้ยืนยัน

### P1-03: Warning มากเกินไปจนใช้ตัดสินใจไม่ได้

ไฟล์ตัวอย่างหนึ่งไฟล์ให้ 9,514 warnings จาก 2,602 output rows โดย 4 กลุ่มหลักเป็น Reference mismatch ซ้ำ ๆ

ผลกระทบ:

- ผู้ใช้แยก warning สำคัญออกจาก noise ไม่ได้
- หน้า Download แสดง issues เพียง 200 รายการแรก (`frontend/app/components/DownloadStep.tsx:172-183`)
- จำนวน warning สูงไม่ได้ช่วยตอบว่าไฟล์ปลอดภัยหรือครบถ้วน

ข้อเสนอ:

- Group ตาม `ปัญหา + คอลัมน์ + ค่าที่พบ` พร้อมจำนวนและตัวอย่างแถว
- แยก `ข้อมูลอาจหาย`, `โครงสร้างผิด`, `ค่าไม่อยู่ใน Reference`, `ข้อสังเกต` ออกจากกัน
- ให้ reconciliation และ portal compatibility มี priority สูงกว่า Reference warning

### P1-04: Manual Mapping อนุญาตใช้ source column ซ้ำ

Auto mapping ป้องกันการใช้ source ซ้ำ แต่ manual mapping ไม่ตรวจ และ test ปัจจุบันยืนยันพฤติกรรมที่คัดลอกคอลัมน์เดียวไปหลายช่องได้

หลักฐาน:

- `frontend/app/components/MappingSummary.tsx:241-275`
- `backend/lib/manual-mapping.ts:12-22`
- `backend/tests/manual-mapping.test.ts:30-45`
- `backend/tests/regression-double-placement.test.ts:85-101`

ข้อเสนอ:

- ปิดตัวเลือก source ที่ถูกใช้แล้วและบอกว่าถูกจับคู่กับช่องใด
- Backend ต้องตรวจ uniqueness ซ้ำ ไม่เชื่อเฉพาะ frontend
- หากมีข้อยกเว้นทางธุรกิจในอนาคต ต้องเป็น explicit action พร้อมเหตุผลและ audit log

### P1-05: Backend เชื่อ Mapping ที่ client ส่งมามากเกินไป

Frontend ส่ง auto mapping กลับไปทั้งชุด และ backend ใช้ค่าจาก request ในการ export ขณะที่ request validation ตรวจชื่อ Template column แต่ไม่ได้ยืนยันว่า source column มีอยู่จริงใน authoritative source sheet

หลักฐาน:

- `frontend/app/page.tsx:111-130`
- `backend/app/api/v1/export/route.ts:75-84`
- `backend/lib/export-request.ts:52-76`

ข้อเสนอ:

- Backend คำนวณ auto mapping ใหม่จาก analysis ที่เก็บไว้
- Request ส่งเฉพาะ manual overrides
- ตรวจทุก source column ว่ามีในชีตจริงและไม่ถูกใช้ซ้ำก่อน transform

### P1-06: นโยบายค่าว่างไม่ตรงกับข้อสรุปธุรกิจ

ระบบปัจจุบันกำหนด `รหัสสินทรัพย์` และ `ชื่อสินทรัพย์` เป็น required และทำให้ blank เป็น error ที่บล็อก export

หลักฐาน:

- `backend/lib/validate.ts:58`
- `backend/lib/validate.ts:162-184`
- `backend/lib/validate.ts:295-311`
- `backend/app/api/v1/export/route.ts:130-151`

ข้อสรุปผู้ใช้คือให้คงค่าว่างไว้และแจ้ง warning โดยไม่แก้ข้อมูล ดังนั้น validation policy ต้องเปลี่ยนก่อนใช้คำว่า “พร้อมส่งออก” ให้สอดคล้องกันทั้ง UI และ backend

### P1-07: Analysis store ไม่เหมาะกับหลายผู้ใช้หรือหลาย server instance

- เก็บงานไว้ใน memory ของ process
- จำกัด 20 analyses
- sliding TTL 30 นาที
- restart หรือเปลี่ยน instance แล้ว analysis หาย

หลักฐาน: `backend/lib/analysis-store.ts:13-50`

นอกจาก UX “หมดอายุ” แล้ว ยังทำให้ audit และการทำงานต่อเนื่องไม่น่าเชื่อถือ ควรย้าย metadata และ artifact references ไป persistent storage ที่กำหนดสิทธิ์และ retention ได้

### P1-08: การจัดการ Template เปิดใช้ไฟล์ที่โครงสร้างต่างได้ง่ายเกินไป

Template upload บล็อกเพียงไฟล์อ่านไม่ได้, ไม่มี `Sheet1`, ไม่มี `Reference` หรือหัวแถวแรกว่าง แต่ความต่างของ 53 คอลัมน์เป็นเพียง warning และไฟล์ใหม่ถูกตั้งเป็น active ทันที

หลักฐาน:

- `backend/lib/template-store.ts:108-157`
- `backend/lib/template-store.ts:160-193`
- `frontend/app/settings/page.tsx:72-90`

ความเสี่ยงสูงเพราะเว็บปลายทางตรวจ Template ควร require exact contract หรือผ่าน portal acceptance fixture ก่อน activate

### P1-09: ความสามารถ preserve ชีตมีใน builder แต่ไม่ถูกใช้ใน production route

`buildAssetTemplateWorkbookBySheet` รองรับ preserved sheets แต่ datasource ไม่เพิ่มชื่อเข้า `preservedSheets` และ export route ไม่ส่ง source buffer/matrix/preserved names เข้า builder

หลักฐาน:

- `backend/lib/datasource.ts:49-51`
- `backend/lib/datasource.ts:83-85`
- `backend/lib/template.ts:343-392`
- `backend/app/api/v1/export/route.ts:173-175`

README และบาง test ทำให้เข้าใจว่ารองรับ preserve แล้ว แต่ behavior จริงของ route ยังไม่ครบ

### P1-10: Asset audit รันซ้ำไม่ได้ใน checkout ปัจจุบันและรายงานเดิมตรวจสอบย้อนกลับไม่ได้

คำสั่ง `npm run audit:assets` ล้มเหลวเพราะ hardcode path `backend/assets/เทศบาลนครลำปาง` ซึ่งไม่มีอยู่ใน workspace ปัจจุบัน

หลักฐาน:

- `backend/scripts/audit-assets.ts:77-83`
- รายงาน `backend/reports/asset-audit.json` ระบุ 21 files / 198 sheets / 89,147 warnings แต่ repository track เพียง Template; dataset ที่สร้างรายงานไม่อยู่ใน checkout

ข้อเสนอ:

- รับ input path ผ่าน argument/config ที่บังคับระบุ
- บันทึก run timestamp, git commit, template hash และ source file manifest/hash
- เพิ่ม raw-vs-output row reconciliation และ source-column coverage
- Audit ต้อง fail เมื่อพบ unknown dropped row/column ไม่ใช่เพียงสรุป warning

## 6. P2 — ปัญหา UX/ความชัดเจน

### P2-01: Mapping Summary นับผิดมุม

หน้าจอแสดงจำนวน Template fields ที่ระบบจับคู่ได้ แต่ requirement สำคัญคือ source columns ถูกนำไปใช้ครบหรือไม่ อีกทั้ง `mappedCount` ยังไม่นับ manual state อย่างถูกความหมายทุกกรณี

หลักฐาน: `frontend/app/components/MappingSummary.tsx:132-142`

ควรแสดงสองตัวเลขแยกกัน:

- Template coverage: เติมได้กี่ช่องจาก 53
- Source coverage: ใช้แล้วกี่คอลัมน์จากคอลัมน์ที่มีข้อมูลจริง

### P2-02: Preview เป็นเพียงตัวอย่าง ไม่ใช่หลักฐานความครบถ้วน

- raw preview 40 แถว
- source rows ที่ frontend ได้ 30 แถว
- mapping output preview 5 แถว
- issue list บางจุดจำกัด 200 รายการ

หลักฐาน:

- `backend/lib/build-sheet-data.ts:91-94`
- `frontend/app/components/MappingSummary.tsx:44-51`
- `frontend/app/components/MappingSummary.tsx:119-125`
- `frontend/app/components/DownloadStep.tsx:172-183`

ต้องมี aggregate reconciliation จาก backend แยกจาก preview เช่นจำนวนค่าว่าง จำนวนค่าที่เปลี่ยน และจำนวน source cells ที่ไม่ได้ใช้

### P2-03: ปุ่มไปต่อเช็คเพียงว่ามีชีตถูกเลือก

`canContinue` ใน Review อิง `selectedCount > 0` ไม่ได้ตรวจ mapping completeness หรือผล validation ล่าสุด

หลักฐาน: `frontend/app/page.tsx:434-484`

ข้อเสนอ state ของ CTA:

1. `เหลือ N จุดที่ต้องตรวจ` — disabled
2. `ตรวจสอบการจับคู่` — เมื่อมี draft changes
3. `บันทึกและดำเนินการต่อ` — เมื่อ reconciliation และ validation ล่าสุดผ่าน

### P2-04: Advanced Mapping ยังใช้ศัพท์เทคนิคมากเกินไป

มีคำว่า `Mapping Summary`, `Template Column`, `Source Column`, `Confidence`, `Status`, `Parser` และ `Manual` ใน user flow

หลักฐาน: `frontend/app/components/MappingSummary.tsx:138-201`

กลุ่มผู้ใช้เข้าใจข้อมูลสินทรัพย์ แต่ไม่จำเป็นต้องเข้าใจ parser จึงควรใช้ภาษาแบบงานจริง เช่น:

- “ช่องในไฟล์ผลลัพธ์”
- “คอลัมน์จากไฟล์เทศบาล”
- “ระบบแนะนำ”
- “คุณเลือกเอง”

## 7. ข้อเสนอ Header Row สำหรับ Advanced Mapping

### เป้าหมาย

ให้ผู้ใช้เลือกโครงสร้างโดยดูจากข้อมูลจริง ไม่ต้องเดาหมายเลขแถว และรองรับหัวตาราง 1–3 ชั้น

### ขั้นตอน UI

1. แสดง raw rows 1–15 พร้อมเลขแถวและตัวอักษรคอลัมน์ A, B, C...
2. ระบบไฮไลต์ช่วงที่คาดว่าเป็นหัวตาราง เช่น `แถว 4–6`
3. ผู้ใช้คลิกเลือกแถวเริ่มและแถวสุดท้ายของหัวตาราง
4. ผู้ใช้เลือกแถวเริ่มข้อมูลแยกต่างหาก
5. ระบบแสดงชื่อคอลัมน์ที่ประกอบแล้ว เช่น `สภาพครุภัณฑ์ / ชำรุด`
6. หากชื่อซ้ำ ให้แสดงตัวอักษรคอลัมน์ด้วย เช่น `E — วันที่ได้มา`, `F — วันที่ได้มา`, `G — วันที่ได้มา`
7. แสดงผลก่อนยืนยัน:
   - จำนวน candidate rows
   - จำนวนแถวที่จะแปลง
   - จำนวนแถวที่ยังจำแนกไม่ได้
   - จำนวน source columns ที่มีข้อมูล
8. เมื่อยืนยัน Header ใหม่ ให้เก็บ Mapping เดิมเป็น draft และแสดง diff; ห้ามล้างทิ้งโดยไม่ถาม

### หน้าตาตัวอย่าง

```text
แถวที่ใช้เป็นชื่อคอลัมน์

ระบบคาดว่าเป็นแถว 4–6                         [วิเคราะห์ใหม่]

  แถว 1  รายละเอียดครุภัณฑ์ สำนักปลัดเทศบาล...
  แถว 2  ณ กันยายน 2567
  แถว 3  —
● แถว 4  ลำดับ | รายการ | รหัสครุภัณฑ์ | สภาพครุภัณฑ์...
● แถว 5  ที่     | รายการ | รหัสครุภัณฑ์ | ใช้ได้ | ชำรุด...
● แถว 6  —      | รายการ | รหัสครุภัณฑ์ | —     | สภาพ...
  แถว 7  —      | ครุภัณฑ์สำนักงาน

หัวตาราง: แถว 4 ถึง 6
ข้อมูลเริ่มต้น: แถว 7

[ดูชื่อคอลัมน์ที่ระบบจะใช้] [ยืนยันโครงสร้างนี้]
```

## 8. ลำดับการทำงานที่แนะนำ

### Phase 0: ล็อกสัญญากับเว็บปลายทาง

- ทดสอบ import จริงและสร้าง golden fixture
- ตัดสินว่า output ต้องเป็น `Sheet1` เดียวหรือรองรับหลายชีต
- ล็อก type/date/boolean/reference rules

### Phase 1: สร้าง correctness guardrails

- row disposition และ row reconciliation
- source-column coverage
- ปิด silent drop
- ปิด cell editing/row exclusion ใน user flow
- บังคับ mapping แบบ 1:1
- ปรับ blank policy ให้เป็น warning โดยไม่เปลี่ยนค่า
- สร้าง conversion manifest และ audit trail

### Phase 2: ทำ Header Row selector

- รองรับ header range 1–3 ชั้น
- preview ชื่อคอลัมน์ที่ประกอบแล้ว
- เลือก data start/end
- diff ก่อน/หลัง และรักษา draft mapping

### Phase 3: ปรับ Advanced Mapping

- แสดง source coverage และ template coverage
- แสดงตัวอย่างค่าจากคอลัมน์
- ป้องกัน duplicate source mapping
- preview ก่อน/หลัง
- CTA ตาม validation state

### Phase 4: ลด warning noise

- group/dedupe warnings
- แยก blocking correctness จาก Reference suggestions
- สรุปเป็นงานที่ผู้ใช้ทำต่อได้จริง

## 9. Definition of Done ด้านความถูกต้อง

ระบบยังไม่ควรประกาศ production-ready จนผ่านทุกข้อ:

- [ ] ทุก candidate source row มี disposition และไม่มี unknown row
- [ ] ทุก source column ที่มี nonblank value มี destination/consumption record
- [ ] จำนวนแถวและคอลัมน์ก่อน–หลัง reconcile ได้
- [ ] ไม่มีการแก้/เติม/normalize ค่าโดยไม่แสดง rule และไม่บันทึก audit
- [ ] Manual mapping 1 source → 1 destination ตามกติกาธุรกิจ
- [ ] Header 1–3 ชั้นจากไฟล์จริงเลือกและ reparse ได้โดยไม่ลดจำนวนข้อมูลโดยไม่ทราบสาเหตุ
- [ ] ไฟล์ผลลัพธ์นำเข้าเว็บปลายทางผ่านด้วย golden acceptance test
- [ ] Template เปลี่ยนได้เฉพาะผู้มีสิทธิ์และ exact contract ผ่าน
- [ ] ทุก export มี immutable conversion manifest และ output hash
- [ ] Warning ถูก group จนผู้ใช้เห็นงานที่ต้องทำจริง ไม่ใช่รายการซ้ำหลายพันบรรทัด

## 10. ผลการตรวจเครื่องมือปัจจุบัน

- `npm test`: ผ่าน 61 tests
- `npm run typecheck`: ผ่านทั้ง frontend และ backend
- `npm run build`: ผ่านทั้งสอง workspace แต่ backend มี Turbopack warning ว่า file tracing อาจครอบคลุมทั้ง project จาก dynamic filesystem path
- `npm run audit:assets`: ไม่ผ่าน เพราะ directory ที่ hardcode ไว้ไม่มีใน checkout นี้

การที่ test/build ผ่านหมายถึงโค้ดทำตาม behavior ที่เขียนไว้ในปัจจุบัน แต่ behavior บางส่วนยังขัดกับกติกาธุรกิจล่าสุด จึงต้องแก้ spec/tests พร้อม implementation ไม่ใช่แก้เฉพาะ UI
