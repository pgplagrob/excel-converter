# Advanced Mapping Implementation Plan

สถานะ: **Ready to execute one Slice at a time**

เอกสารนี้เป็นคู่มือสำหรับ AI ที่แก้โค้ด อ่าน [`ADVANCED_MAPPING_UX.md`](./ADVANCED_MAPPING_UX.md) ก่อนเริ่มทุก Slice เพราะกติกาธุรกิจและถ้อยคำ UX มีแหล่งอ้างอิงหลักอยู่ที่เอกสารนั้น

## วิธีใช้งาน

1. สั่งทำ Slice เดียว
2. AI ตรวจโค้ดและ baseline ปัจจุบันก่อนแก้
3. AI ทำเฉพาะ In scope ของ Slice นั้น
4. AI รัน Completion gate และรายงานหลักฐานจริง
5. ผู้ใช้ตรวจผลและอนุมัติก่อนเริ่ม Slice ถัดไป

งานระหว่าง Slice 1–5 เป็น WIP และยังไม่พร้อมเผยแพร่ จนกว่า Slice 6 จะผ่านครบ

## Execution protocol สำหรับทุก Slice

- อ่าน `ADVANCED_MAPPING_UX.md` และหัวข้อของ Slice ปัจจุบันทั้งหมด
- ตรวจ `git status --short` และรักษาการแก้ไขเดิมของผู้ใช้
- ตรวจไฟล์จริงก่อนอ้าง path, type, API shape หรือพฤติกรรม
- ใช้ข้อมูลจริงจาก Parse/Validate response ห้ามสร้าง count, row หรือสถานะจำลองใน production UI
- รักษาโครงสร้าง 53 ช่องตาม Template runtime
- แก้เฉพาะไฟล์ใน `frontend/` และ `backend/` ที่จำเป็นต่อ Slice
- ไม่แก้ `README.md` หรือ `.gitignore`
- ไม่ commit, push หรือเปลี่ยน branch หากผู้ใช้ไม่ได้สั่ง
- งาน logic ใช้ test-first เมื่อมี test harness อยู่แล้ว หาก frontend ไม่มี test runner ให้แยก pure function เท่าที่เหมาะสมและตรวจด้วย Typecheck กับ Browser โดยไม่เพิ่ม framework เพียงเพื่อ Slice นี้
- เมื่อ gate ไม่ผ่าน ให้หยุด แก้เฉพาะสาเหตุในขอบเขต และรายงาน blocker หากต้องขยาย scope
- จบ Slice แล้วหยุด ห้ามเริ่ม Slice ถัดไปเอง

## Baseline ที่ต้องตรวจใหม่ก่อนแก้

จุดเชื่อมปัจจุบันที่ทราบ:

- State และ payload หลัก: `frontend/app/page.tsx`
- Review layout: `frontend/app/components/PreviewStep.tsx`
- Mapping ปัจจุบัน: `frontend/app/components/MappingSummary.tsx`
- Sheet selection helper: `frontend/lib/sheet-selection.ts`
- Frontend contract: `frontend/lib/client-types.ts`
- Export endpoint: `backend/app/api/v1/export/route.ts`
- Request validation: `backend/lib/export-request.ts`
- Mapping/transform: `backend/lib/mapping.ts`, `backend/lib/manual-mapping.ts`, `backend/lib/transform.ts`
- Validation: `backend/lib/validate.ts`
- Workbook output: `backend/lib/template.ts`
- Reparse contract: `backend/lib/reparse-request.ts`, `backend/lib/reparse-sheet.ts`
- Styles: `frontend/app/globals.css`

Baseline นี้อาจเปลี่ยนได้ AI ต้องค้นหา call site และ test ที่เกี่ยวข้องใหม่ทุกครั้ง

## Slice dependency

```text
Slice 1 Sheet Selection + Summary
  → Slice 2 Source-first Mapping
    → Slice 3 Source Decisions + Coverage
      → Slice 4 Preview + Draft + Stale State
        → Slice 5 Backend Enforcement + Reconciliation
          → Slice 6 Browser/Responsive QA
```

## Slice 1 — Sheet Selection และภาพรวม

### เป้าหมาย

ให้ผู้ใช้เห็นทุกชีต เลือกชีตข้อมูลหนึ่งหรือหลายชีตเอง และเข้าใจภาพรวมจากข้อมูลจริงก่อนเปิด Advanced Mapping

### In scope

- เปลี่ยน selection จากค่าที่เลือกอัตโนมัติเป็น state ที่เริ่มต้น `false` ทุกชีต
- แสดงทุกชีตจาก Parse response พร้อมชนิดและเหตุผลที่อ่านได้
- เพิ่ม “เลือกชีตข้อมูลสินทรัพย์ทั้งหมด” และ “ยกเลิกทั้งหมด”
- แยก action “เลือกแปลง” ออกจากสถานะชีตสรุป
- ยังไม่แสดง action แนบชีตสรุปที่ดูเหมือนทำงานได้ จนกว่า Backend ใน Slice 5 รองรับจริง
- สร้างภาพรวม 53/53, Source Coverage ที่คำนวณได้จริง, จำนวนแถว และจำนวนปัญหาที่กดไปยังรายละเอียดได้
- ใช้ข้อความภาษาไทยตามเอกสารแม่

### จุดที่ต้องระวัง

- `createParsedSheetSelection` ปัจจุบันเลือกบางชีตให้อัตโนมัติ ต้องเปลี่ยนโดยไม่ทำให้ state ถูกสร้างใหม่ทุก render
- Summary ต้องไม่รวม Warning ที่ไม่มีรายการให้ผู้ใช้ดำเนินการ
- ถ้ายังไม่มีข้อมูลจริงสำหรับ metric ใด ให้ซ่อนหรือแสดง “รอการตรวจสอบ” แทนเลขสมมติ

### Completion gate

- อัปโหลดแล้วไม่มีชีตถูกเลือกโดยอัตโนมัติ
- เลือกหนึ่งชีต, หลายชีต, เลือกทั้งหมด และยกเลิกทั้งหมดได้
- ชีตสรุปและชีตไม่รองรับยังมองเห็น แต่ไม่ถูกส่งเป็นชีตแปลง
- จำนวนบน Summary ย้อนกลับไปหา Parse/Validate data จริงได้
- Frontend typecheck ผ่าน
- Browser smoke test ของ selection ผ่านอย่างน้อย desktop หนึ่งขนาด

### Prompt 1

```text
ทำ Slice 1 จาก ADVANCED_MAPPING_IMPLEMENTATION.md: Sheet Selection และภาพรวม

อ่าน ADVANCED_MAPPING_UX.md และ Execution protocol ก่อน ตรวจโค้ดปัจจุบันแล้วทำเฉพาะ Slice 1 ใช้ข้อมูลจริงเท่านั้น ยังไม่ทำ Source-first editor, เหตุผลไม่นำเข้า, Summary attachment backend, Header Structure หรือ Audit Trail รัน Completion gate รายงานไฟล์ที่แก้และหลักฐาน แล้วหยุดโดยไม่เริ่ม Slice 2
```

## Slice 2 — Source-first Mapping

### เป้าหมาย

เปลี่ยน Advanced Mapping จากรายการช่องผลลัพธ์เป็นรายการคอลัมน์ต้นฉบับ โดยรักษา API mapping shape ปัจจุบันไว้ก่อน

### In scope

- สร้าง source-first view model จาก `sheet.headers`, auto suggestions และ manual overrides
- แสดงตัวอย่างค่าจริง 3–5 ค่าต่อคอลัมน์จากแถวจริง
- เพิ่ม Search ทั้งชื่อคอลัมน์ต้นฉบับและปลายทาง
- เพิ่ม Filter: ทั้งหมด / ยังไม่ได้ระบุปลายทาง / ระบบแนะนำ / คุณเลือกเอง
- แสดง badge ภาษาไทยและเหตุผลสั้น ๆ
- ปิดตัวเลือกปลายทางที่ถูกใช้ พร้อมบอกชื่อคอลัมน์ต้นฉบับที่ใช้อยู่
- คืนค่าระบบแนะนำรายคอลัมน์
- เพิ่มมุมมองรอง “ดูตาม 53 ช่องผลลัพธ์”
- Mapping ครบเริ่มแบบย่อ; unresolved เปิดอัตโนมัติ; จำสถานะเปิด/ปิดแยกรายชีต

### จุดที่ต้องระวัง

- State/API ปัจจุบันเก็บ `templateColumn -> sourceColumn`; UI ใหม่เป็น Source-first จึงควรใช้ adapter ไม่กลับทิศ contract แบบกระจายหลายไฟล์ใน Slice นี้
- แยกคอลัมน์ต้นฉบับจริงออกจาก internal/parser fields ที่ขึ้นต้นด้วย `__`
- กติกา Parser ที่ใช้ค่าซ้ำต้องมองเห็นได้และไม่ถูกทำลายโดย one-to-one UI
- Slice นี้ยังไม่มี “ไม่นำเข้า”; unresolved ต้องคง unresolved

### Completion gate

- ทุก source column ที่แสดงย้อนกลับไปหา header จริงได้
- ตัวอย่างค่ามาจากข้อมูลจริง
- Search และทุก Filter ให้ผลถูกต้อง
- ไม่สามารถเลือกปลายทางเดียวกันซ้ำโดยไม่ตั้งใจ
- Reset คืนค่า auto suggestion เดิมจริง
- เปลี่ยนชีตแล้ว state และสถานะเปิด/ปิดไม่หาย
- Frontend typecheck และ desktop/mobile component smoke test ผ่าน

### Prompt 2

```text
ทำ Slice 2 จาก ADVANCED_MAPPING_IMPLEMENTATION.md: Source-first Mapping

ถือว่า Slice 1 ผ่านแล้ว อ่านเอกสารแม่และ Execution protocol ทำ source-first ผ่าน adapter โดยรักษา export mapping contract ปัจจุบัน ใช้ sample values จริงและทำ state/filter/duplicate prevention ตาม gate ยังไม่เพิ่มเหตุผลไม่นำเข้า, Row Reconciliation, Header Structure หรือ Audit Trail ตรวจผลแล้วหยุดที่ Slice 2
```

## Slice 3 — “ไม่นำเข้า” พร้อมเหตุผลและ Source Coverage

### เป้าหมาย

ทำให้ทุกคอลัมน์ต้นฉบับที่มีข้อมูลมี Consumption Record: ถูก Mapping หรือไม่นำเข้าพร้อมเหตุผล

### Contract ที่ต้องออกแบบและทดสอบ

เพิ่ม decision ต่อคอลัมน์ต้นฉบับโดยใช้ stable internal reason code จากเอกสารแม่ ตัวอย่าง shape:

```ts
type SourceColumnDecision = {
  action: "notImported";
  reasonCode:
    | "unsupported_destination"
    | "duplicate_information"
    | "helper_or_grouping"
    | "not_asset_data"
    | "other";
  note?: string;
};

type SourceColumnDecisions = Record<string, SourceColumnDecision>;
```

AI ต้องตรวจ contract ปัจจุบันก่อนใช้ชื่อนี้ และใช้ชื่อเดียวกันทั้ง frontend/backend/tests

### In scope

- เพิ่มสถานะ “ไม่นำเข้า” ใน source-first list และ Filter
- แสดง reason select; `other` ต้องมีรายละเอียด
- คำนวณ non-empty source column จาก parsed rows ทั้งชุด ไม่ใช้เพียง sample 5/30 แถว
- Source Coverage นับเฉพาะคอลัมน์ที่มีข้อมูลจริง
- Validate/Draft ทำงานได้แม้ยัง unresolved แต่ Download ถูกบล็อก
- Backend ตรวจ reason code และความยาว note ไม่เชื่อ payload จาก client อย่างเดียว
- Draft ต่อชีตเก็บ Mapping และ source decisions แยกกัน

### Completion gate

- ทุก non-empty source column จัดเป็น mapped / notImported / unresolved ได้เพียงสถานะเดียว
- `other` ที่ไม่มี note ถูกปฏิเสธ
- reason code ที่ไม่รู้จักถูก Backend ปฏิเสธ
- unresolved บันทึก Draft และ Validate ได้ แต่ Download ไม่ได้
- Coverage เปลี่ยนตาม Mapping/decision จริง
- Frontend typecheck และ Backend tests ผ่าน

### Prompt 3

```text
$tdd ทำ Slice 3 จาก ADVANCED_MAPPING_IMPLEMENTATION.md: ไม่นำเข้าพร้อมเหตุผลและ Source Coverage

ถือว่า Slice 1–2 ผ่านแล้ว อ่านเอกสารแม่และ Execution protocol เขียน test ของ contract/validation ก่อน implement ใช้ข้อมูลทุกแถวในการหา non-empty source columns และใช้ stable reason codes ตามเอกสาร ทำเฉพาะ Slice 3 รัน gate แล้วหยุด
```

## Slice 4 — Preview, Draft และ stale validation

### เป้าหมาย

ให้ผู้ใช้เห็นผลของ Mapping ก่อนตรวจใหม่ และรักษา Draft ต่อชีตตลอด session

### In scope

- เปรียบเทียบต้นฉบับกับผลลัพธ์อย่างน้อย 5 แถวจากข้อมูลจริง
- ไฮไลต์เฉพาะปลายทางที่เปลี่ยนด้วย manual mapping
- แสดง Before/After เมื่อค่าผ่าน technical normalization
- เปลี่ยน stale state จาก global เป็นรายชีต
- Mapping และ source decisions อยู่เมื่อสลับชีต, ยกเลิกเลือกชีต หรือ Revalidation ล้มเหลว
- “ล้าง Draft” ทำงานเฉพาะชีตและมีผลที่อธิบายชัด
- เอาการแก้ค่าเซลล์และการตัดแถวออกจาก UI, frontend state และ export payload
- คง Backend compatibility ของ `cellOverrides` และ `excludedRows` ไว้จนกว่าจะมี cleanup แยก

### จุดที่ต้องระวัง

- Reparse ปัจจุบันล้าง Mapping และ row fixes ต้องรักษา Draft เดิมไว้เพื่อทำ Diff ใน Phase Header ภายหลัง
- Preview ไม่ใช่ผล Validate ล่าสุด หากชีต stale ต้องติดป้ายชัดเจน
- ไม่สร้าง cell editor หรือ row exclusion control รูปแบบใหม่

### Completion gate

- เปลี่ยน Mapping แล้วเฉพาะชีตนั้น stale
- สลับ/ยกเลิกเลือกชีตแล้ว Draft ยังอยู่
- Validation ล้มเหลวแล้ว Draft ยังอยู่
- อัปโหลดไฟล์ใหม่หรือล้าง Draft แล้ว state ถูกล้างตามขอบเขต
- ไม่มี cell edit/row exclusion control และ frontend ไม่ส่งสอง field นี้
- Preview ตรงกับ mapping state สำหรับตัวอย่างอย่างน้อย 5 แถว
- Frontend typecheck ผ่าน

### Prompt 4

```text
ทำ Slice 4 จาก ADVANCED_MAPPING_IMPLEMENTATION.md: Preview, Draft และ stale validation

ถือว่า Slice 1–3 ผ่านแล้ว อ่านเอกสารแม่และ Execution protocol ทำ state ต่อชีตและ Preview จากข้อมูลจริง เอา cell editing/row exclusion ออกจาก frontend เท่านั้นโดยคง backend compatibility รัน Completion gate แล้วหยุด ห้ามเริ่ม Header Structure
```

## Slice 5 — Backend Enforcement, Reconciliation และ Summary Attachment

### เป้าหมาย

บังคับกติกาที่ตกลงกันบน Server และทำให้ผลลัพธ์ไม่มีชีตหรือแถวหายแบบเงียบ ๆ

### In scope

- เพิ่ม `ประเภทสินทรัพย์` เป็นช่องบังคับร่วมกับรหัสและชื่อ
- แถวหัวกลุ่มไม่ถูกส่งออก และค่ากลุ่มส่งต่อจนถึงหัวกลุ่มถัดไป
- ตรวจ Reference ของ Template runtime ก่อนกำหนดว่าค่าใดเป็นประเภทหรือชนิด
- เมื่อระดับกลุ่มคลุมเครือ ให้ส่งสถานะที่ UI ต้องยืนยัน แทนการเดา
- รหัสสินทรัพย์ซ้ำเป็น Warning และเก็บทุกแถว; แถวซ้ำทั้งแถวบอกตำแหน่ง
- หากชีตข้อมูลที่เลือกมี Error ให้ Download ทั้งชุดล้มเหลว ห้ามส่งออกเฉพาะชีตที่ผ่านแบบเงียบ ๆ
- ผู้ใช้เลือกแนบชีตสรุปได้; Backend คัดลอกชีตนั้นตามต้นฉบับ ไม่แปลง 53 ช่อง
- สร้าง Row Reconciliation: source row / output row / not exported พร้อม sheet, original Excel row และ reason
- Validate response ส่ง sheet summaries และ actionable counts ที่ frontend ใช้จริง
- Export ใช้ Mapping และ source decisions รุ่นเดียวกับผล Validate ล่าสุด

### Completion gate

- Backend tests ครอบคลุม required category, carried group, ambiguous group, duplicates, atomic selected batch และ optional summary attachment
- ทุก converted sheet มี 53 ช่องจาก Template runtime
- ทุก source row มี output link หรือ not-exported reason
- Summary attachment คงข้อมูลและลำดับชีตที่ตรวจสอบได้
- Warning ไม่บล็อก; Error ใน selected set บล็อกทั้งไฟล์
- Frontend/Backend typecheck, Backend tests และ build ผ่าน

### Prompt 5

```text
$tdd ทำ Slice 5 จาก ADVANCED_MAPPING_IMPLEMENTATION.md: Backend Enforcement, Row Reconciliation และ Summary Attachment

ถือว่า Slice 1–4 ผ่านแล้ว อ่านเอกสารแม่และ Execution protocol ตรวจ Reference ของ Template จริงก่อนเขียนกฎประเภท/ชนิด เขียน integration tests ก่อน implement บังคับ selected batch แบบ atomic และห้ามทิ้งชีต/แถวแบบเงียบ ๆ รัน Completion gate ทั้งหมดแล้วหยุด ห้ามเริ่ม Header Structure หรือ Audit Trail
```

## Slice 6 — Browser, Responsive และ Accessibility QA

### เป้าหมาย

ยืนยัน flow จริง ไม่ใช้ Typecheck แทนการตรวจ UX

### Test matrix ขั้นต่ำ

1. ไฟล์หนึ่งชีต: เริ่มไม่เลือก → เลือก → Mapping → Validate → Download
2. ไฟล์หลายชีต: เลือกหนึ่งชีตและหลายชีต
3. ชีตสรุป: ไม่แนบและเลือกแนบตามต้นฉบับ
4. คอลัมน์ non-empty: mapped / notImported พร้อมเหตุผล / unresolved
5. หัวกลุ่ม: ส่งต่อประเภทหรือชนิดและไม่กลายเป็น output row
6. Required category: แถวมีรหัสและชื่อแต่ไม่มีประเภทต้อง Error
7. Duplicate asset code: Warning และยัง Download ได้
8. Selected batch: หนึ่งชีต Error ต้องบล็อกทั้งชุด
9. Draft: สลับชีต, ยกเลิกเลือก และ validation failure
10. Desktop, mobile, keyboard และ screen-reader smoke test

ใช้ไฟล์เทศบาลจริงทุก Source Profile ที่มีอยู่ หาก fixture ที่จำเป็นไม่อยู่ใน workspace ให้รายงานชื่อกรณีที่ขาดและขอไฟล์จากผู้ใช้ ห้ามสร้างผลผ่านจาก mock ที่ไม่แทนโครงสร้างจริง

### Completion gate

- `npm.cmd run typecheck` ผ่าน
- `npm.cmd run test` ผ่าน
- `npm.cmd run build` ผ่าน
- Browser flow ผ่าน Test matrix ที่มี fixture
- ตรวจไฟล์ `.xlsx` ที่ดาวน์โหลดจริง: ชื่อชีต, จำนวนชีต, header 53 ช่อง, row counts และ summary attachment
- ไม่มี keyboard trap, label หาย, focus มองไม่เห็น หรือ mobile horizontal overflow ที่ทำให้ใช้งานไม่ได้
- รายงานกรณีที่ยังทดสอบไม่ได้แยกจากกรณีที่ผ่าน ห้ามทำเครื่องหมายผ่านแทนกัน

### Prompt 6

```text
ใช้ browser control ทำ Slice 6 จาก ADVANCED_MAPPING_IMPLEMENTATION.md: Browser, Responsive และ Accessibility QA

ถือว่า Slice 1–5 ผ่านแล้ว อ่าน Test matrix และ Execution protocol รัน typecheck, tests และ build จากนั้นทดสอบ Upload → Review → Validate → Download ใน browser ด้วย fixture จริง ตรวจไฟล์ผลลัพธ์จริง แก้เฉพาะ defect ที่พบในขอบเขต Slices 1–5 แล้วทดสอบซ้ำ รายงาน passed / failed / not tested แยกกัน และหยุดโดยไม่เริ่ม Header Structure
```

## Deferred — ยังไม่เริ่มในงานรอบแรก

### Header Structure

- Raw Preview อย่างน้อย 15 แถว พร้อม Excel letters และเลขแถวจริง
- Header start/end รองรับ 1–3 แถว
- Data start/end แยกจาก Header
- Preview ชื่อคอลัมน์ที่ประกอบแล้วและ provenance ของเซลล์
- Row counts ก่อน/หลัง Reparse, unidentified rows และ Mapping Diff
- รักษา Draft เดิมหลัง Reparse

### Persistent Draft และ Audit Trail

- Draft อยู่หลัง Refresh/ปิด Browser และกลับมาเปิดงานเดิมได้
- เก็บผู้เปลี่ยน เวลา before/after Mapping และ source decisions
- เก็บ Header/Data range และ validation version ที่ใช้ Download

สองหัวข้อนี้ต้องมีแผนและ Prompt แยกหลัง Slice 6 ผ่าน ห้ามรวมเข้า Prompt 1–6
