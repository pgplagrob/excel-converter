# คู่มืออ่านโครงสร้างและการไหลของโค้ด

เอกสารนี้ช่วยให้เริ่มอ่านโปรเจกต์ได้จากเส้นทางที่ข้อมูลวิ่งจริง ไม่จำเป็นต้อง
เปิดทุกไฟล์พร้อมกัน ให้เริ่มจากหน้าเว็บ แล้วตาม request ไปที่ Backend ตามแผนผังด้านล่าง

## ภาพรวมโฟลเดอร์

```text
excel-converter/
├─ frontend/                  ส่วนที่ผู้ใช้เห็นและโต้ตอบใน Browser
├─ backend/                   API, การอ่าน Excel, ตรวจข้อมูล และสร้างไฟล์
├─ run-apps.mjs               สั่งเปิด frontend และ backend พร้อมกัน
├─ package.json               คำสั่งรวมของ npm workspace
├─ README.md                  คู่มือใช้งานและภาพรวมระบบ
└─ DEVELOPER-FLOW.md          เอกสารนี้: จุดเริ่มอ่านโค้ดและเส้นทางข้อมูล
```

## จุดเริ่มต้นของระบบ

```text
npm run dev
   |
   `-- run-apps.mjs
         |-- backend  -> Next.js port 3001
         `-- frontend -> Next.js port 3000

Browser เปิด http://localhost:3000
   |
   `-- frontend/app/page.tsx
```

`run-apps.mjs` เป็นตัวรันทั้งสอง workspace พร้อมกัน เมื่อกด `Ctrl+C` จะสั่งหยุด
ทั้ง Frontend และ Backend

Frontend กำหนด rewrite ใน `frontend/next.config.js` ให้ request ที่ขึ้นต้นด้วย
`/api/` ถูกส่งต่อไป Backend ที่ `http://127.0.0.1:3001` โดยค่าเริ่มต้น

## Frontend: ไฟล์ไหนทำอะไร

```text
frontend/
├─ app/
│  ├─ page.tsx                         ตัวควบคุม flow หลักและ state ของหน้าการแปลง
│  ├─ components/Upload/UploadStep.tsx หน้ารับ/ลากไฟล์
│  ├─ components/Review/               หน้าตรวจชีต, mapping, preview และปัญหา
│  ├─ components/Download/DownloadStep.tsx
│  │                                    หน้าสรุปและปุ่มดาวน์โหลด
│  ├─ settings/page.tsx                หน้าจัดการ Template
│  ├─ layout.tsx                       layout หลักของ Frontend
│  └─ globals.css                      CSS ร่วมของ Frontend
├─ lib/
│  ├─ client-types.ts                  Type ของข้อมูลที่ส่ง/รับจาก API
│  ├─ manual-mapping.ts                เก็บความตั้งใจของผู้ใช้เมื่อ override mapping
│  ├─ mapping.ts                       helper เกี่ยวกับ mapping ฝั่ง Browser
│  └─ sheet-selection.ts               helper การเลือกชีตที่จะตรวจ/ส่งออก
└─ next.config.js                      proxy /api/* ไป Backend
```

### `frontend/app/page.tsx` คือศูนย์กลางของ UI

ไฟล์นี้เก็บ state ของไฟล์ที่เลือก, `analysisId`, ชีตที่เลือก, mapping ที่ผู้ใช้แก้,
ค่าเซลล์ที่แก้, แถวที่ตัดออก และผล validation แล้วส่ง props ไปยัง component ย่อย

ฟังก์ชันสำคัญที่ควรตามอ่านตามลำดับ:

1. `handleFile()` ตรวจนามสกุลและขนาดไฟล์ก่อนอัปโหลด
2. `uploadAndParse()` ส่ง `FormData` ไป `POST /api/v1/parse`
3. `runValidation()` ส่ง mapping และการแก้ไขไป `POST /api/v1/export` ด้วย `mode: "validate"`
4. `downloadFile()` ส่งข้อมูลเดิมไป endpoint เดียวกันด้วย `mode: "download"` แล้วให้ Browser ดาวน์โหลด blob
5. `reparseSheet()` ขอให้ Backend อ่านชีตเดิมใหม่ เมื่อผู้ใช้กำหนดแถว header หรือช่วงข้อมูลเอง

## Flow หลัก: อัปโหลด → ตรวจ → ดาวน์โหลด

```text
UploadStep
  |
  | ผู้ใช้เลือกไฟล์
  v
page.tsx: uploadAndParse()
  |
  | POST /api/v1/parse (multipart/form-data, field: file)
  v
backend/app/api/v1/parse/route.ts
  |
  |-- src/parse/excel.ts             อ่านไฟล์ Excel เป็น workbook matrix
  |-- src/datasource/                หา header, profile และสร้างข้อมูลกลาง
  |-- src/review/analysis-store.ts   เก็บผลชั่วคราว แล้วสร้าง analysisId
  |-- src/parse/build-sheet-data.ts  สร้าง preview, mapping และ validation รอบแรก
  `-- ส่ง ParseResponse กลับ Browser
  |
  v
Review components แสดงชีต, ตัวอย่างข้อมูล และ mapping
  |
  | ผู้ใช้แก้ mapping / เซลล์ / ตัดแถว / เลือกชีต
  v
page.tsx: runValidation()
  |
  | POST /api/v1/export (mode: validate)
  v
backend/app/api/v1/export/route.ts
  |
  |-- src/export/transform.ts        แปลงแถวเป็นคอลัมน์ของ Template
  |-- src/review/row-fixes.ts        ใช้ cell override และ excluded rows
  |-- src/export/validate.ts         ตรวจปัญหาระดับชีตและระดับแถว
  `-- ส่ง issues และ preview หลังแปลงกลับ Browser
  |
  v
DownloadStep
  |
  | ผู้ใช้กดดาวน์โหลด
  v
page.tsx: downloadFile()
  |
  | POST /api/v1/export (mode: download)
  v
backend/app/api/v1/export/route.ts
  |
  `-- src/template/template.ts สร้าง workbook ตาม Template
  |
  v
response เป็น .xlsx -> Browser ดาวน์โหลดไฟล์
```

## Backend: แบ่งหน้าที่ตามโฟลเดอร์

```text
backend/
├─ app/api/v1/          HTTP route: รับ request และส่ง response
├─ src/parse/           อ่านไฟล์ Excel, sanitize และแปลงเป็น matrix
├─ src/datasource/      ทำความเข้าใจตารางต้นทางและสร้าง DataSourceWorkbook
├─ src/mapping/         แนะนำ/รวม/จำ mapping ระหว่างต้นทางกับ Template
├─ src/review/          เก็บ analysis ชั่วคราว, reparse และการแก้ไขผู้ใช้
├─ src/export/          แปลงแถวและตรวจความถูกต้องก่อน export
├─ src/template/        อ่าน Template และสร้าง workbook ผลลัพธ์
├─ src/shared/          type ที่ใช้ร่วมระหว่าง route และ business logic
├─ python/              ตัวอ่าน .xlsx ด้วย Python และ openpyxl
├─ tests/               ชุดทดสอบของ business logic
└─ scripts/             งาน developer เช่น audit ไฟล์ตัวอย่าง
```

### 1. `backend/app/api/v1/`: ชั้นรับ HTTP

Route ควรทำหน้าที่เป็นตัวประสานงาน ไม่ควรใส่กฎการแปลง Excel จำนวนมากไว้ในนี้

| ไฟล์ | รับผิดชอบ |
| --- | --- |
| `parse/route.ts` | รับไฟล์, ตรวจขนาด/นามสกุล, อ่าน workbook และตอบข้อมูลเริ่มต้นสำหรับหน้า review |
| `export/route.ts` | รับ mapping และการแก้ไข, validate หรือสร้างไฟล์ download |
| `reparse-sheet/route.ts` | วิเคราะห์ชีตเดิมใหม่จาก header/ช่วงแถวที่ผู้ใช้ระบุ |
| `admin/template/route.ts` | ดูหรืออัปโหลด Template |
| `admin/template/rollback/route.ts` | สลับกลับไปใช้ Template เวอร์ชันก่อนหน้า |

### 2. `backend/src/parse/`: เปลี่ยนไฟล์เป็นข้อมูลที่โค้ดอ่านต่อได้

- `excel.ts` เป็นจุดเลือกตัวอ่าน workbook และบังคับขนาดสูงสุดของ workbook
- `python-extractor.ts` เรียก `python/extract_workbook.py` แล้วแปลง JSON ที่ Python ส่งออกมาให้เป็น object ใน TypeScript
- `xlsx-sanitize.ts` จัดการส่วนของ `.xlsx` ที่ต้อง sanitize ก่อนประมวลผล
- `build-sheet-data.ts` รวมผล parsing, mapping และ validation รอบแรกให้เป็นข้อมูลของ UI

เส้นทางสำหรับ `.xlsx` ในโหมดปกติคือ:

```text
Excel .xlsx
  -> python/extract_workbook.py (openpyxl)
  -> JSON ผ่าน stdout
  -> src/parse/python-extractor.ts (JSON.parse)
  -> src/parse/excel.ts
```

ตัวแปร `WORKBOOK_EXTRACTOR` ควบคุมว่าจะใช้ Python, TypeScript หรือให้เลือกอัตโนมัติ

### 3. `backend/src/datasource/`: เข้าใจตารางต้นทาง

โฟลเดอร์นี้เปลี่ยน matrix ดิบจาก Excel ให้เป็น `DataSourceWorkbook` และ
`DataSourceSheet` ที่ส่วนอื่นใช้ร่วมกัน

- `index.ts` เป็นจุดรวมสร้าง workbook ข้อมูลต้นทาง
- `header-detection.ts` หาแถวหัวตาราง
- `profile.ts` และ `status.ts` ระบุรูปแบบ/สถานะของชีต
- `parsers/` แยก parser ตามรูปแบบข้อมูล เช่น `asset-data.ts`, `register.ts`, `transfer.ts`, `flexible.ts`
- `data-quality.ts` เพิ่มคำเตือนเกี่ยวกับคุณภาพข้อมูล
- `types.ts` เป็น type หลักของข้อมูลชั้นนี้

ถ้าต้องรองรับรูปแบบ Excel ใหม่ ให้เริ่มตรวจที่ `profile.ts` และ parser ที่เกี่ยวข้อง
ก่อน ไม่ควรรีบแก้ที่ route

### 4. `backend/src/mapping/`: บอกว่าคอลัมน์ใดตรงกับ Template

- `mapping.ts` สร้างข้อเสนอ mapping และรวม auto mapping กับ manual mapping
- `manual-mapping.ts` สนับสนุนค่าที่ผู้ใช้เลือกเอง
- `mapping-profiles.ts` บันทึก mapping ที่ยืนยันแล้ว เพื่อนำไปใช้กับ header รูปแบบเดิม

Auto mapping เป็นเพียงข้อเสนอ ส่วน manual mapping จากผู้ใช้จะถูกนำมารวมเป็น
`finalMapping` ก่อนแปลงจริง

### 5. `backend/src/review/`: สถานะระหว่างผู้ใช้กำลังตรวจงาน

- `analysis-store.ts` เก็บ `DataSourceWorkbook` และ matrix ต้นทางในหน่วยความจำ แล้วคืน `analysisId`
- `reparse-request.ts` ตรวจรูปแบบ request สำหรับ reparse
- `reparse-sheet.ts` อ่านชีตเดิมใหม่ตามแถว header/ข้อมูลที่ระบุ
- `row-fixes.ts` ใช้ค่าที่ผู้ใช้แก้ในเซลล์ และตัดแถวที่ไม่ต้องการส่งออก
- `sheet-selection.ts` ช่วยเลือกชีตที่ทำงานต่อได้

`analysis-store.ts` มีอายุข้อมูล 30 นาที และเก็บได้สูงสุด 20 analysis ต่อ process
เมื่อ Backend รีสตาร์ตหรือข้อมูลหมดอายุ ผู้ใช้ต้องอัปโหลดไฟล์อีกครั้ง

### 6. `backend/src/export/` และ `backend/src/template/`: สร้างผลลัพธ์

```text
source rows
  -> transform.ts       แปลงเป็นคอลัมน์ของ Template
  -> row-fixes.ts       ใช้ค่าที่แก้ / ตัดแถว
  -> validate.ts        ตรวจข้อมูลที่พร้อม export
  -> template.ts        สร้าง workbook ตาม Template
  -> response .xlsx
```

- `export-request.ts` ตรวจว่า JSON request สำหรับ export มีรูปแบบถูกต้อง
- `transform.ts` แปลงข้อมูลด้วย final mapping
- `validate.ts` สร้าง validation issues และสรุปผลรายชีต
- `template.ts` โหลด Template และใส่ข้อมูลที่ผ่านการตรวจลงใน workbook
- `template-store.ts` เก็บ Template ที่อัปโหลดผ่านหน้า settings

## Flow เมื่อแก้ mapping หรือข้อมูล

```text
ผู้ใช้เปลี่ยน mapping / แก้เซลล์ / ตัดแถว
  -> page.tsx อัปเดต state ใน Browser
  -> resultsStale = true
  -> กดตรวจสอบ
  -> /api/v1/export mode: validate
  -> Backend รวม auto mapping + manual mapping
  -> transform + apply row fixes + validate
  -> ส่งผลตรวจใหม่กลับมา
  -> resultsStale = false
```

ค่าใน Browser ไม่ได้เขียนกลับไปทับไฟล์ Excel ต้นฉบับ การเปลี่ยนแปลงมีผลเฉพาะกับ
payload ที่ส่งไปตรวจและสร้างไฟล์ผลลัพธ์

## Flow เมื่อ reparse ชีต

ผู้ใช้สามารถระบุว่าแถวใดคือ header หรือจำกัดช่วงข้อมูลในหน้า review ได้

```text
page.tsx: reparseSheet()
  -> POST /api/v1/reparse-sheet
  -> review/reparse-sheet.ts ใช้ matrix เดิมจาก analysis-store
  -> parse flexible layout ใหม่
  -> build-sheet-data.ts สร้าง preview/mapping/validation ใหม่
  -> Browser แทนที่ข้อมูลของชีตนั้น
```

หลัง reparse ระบบจะล้างการแก้เซลล์/ตัดแถวของชีตนั้น เพราะหมายเลขแถวอาจเปลี่ยน
และผลตรวจเดิมอาจไม่ตรงกับข้อมูลชุดใหม่

## ลำดับแนะนำสำหรับเริ่มอ่านโค้ด

1. `README.md` เพื่อเข้าใจสิ่งที่แอปทำ
2. `run-apps.mjs` และ root `package.json` เพื่อรู้วิธีรันสอง service
3. `frontend/app/page.tsx` เพื่อเห็น state และ request ทั้งหมดของ UI
4. `frontend/app/components/Upload/UploadStep.tsx`, `Review/` และ `Download/DownloadStep.tsx` เพื่อดูหน้าจอแต่ละขั้น
5. `backend/app/api/v1/parse/route.ts` แล้วตามไป `src/parse/` และ `src/datasource/`
6. `backend/app/api/v1/export/route.ts` แล้วตามไป `src/mapping/`, `src/review/`, `src/export/`, `src/template/`
7. `backend/tests/` เมื่อต้องการรู้กติกาที่ระบบตั้งใจรองรับและป้องกัน regression

## เลือกไฟล์ให้ตรงกับสิ่งที่ต้องแก้

| สิ่งที่ต้องการเปลี่ยน | เริ่มดูที่ |
| --- | --- |
| หน้าตา/ข้อความของขั้นดาวน์โหลด | `frontend/app/components/Download/DownloadStep.tsx` |
| ลำดับขั้นหรือ state ของหน้าเว็บ | `frontend/app/page.tsx` |
| ปุ่ม/การแสดงผลตอนอัปโหลด | `frontend/app/components/Upload/UploadStep.tsx` |
| การเลือกชีต, preview, mapping | `frontend/app/components/Review/` และ `frontend/lib/` |
| รองรับรูปแบบ Excel ต้นทางใหม่ | `backend/src/datasource/profile.ts` และ `backend/src/datasource/parsers/` |
| วิธีอ่าน `.xlsx` หรือ `.xls` | `backend/src/parse/excel.ts` และ `backend/src/parse/python-extractor.ts` |
| กฎจับคู่คอลัมน์ | `backend/src/mapping/mapping.ts` |
| กฎ validation | `backend/src/export/validate.ts` |
| รูปแบบไฟล์ที่ส่งออก | `backend/src/template/template.ts` |
| อายุ/การเก็บข้อมูลที่อัปโหลด | `backend/src/review/analysis-store.ts` |

## ก่อนแก้โค้ด

1. ตาม flow ให้ถึง function ที่ตัดสินใจเรื่องนั้นจริงก่อน
2. แก้ในชั้นที่รับผิดชอบเรื่องนั้น ไม่ย้ายกฎ business logic ไปไว้ใน route หรือ UI
3. เพิ่มหรือปรับ test ใน `backend/tests/` เมื่อเปลี่ยน parsing, mapping, validation หรือ export
4. รันอย่างน้อย `npm run typecheck`; หากแก้ Backend logic ให้รัน `npm test` เพิ่ม
