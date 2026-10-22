# Excel Template Converter

เว็บสำหรับแปลงข้อมูลจากไฟล์ Excel หลายรูปแบบให้เป็นไฟล์ Excel ตาม
Template ของบริษัท โดยช่วยอ่านชีต แนะนำการจับคู่คอลัมน์ ตรวจหาข้อมูลที่
ต้องแก้ และสร้างไฟล์ `.xlsx` สำหรับดาวน์โหลด

## ทำอะไรได้บ้าง

- รับไฟล์ `.xlsx` และ `.xls` ขนาดไม่เกิน 20 MB
- อ่านทุกชีตและระบุว่าชีตใดเหมาะสำหรับแปลงข้อมูล
- แนะนำการจับคู่คอลัมน์ต้นทางกับคอลัมน์ใน Template
- ให้ผู้ใช้แก้ mapping, แก้ค่าเซลล์ หรือไม่ส่งออกบางแถวได้
- ตรวจข้อมูลสำคัญ เช่น ช่องบังคับ วันที่ ตัวเลข สถานะ และข้อมูลซ้ำ
- สร้างไฟล์ Excel ใหม่โดยมีเฉพาะชีตที่ผ่านการตรวจสอบ

## ใช้งานแบบย่อ

1. เปิดหน้าเว็บ แล้วอัปโหลดหรือลากไฟล์ Excel ลงมา
2. ระบบอ่านไฟล์และเลือกชีตที่มีข้อมูลให้ตรวจสอบ
3. ดูตัวอย่างข้อมูลและคำเตือน แล้วแก้เฉพาะจุดที่จำเป็น
4. กดตรวจสอบอีกครั้ง
5. เมื่อไม่มีข้อผิดพลาด กดดาวน์โหลดไฟล์ที่แปลงแล้ว

ชื่อไฟล์ที่ได้จะอยู่ในรูปแบบ `converted_template_<ชื่อไฟล์ต้นทาง>.xlsx`

## การไหลของข้อมูล

### ภาพรวมสำหรับผู้ใช้

```text
ไฟล์ Excel ต้นทาง
    |
    v
อัปโหลดในหน้าเว็บ
    |
    v
ระบบอ่านชีต + หา header + แนะนำการจับคู่คอลัมน์
    |
    v
ผู้ใช้ตรวจตัวอย่างข้อมูล / แก้ mapping / แก้เซลล์ / ตัดแถวออก
    |
    v
ตรวจสอบข้อมูลอีกครั้ง
    |
    v
สร้างไฟล์ตาม Template แล้วดาวน์โหลด .xlsx
```

### ภาพรวมระหว่าง Frontend และ Backend

```text
Browser (Frontend :3000)
  |
  |  POST /api/v1/parse  [ส่งไฟล์ Excel]
  v
Backend API (:3001)
  |
  |-- อ่าน workbook
  |     |- .xlsx: Python + openpyxl เป็นตัวเลือกหลัก
  |     `- .xls / กรณี fallback: TypeScript reader
  |
  |-- แยกข้อมูลเป็นโครงสร้างกลาง
  |-- ตรวจรูปแบบชีตและแนะนำ mapping
  `-- เก็บข้อมูลการตรวจชั่วคราว แล้วตอบ analysisId + preview กลับไป
  |
  v
Browser แสดงชีต, mapping, preview และ validation issues
  |
  |  POST /api/v1/export (mode: validate)
  v
Backend แปลงข้อมูลและตอบผลตรวจล่าสุด
  |
  |  POST /api/v1/export (mode: download)
  v
Backend สร้างไฟล์ Template .xlsx --> Browser ดาวน์โหลดไฟล์
```

`analysisId` คือรหัสอ้างอิงข้อมูลที่อัปโหลดสำหรับรอบการทำงานนั้น ใช้เมื่อ
ตรวจสอบซ้ำหรือดาวน์โหลด ข้อมูลนี้เก็บในหน่วยความจำของ Backend ชั่วคราว:
หลังรีสตาร์ตเซิร์ฟเวอร์หรือหมดอายุ ต้องอัปโหลดไฟล์ใหม่

### เมื่อผู้ใช้แก้ข้อมูล

หลังแก้ mapping, ค่าเซลล์ หรือเลือกตัดแถวออก ผลตรวจเดิมจะไม่ใช่ผลล่าสุด
(stale) จึงต้องส่ง `mode: validate` อีกครั้งก่อนดาวน์โหลด ระบบจะใช้ค่าแก้ไข
เหล่านี้ร่วมกับข้อมูลต้นทาง ไม่ได้แก้ไฟล์ Excel ต้นฉบับบนเครื่องของผู้ใช้

## API หลัก

| Endpoint | ใช้เมื่อ | ผลลัพธ์ |
| --- | --- | --- |
| `POST /api/v1/parse` | อัปโหลดไฟล์ | รายละเอียดทุกชีต, preview, mapping ที่แนะนำ และ `analysisId` |
| `POST /api/v1/reparse-sheet` | ต้องกำหนดแถว header/ช่วงข้อมูลใหม่ | วิเคราะห์ชีตเดิมใหม่ |
| `POST /api/v1/export` (`validate`) | ตรวจข้อมูลก่อนดาวน์โหลด | ข้อมูลที่แปลงแล้วและรายการปัญหา |
| `POST /api/v1/export` (`download`) | สร้างไฟล์ผลลัพธ์ | ไฟล์ `.xlsx` สำหรับดาวน์โหลด |
| `GET/POST /api/v1/admin/template` | ดูหรือเปลี่ยน Template ที่ `/settings` | สถานะหรือ Template เวอร์ชันใหม่ |

## เริ่มต้นใช้งานสำหรับนักพัฒนา

ติดตั้ง dependencies ที่โฟลเดอร์หลัก:

```bash
npm install
```

ติดตั้ง Python extractor สำหรับไฟล์ `.xlsx` (แนะนำ):

```bash
python -m pip install -r backend/python/requirements.txt
```

รัน Frontend และ Backend พร้อมกัน:

```bash
npm run dev
```

เปิด <http://localhost:3000>

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Frontend ส่ง request ที่ `/api/*` ไปยัง Backend โดยอัตโนมัติ

ถ้า Backend อยู่คนละ URL ให้กำหนด `BACKEND_URL` ก่อนรันหรือ build Frontend:

```powershell
$env:BACKEND_URL = "https://api.example.com"
npm.cmd run build
```

### โหมดตัวอ่าน Excel

ตัวแปร `WORKBOOK_EXTRACTOR` เลือกวิธีอ่านไฟล์ได้:

| ค่า | พฤติกรรม |
| --- | --- |
| `auto` (ค่าเริ่มต้น) | ใช้ Python กับ `.xlsx` ก่อน แล้ว fallback ไป TypeScript หาก Python ใช้ไม่ได้ |
| `python` | บังคับใช้ Python extractor |
| `typescript` | ใช้ TypeScript reader โดยไม่เรียก Python |

ดูการตั้งค่า path ของ Python เพิ่มเติมที่ [backend/python/README.md](backend/python/README.md)

## คำสั่งที่ใช้บ่อย

```bash
npm run dev          # รันทั้งสอง service สำหรับพัฒนา
npm run build        # build Backend แล้วตามด้วย Frontend
npm run typecheck    # ตรวจ TypeScript ทุก workspace ที่รองรับ
npm test             # รันทดสอบ Backend
npm run audit:assets # ตรวจไฟล์ Excel ตัวอย่างและสร้างรายงาน
npm start            # เปิดทั้งสอง service จาก production build
```

รายงานจาก `npm run audit:assets` จะถูกสร้างที่
`backend/reports/asset-audit.json`

## โครงสร้างโปรเจกต์

```text
.
├─ frontend/                    หน้าเว็บ Next.js และ UI components
│  ├─ app/                      หน้าอัปโหลด, ตรวจสอบ และ settings
│  └─ next.config.js            proxy /api/* ไปยัง Backend
├─ backend/                     Next.js API และ logic แปลงข้อมูล
│  ├─ app/api/v1/               parse, export, reparse และ template routes
│  ├─ python/                   Python + openpyxl extractor
│  ├─ src/parse/                อ่านและ normalize workbook
│  ├─ src/mapping/              แนะนำและตรวจ mapping
│  ├─ src/review/               เก็บ/วิเคราะห์ข้อมูลระหว่างการตรวจ
│  └─ src/export/               สร้างข้อมูลและไฟล์ผลลัพธ์
├─ run-apps.mjs                 เปิดหรือหยุด Frontend และ Backend พร้อมกัน
└─ package.json                 workspace และคำสั่งรวมของโปรเจกต์
```

## ข้อควรรู้

- ระบบรองรับสูงสุด 100 ชีต, 50,000 แถวต่อชีต, 256 คอลัมน์ต่อชีต และ
  1,000,000 เซลล์ต่อ workbook
- ไฟล์ที่ดาวน์โหลดจะไม่คัดลอกชีตต้นฉบับที่ไม่ได้เลือกแปลงไปด้วย
- หน้า `/settings` ใช้เปลี่ยน Template ได้ โดยไฟล์ที่อัปโหลดเก็บอยู่ที่
  `backend/data/templates/` และไม่อยู่ใน Git
- ปัจจุบันยังไม่มีระบบยืนยันตัวตน จึงควรวางระบบนี้ในเครือข่ายที่เหมาะสม
