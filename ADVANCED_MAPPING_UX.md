# Advanced Mapping UX/UI Plan

สถานะ: **Draft — หลักการที่ตกลงแล้ว พร้อมรายการ Open Decisions ที่ยังต้องยืนยัน**

เอกสารนี้ใช้วางแผนและออกแบบหน้าบ้านเท่านั้น ยังไม่ได้แก้ production code โดยยึด visual language จาก Stitch ที่ใช้ในหน้า Upload และ Review ส่วนงานหลังบ้านที่จำเป็นถูกแยกไว้เป็น dependency สำหรับทำภายหลัง

## บริบทการใช้งาน

- ผู้ใช้เป็นพนักงานบริษัทที่เข้าใจข้อมูลสินทรัพย์ระดับหนึ่ง แต่ไม่จำเป็นต้องเชี่ยวชาญโครงสร้าง Excel
- ไฟล์ต้นฉบับมาจากเทศบาลและอาจมีหัวตารางหลายชั้น ชื่อคอลัมน์ไม่ตรงกัน หรือมีแถวประกอบอื่นปะปน
- ไฟล์ผลลัพธ์ต้องใช้โครงสร้าง Template คงที่ 53 คอลัมน์ ชื่อและลำดับต้องตรงกับไฟล์ที่เว็บไซต์ปลายทางยอมรับ
- ห้ามเพิ่มคอลัมน์ลงในไฟล์ผลลัพธ์ เพราะเว็บไซต์ปลายทางตรวจ Template
- ข้อมูลต้นฉบับต้องไม่ตกหล่นโดยไม่มีคำอธิบาย และระบบต้องไม่เดา เติม หรือแก้ค่าภายในเซลล์แทนผู้ใช้

## เป้าหมายของหน้า

หน้า Advanced Mapping ต้องช่วยให้ผู้ใช้ตอบคำถามต่อไปนี้ได้ทันที:

1. ไฟล์ผลลัพธ์ยังคงมีโครงสร้างครบ 53 คอลัมน์ตาม Template หรือไม่
2. คอลัมน์ต้นฉบับที่มีข้อมูลถูกนำไปใช้ครบหรือยัง
3. พบแถวข้อมูลต้นฉบับกี่แถว ส่งออกกี่แถว และมีแถวใดไม่ถูกส่งออกพร้อมเหตุผลหรือไม่
4. ถ้าแก้การจับคู่แล้ว ค่าใดจะเปลี่ยนตำแหน่งในไฟล์ผลลัพธ์

> “53 คอลัมน์ครบ” หมายถึงโครงสร้างไฟล์ครบตาม Template ไม่ได้หมายความว่าทุกคอลัมน์ต้องมีข้อมูลหรือจำเป็นต้องจับคู่ ช่องที่ต้นฉบับไม่มีข้อมูลให้คงเป็นค่าว่าง

## หลักการที่ตกลงแล้ว

- ใช้ภาษางานจริง แทนศัพท์ `Template`, `Source`, `Confidence`, `Parser` และ `Manual`
- Advanced Mapping เปลี่ยนเฉพาะปลายทางของคอลัมน์ ไม่แก้ค่าภายในเซลล์
- คัดลอกค่าต้นฉบับตามจริง ช่องว่างให้คงว่าง และไม่สร้างค่าเริ่มต้นแทนข้อมูลที่ไม่มี
- คอลัมน์ต้นฉบับหนึ่งคอลัมน์ใช้เป็นแหล่งข้อมูลได้เพียงหนึ่งช่องปลายทาง
- ไม่รวมค่าจากหลายคอลัมน์ต้นฉบับเป็นช่องปลายทางเดียวภายใน Advanced Mapping
- แยก “ระบบแนะนำ” ออกจาก “ผู้ใช้เลือกเอง” ให้เห็นชัด
- มุมมองหลักเริ่มจากคอลัมน์ต้นฉบับ เพื่อให้ผู้ใช้ตรวจได้ว่าข้อมูลทุกคอลัมน์ถูกนำไปไว้ที่ใด
- การเปลี่ยน Mapping หรือโครงสร้าง Header ทำให้ผลตรวจสอบเดิมเป็นข้อมูลเก่า และต้องตรวจใหม่ก่อนดาวน์โหลด
- ไม่อนุญาตแก้ค่าในเซลล์ ลบแถว หรือเลือกไม่ส่งออกแถวจากหน้า Advanced Mapping
- เก็บ Mapping เป็น Draft และเก็บประวัติว่าใครเปลี่ยนอะไร เมื่อใด

## ความหมายของสถานะบนหน้า

| สถานะ | ความหมาย |
| --- | --- |
| โครงสร้างผลลัพธ์ `53/53` | ไฟล์มีชื่อและลำดับคอลัมน์ครบตาม Template |
| ใช้ข้อมูลต้นฉบับ `x/y` | คอลัมน์ต้นฉบับที่มีข้อมูลและระบุปลายทางแล้ว เทียบกับทั้งหมด |
| แถวข้อมูล `x` | จำนวนแถวที่ตรวจว่าเป็นรายการข้อมูลจากต้นฉบับ |
| แถวพร้อมส่งออก `x` | จำนวนแถวที่จะปรากฏในไฟล์ผลลัพธ์ |
| แถวต้องตรวจสอบ `x` | แถวที่ยังไม่ส่งออกหรือจำแนกไม่ได้ ต้องแสดงเหตุผลทุกแถว |
| ต้องตรวจสอบใหม่ | Mapping หรือ Header เปลี่ยนหลังการตรวจสอบครั้งล่าสุด |

ห้ามใช้สีเขียวหรือข้อความ “ผ่านแล้ว” เพื่อสื่อว่าไม่มีข้อมูลตกหล่น หากยังไม่ได้ตรวจทั้ง Source Coverage และ Row Reconciliation

## ลำดับการออกแบบหน้าบ้าน

### Phase 1 — ภาพรวมที่ผู้ใช้เข้าใจได้ทันที

- [ ] เปลี่ยนหัวข้อ `Mapping Summary` เป็น “ภาพรวมการจัดวางข้อมูล”
- [ ] แสดง “โครงสร้างไฟล์ผลลัพธ์ 53/53 ช่อง” แยกจากจำนวนช่องที่มีข้อมูล
- [ ] แสดงจำนวนคอลัมน์ต้นฉบับที่มีข้อมูลและระบุปลายทางแล้ว
- [ ] แสดงจำนวนแถวต้นฉบับ แถวที่จะส่งออก และแถวที่ต้องตรวจสอบ
- [ ] แสดงจำนวนรายการที่ต้องตรวจสอบ โดยกดเพื่อไปยังรายการนั้นได้
- [ ] เปลี่ยนหัวตารางและสถานะทั้งหมดเป็นภาษาไทย
- [ ] เตือนเมื่อมีคอลัมน์ต้นฉบับที่มีข้อมูลแต่ยังไม่ระบุปลายทาง
- [ ] ไม่แสดงจำนวน Warning ดิบจากหลังบ้าน หากผู้ใช้ไม่สามารถดำเนินการกับ Warning นั้นได้

### Phase 2 — Mapping Workspace แบบ Source-first

- [ ] สร้างหัวส่วน Advanced Mapping ที่อธิบายผลกระทบก่อนแก้
- [ ] ใช้คอลัมน์ต้นฉบับเป็นรายการหลัก และให้เลือก “ช่องปลายทางในไฟล์ผลลัพธ์”
- [ ] เพิ่มตัวกรอง “ทั้งหมด / ยังไม่มีปลายทาง / ระบบแนะนำ / คุณเลือกเอง”
- [ ] ค้นหาได้ทั้งชื่อคอลัมน์ต้นฉบับและช่องปลายทาง
- [ ] แสดงตัวอย่างค่าจริง 3–5 ค่าใต้ชื่อคอลัมน์ต้นฉบับ
- [ ] แสดงสถานะว่าแต่ละคอลัมน์ “ระบบแนะนำ”, “คุณเลือกเอง” หรือ “ยังไม่มีปลายทาง”
- [ ] ปิดตัวเลือกปลายทางที่ถูกใช้อยู่ พร้อมบอกว่าถูกใช้โดยคอลัมน์ใด
- [ ] คืนค่าระบบแนะนำได้รายคอลัมน์
- [ ] มีมุมมองรอง “ดูตาม 53 ช่องผลลัพธ์” สำหรับตรวจโครงสร้างปลายทาง โดยไม่ใช้เป็นมุมมองหลัก
- [ ] แสดงช่องผลลัพธ์ที่ไม่มีข้อมูลเป็น “เว้นว่างตามต้นฉบับ” ไม่ใช้คำว่า Error

### Phase 3 — Preview และการกระทบยอดข้อมูล

- [ ] แสดงข้อมูลต้นฉบับเทียบกับตัวอย่างไฟล์ผลลัพธ์อย่างน้อย 5 แถว
- [ ] ไฮไลต์เฉพาะคอลัมน์ที่ผู้ใช้เปลี่ยน Mapping
- [ ] ทำ Before/After Diff เฉพาะตำแหน่งข้อมูลที่เปลี่ยน
- [ ] แสดง Row Reconciliation: พบจากต้นฉบับ / พร้อมส่งออก / ต้องตรวจสอบ
- [ ] เปิดดูทุกแถวที่ไม่ถูกส่งออก พร้อมเหตุผลที่เจาะจงและย้อนกลับไปยังชีต/เลขแถวต้นฉบับได้
- [ ] เมื่อ Mapping เปลี่ยน ให้แสดงสถานะ “ต้องตรวจสอบใหม่” และเปลี่ยน CTA เป็น “ตรวจสอบอีกครั้ง”
- [ ] เก็บการแก้ Mapping ไว้เมื่อการตรวจสอบล้มเหลว เพื่อให้ผู้ใช้กลับมาแก้ต่อได้
- [ ] แสดงสถานะ “โครงสร้างถูกต้อง” แยกจาก “พร้อมนำเข้าเว็บไซต์”

### Phase 4 — Header Structure

- [ ] แสดง Raw Preview ของแต่ละชีตอย่างน้อย 15 แถวแรก พร้อมตัวอักษรคอลัมน์และเลขแถวจริง
- [ ] เลือกแถวเริ่มต้นและแถวสิ้นสุดของ Header ได้ โดยรองรับหัวตาราง 1–3 แถว
- [ ] เลือกแถวเริ่มต้นข้อมูลและแถวสิ้นสุดข้อมูลแยกจาก Header
- [ ] แสดงชื่อคอลัมน์ที่ระบบประกอบจาก Header หลายชั้นก่อนยืนยัน
- [ ] ทำชื่อที่ประกอบแล้วให้ไม่ซ้ำกัน พร้อมแสดงว่ามาจากเซลล์ใดบ้าง
- [ ] แสดงจำนวนแถวข้อมูลก่อนและหลังเปลี่ยน Header Structure
- [ ] เตือนเมื่อมีแถวระหว่าง Header กับข้อมูล หรือท้ายชีตที่ระบบยังจำแนกไม่ได้
- [ ] เก็บ Mapping เดิมเป็น Draft และแสดง Diff หลัง Reparse
- [ ] ให้ยืนยัน Header Structure แยกเป็นรายชีต เพราะรูปแบบแต่ละชีตอาจต่างกัน

### Phase 5 — ประวัติการเปลี่ยนแปลง

- [ ] แสดงผู้เปลี่ยน วันเวลา และสรุปสิ่งที่เปลี่ยน
- [ ] บันทึก Mapping ก่อนและหลังแก้
- [ ] บันทึก Header Row, Data Start และ Data End ที่เลือกในแต่ละชีต
- [ ] บันทึกผลตรวจสอบและเวอร์ชัน Mapping ที่ใช้สร้างไฟล์ผลลัพธ์
- [ ] เปิดดูประวัติได้จากหน้ารายละเอียดงาน โดยไม่รบกวน Flow หลัก

## Backend Dependencies — ทำหลังงานออกแบบหน้าบ้านครบ

รายการนี้ไม่ใช่งานที่ต้องเริ่มในรอบออกแบบ UI แต่ Mockup ต้องมี State รองรับไว้:

- ตรวจ Duplicate Mapping ซ้ำใน Backend ไม่เชื่อค่าจาก Client เพียงอย่างเดียว
- คำนวณ Auto Mapping ใหม่จากข้อมูล Analysis ฝั่ง Server
- ส่ง Source Coverage ระดับคอลัมน์ พร้อมระบุว่าแต่ละคอลัมน์ถูกใช้ที่ใด
- ส่ง Row Reconciliation พร้อมเหตุผลของทุกแถวที่ไม่ถูกส่งออก
- รองรับ Header Range, Data Start และ Data End แยกรายชีต
- ไม่ทิ้งแถวหรือคอลัมน์ต้นฉบับโดยไม่มี Consumption Record หรือเหตุผลที่ตรวจสอบย้อนหลังได้
- เก็บ Audit Trail แบบถาวร
- ตรวจชื่อ ลำดับ จำนวนคอลัมน์ และรูปแบบ Workbook ตามข้อกำหนดของเว็บไซต์ปลายทาง

## Open Decisions — ยังไม่ถือเป็นข้อสรุป

1. ถ้ามีคอลัมน์ต้นฉบับที่มีข้อมูลแต่ยังไม่มีปลายทาง จะบล็อก Export เสมอหรือให้บันทึกเป็น Draft ได้แต่ยังดาวน์โหลดไม่ได้
2. ชีตสรุป เช่น `แบบกข.` จะเก็บในไฟล์ผลลัพธ์ แยกเก็บเป็นข้อมูลอ้างอิง หรือไม่นำเข้าระบบ
3. ไฟล์สำหรับเว็บไซต์ปลายทางต้องมีเฉพาะ `Sheet1` หรือรองรับหลายชีตได้
4. เมื่อพบรหัสสินทรัพย์ซ้ำ จะเตือนและเก็บทุกแถว หรือบล็อกการนำเข้า
5. ช่องว่างใดเป็นเพียงข้อมูลที่ไม่มี และช่องว่างใดเป็นข้อมูลบังคับของเว็บไซต์ปลายทาง
6. วันที่ ตัวเลข เงิน และค่าบูลีน ต้องรักษาค่าที่มองเห็นจากต้นฉบับ หรือแปลงเฉพาะรูปแบบทางเทคนิคใดก่อน Export

จนกว่าจะตัดสินใจเรื่องเหล่านี้ UI ต้องแสดงเป็น State สำหรับทดสอบเท่านั้น และห้ามเขียนข้อความที่ทำให้เข้าใจว่าเป็นกฎสุดท้าย

## สิ่งที่เปลี่ยนจาก Stitch

Stitch เดิมถูกใช้เป็นฐานของ Upload และ Review Page: Card สีขาว, Border สีม่วงอ่อน, Indigo เป็นสีหลัก, Teal แสดงสถานะสำเร็จ และปุ่มทรงโค้งมน

Advanced Mapping ปรับต่อจากฐานนั้นดังนี้:

| จากหน้าที่ได้จาก Stitch | ปรับสำหรับ Advanced Mapping |
| --- | --- |
| Summary Card แสดงจำนวนชีต/ปัญหา | แยกโครงสร้าง 53 ช่อง, Source Coverage, Row Reconciliation และรายการที่ต้องตรวจ |
| ตารางข้อมูลทั่วไป | เปลี่ยนเป็น Source-first Mapping Workspace |
| Status Badge แบบระบบ | ใช้ภาษาผู้ใช้: ระบบแนะนำ / คุณเลือกเอง / ยังไม่มีปลายทาง |
| Primary CTA เดียวท้ายหน้า | เพิ่ม “คืนค่าระบบแนะนำ” รายคอลัมน์ และคง CTA หลักไว้ท้าย Flow |
| รายละเอียดทั้งหมดแสดงพร้อมกัน | เพิ่ม Search และ Filter เพื่อลดภาระเมื่อมีข้อมูลจำนวนมาก |
| สีเขียวหมายถึงไม่มี Error | ใช้สีเขียวเมื่อ Coverage และ Reconciliation ครบตามเงื่อนไขที่แสดงเท่านั้น |

## Stitch Prompt — หน้า Advanced Mapping ฉบับปรับปรุง

คัดลอก Prompt ด้านล่างไปใช้ใน Stitch ได้ทันที:

```text
Design a desktop-first responsive “Advanced Mapping” workspace for a Thai government Excel conversion web app.

Context:
- The user uploads a messy municipal asset workbook and maps its source columns into a fixed 53-column import structure.
- The output workbook must always retain the exact 53 destination columns in the required names and order, but not every destination needs a value. Missing source values remain blank.
- Users are operations staff who understand asset data but are not technical Excel experts.
- Values must not be edited, invented, defaulted, or deleted in this workspace.
- The visual language follows the existing Review flow: white cards, subtle lavender borders, soft blue-gray canvas, indigo primary actions, teal success states, amber attention states, 12px rounded corners, compact professional data density, Inter + Noto Sans Thai.

Primary UX goals:
1. Confirm that the output structure contains exactly 53 required columns.
2. Show whether every non-empty source column has a destination.
3. Reconcile source rows against output rows and expose every row that is not exported with a reason.
4. Let users change a destination mapping safely without editing cell values.
5. Compare source data with a five-row output preview before revalidation.

Page structure:
- Section title in Thai: “ภาพรวมการจัดวางข้อมูล”.
- Summary cards:
  1) “โครงสร้างไฟล์ผลลัพธ์” with 53/53 and supporting text “ชื่อและลำดับตรงตามรูปแบบที่กำหนด”.
  2) “ข้อมูลต้นฉบับที่ระบุปลายทางแล้ว” with used/non-empty-source count.
  3) “จำนวนแถวข้อมูล” with source rows, output rows, and rows requiring review.
  4) “ต้องตรวจสอบ” with an actionable issue count.
- Do not use mapped/53 to imply that all 53 destinations require values.
- Show an amber notice listing non-empty source columns that do not yet have a destination. Do not offer a generic Ignore action.
- Main Advanced Mapping card title: “กำหนดตำแหน่งข้อมูลในไฟล์ผลลัพธ์”. Explain that values are copied as-is, blank values stay blank, and one source column can be assigned to only one destination.
- Use a source-first mapping list. Left side: “คอลัมน์จากไฟล์ต้นฉบับ”, including 3–5 real sample values. Right side: destination select labeled “ช่องในไฟล์ผลลัพธ์”.
- Search both source and destination names. Filters: “ทั้งหมด”, “ยังไม่มีปลายทาง”, “ระบบแนะนำ”, “คุณเลือกเอง”.
- Each row has a status badge: “ระบบแนะนำ”, “คุณเลือกเอง”, or “ยังไม่มีปลายทาง”.
- If a destination is already used, disable it and state which source column uses it.
- Manual rows include “คืนค่าระบบแนะนำ”.
- Provide a secondary destination-first view titled “ดูตาม 53 ช่องผลลัพธ์”. Empty destinations say “เว้นว่างตามต้นฉบับ”, not Error.
- Add a comparison area titled “ข้อมูลต้นฉบับเทียบไฟล์ผลลัพธ์” with at least five rows. Highlight only destinations affected by a manual mapping change.
- Add a row reconciliation panel showing “พบจากต้นฉบับ”, “พร้อมส่งออก”, and “ต้องตรวจสอบ”. Rows not exported must be expandable and show sheet name, original row number, and a specific reason.
- When mappings or header settings change, show an amber “ต้องตรวจสอบใหม่” banner and change the main CTA to “ตรวจสอบอีกครั้ง”. Preserve draft changes if validation fails.
- Show “โครงสร้างถูกต้อง” separately from “พร้อมนำเข้าเว็บไซต์”.

Header Structure state:
- Include a per-sheet raw preview of at least the first 15 rows with Excel column letters and real row numbers.
- Let users select header start, header end, data start, and data end independently.
- Support one to three header rows and preview the composed unique column names before confirmation.
- Show row counts before and after reparsing, unidentified rows, and a mapping diff. Preserve the previous mapping as a draft.

Content rules:
- UI copy must be Thai-first.
- Do not use Template Column, Source Column, Confidence, Status, Parser, or Manual as visible labels.
- Do not imply that zero validation errors guarantees no data loss.
- Do not add cell editing, row deletion, or row exclusion controls.
- Do not imply that every one of the 53 destination columns must contain a value.
- Preserve the existing fixed-width review shell and responsive behavior.

Create desktop and mobile states for empty search results, unresolved mappings, unused non-empty source columns, manual mapping changes, stale validation, header selection, unidentified rows, and source/output row-count mismatch.
```

## Acceptance Checklist — UX/UI

- [ ] ผู้ใช้เข้าใจว่า `53/53` คือโครงสร้าง ไม่ใช่จำนวนช่องที่ต้องมีข้อมูล
- [ ] ผู้ใช้เห็น Source Coverage และ Row Reconciliation ก่อนเปิดเครื่องมือขั้นสูง
- [ ] ผู้ใช้ตรวจได้ว่าทุกคอลัมน์ต้นฉบับที่มีข้อมูลถูกนำไปไว้ที่ใด
- [ ] ผู้ใช้เปิดดูทุกแถวที่ไม่ถูกส่งออกและเห็นเหตุผลได้
- [ ] ผู้ใช้แยกได้ว่าระบบแนะนำหรือผู้ใช้เลือกเอง
- [ ] ผู้ใช้เห็นตัวอย่างค่าจริงก่อนเปลี่ยน Mapping
- [ ] ผู้ใช้ดูข้อมูลต้นฉบับเทียบผลลัพธ์ได้
- [ ] UI ไม่อนุญาตเลือกปลายทางเดียวกันซ้ำโดยไม่ตั้งใจ
- [ ] ช่องผลลัพธ์ที่ไม่มีข้อมูลแสดงเป็นค่าว่างตามต้นฉบับ ไม่แสดงเป็น Error โดยอัตโนมัติ
- [ ] รองรับ Header 1–3 แถว และเลือกช่วงข้อมูลแยกรายชีต
- [ ] เมื่อแก้ Mapping หรือ Header ผลตรวจเดิมเปลี่ยนเป็น “ต้องตรวจสอบใหม่”
- [ ] Draft ไม่หายเมื่อ Revalidation ล้มเหลว
- [ ] หน้าประวัติระบุผู้แก้ สิ่งที่แก้ และผลตรวจที่ใช้ Export ได้
- [ ] รองรับหน้าจอแคบโดยเรียง Mapping เป็นแนวตั้ง
- [ ] ผ่าน Visual QA ด้วยไฟล์เทศบาลจริงทุก Profile
- [ ] ผ่าน Keyboard Navigation และ Screen-reader Smoke Test

## Acceptance Checklist — Backend ภายหลัง

- [ ] Backend บังคับกติกา Mapping เดียวกับ UI
- [ ] ไม่มีคอลัมน์ต้นฉบับที่มีข้อมูลหายโดยไม่มี Consumption Record
- [ ] ไม่มีแถวต้นฉบับหายโดยไม่มีเหตุผลใน Row Reconciliation
- [ ] ช่องว่างไม่ถูกเติมค่าเริ่มต้นหรือคาดเดาโดยอัตโนมัติ
- [ ] ไฟล์ผลลัพธ์มีชื่อและลำดับ 53 คอลัมน์ตรงตาม Template
- [ ] Export ใช้ Mapping, Header Structure และ Validation Version ล่าสุด
- [ ] Audit Trail ตรวจสอบย้อนหลังได้
