# Review - Needs Attention: UX/UI Checklist

เอกสารนี้ใช้ติดตามงานปรับหน้า **Review - Needs Attention** เท่านั้น ไม่ใช่ README หลักของโปรเจกต์

## เป้าหมาย

สร้างหน้า Review ที่ช่วยให้ผู้ใช้มองเห็นชีตที่มีปัญหา เลือกชีต อ่านสาเหตุ แก้ไข mapping และไปหน้าดาวน์โหลดได้เมื่อข้อมูลพร้อม โดยใช้ข้อมูลจริงจากระบบเดิม

## ขอบเขต

- ปรับเฉพาะ frontend ก่อน
- รักษา parse, validation, mapping และ export logic เดิม
- ไม่ hardcode ชื่อชีต จำนวนรายการ หรือข้อความ error จาก mockup
- ไม่แก้ backend จนกว่าจะพบว่า UI ต้องการข้อมูลที่ API เดิมไม่มีจริง ๆ
- ทำและตรวจทีละ step ก่อนเริ่ม step ถัดไป

## ไฟล์หลัก

- `frontend/app/components/PreviewStep.tsx` — ข้อมูลและหน้าจอ Review
- `frontend/app/components/ReviewShell.tsx` — topbar, sidebar และ progress
- `frontend/app/components/MappingSummary.tsx` — Advanced Mapping เดิม
- `frontend/app/components/SourcePreviewTable.tsx` — ตารางตัวอย่างข้อมูลเดิม
- `frontend/app/globals.css` — layout, สี, spacing และ responsive
- `frontend/app/page.tsx` — state และ handlers หลัก อ่านเพื่อทำความเข้าใจ แต่หลีกเลี่ยงการแก้ในช่วงแรก

## Checklist

### Step 0 — ตรวจ baseline ก่อนแก้ UI

- [X] เปิดระบบด้วย `npm.cmd run dev`
- [X] ทดลองอัปโหลดไฟล์ที่มีทั้งชีตพร้อมใช้และชีตมีปัญหา
- [X] บันทึกภาพหน้า Review ปัจจุบันไว้เปรียบเทียบ
- [X] ตรวจว่า flow เดิม Upload -> Review -> Download ทำงานได้

ผ่านเมื่อ: รู้ว่าหน้าเดิมแสดงอะไร และมีไฟล์ตัวอย่างสำหรับทดสอบซ้ำ

### Step 1 — เตรียม state สำหรับชีตที่เลือก

- [X] เพิ่ม `selectedReviewKey`
- [X] สร้าง `selectedReviewRow` และเลือกชีตมีปัญหาเป็นค่าเริ่มต้น
- [X] จัด indentation ของโค้ดใหม่ให้อ่านง่าย
- [X] รัน typecheck แล้วไม่มี error

ผ่านเมื่อ: TypeScript รู้จักชีตที่เลือกและโปรเจกต์ยัง compile ได้

### Step 2 — วางโครงหน้า Needs Attention

- [ ] คง page heading และคำอธิบายสถานะไว้
- [ ] คง progress ขั้นที่ 2 Review ไว้
- [ ] สร้างพื้นที่ summary cards
- [ ] สร้าง layout สองคอลัมน์: Sheet List และ Problem Details
- [ ] คง action bar ด้านล่าง

ผ่านเมื่อ: เห็นโครงหน้าครบ แม้รายละเอียดภายในยังไม่สมบูรณ์

### Step 3 — ทำ Summary Cards จากข้อมูลจริง

- [ ] แสดงจำนวนชีตพร้อมใช้งานจาก `readyCount`
- [ ] แสดงจำนวนชีตที่ต้องตรวจสอบจาก `attentionCount`
- [ ] ใช้สีเขียวสำหรับพร้อมใช้งาน
- [ ] ใช้สีเหลืองหรือแดงสำหรับรายการที่ต้องตรวจสอบ
- [ ] ไม่ใส่ตัวเลขคงที่จาก mockup

ผ่านเมื่อ: ตัวเลขเปลี่ยนตามไฟล์ Excel ที่อัปโหลด

### Step 4 — ทำ Sheet List ด้านซ้าย

- [ ] render รายการจาก `reviewRows`
- [ ] แสดงชื่อชีต สถานะ จำนวนรายการ และจำนวนปัญหา
- [ ] คลิกรายการแล้วเรียก `setSelectedReviewKey(row.key)`
- [ ] ทำ selected state ให้มองเห็นชัดเจน
- [ ] แยกสีของ success, warning, error, unsupported, preserved และ skipped
- [ ] ใช้ `<button>` สำหรับรายการที่กดเลือกได้ เพื่อรองรับ keyboard

ผ่านเมื่อ: คลิกแต่ละชีตแล้ว selected state เปลี่ยนถูกต้อง

### Step 5 — ทำ Problem Details ด้านขวา

- [ ] แสดงชื่อจาก `selectedReviewRow.sheetName`
- [ ] กรอง `issues` ให้เหลือเฉพาะชีตที่เลือก
- [ ] แสดงจำนวน error และ warning
- [ ] แสดงสาเหตุหรือข้อความอธิบายเมื่อไม่มีข้อมูล
- [ ] รองรับกรณี `selectedReviewRow` เป็น `null`
- [ ] ไม่สมมติว่าปัญหาอยู่ที่แถวหรือคอลัมน์ใด หากข้อมูลจริงไม่ได้ระบุ

ผ่านเมื่อ: รายละเอียดด้านขวาเปลี่ยนตามชีตที่คลิก

### Step 6 — เชื่อม Preview และ Advanced Mapping เดิม

- [ ] ใช้ `SourcePreviewTable` แสดงข้อมูลของชีตที่เลือก
- [ ] ใช้ `MappingSummary` เดิมแทนการสร้าง mapping logic ใหม่
- [ ] ใช้ `advancedOpen` และ `setAdvancedOpen` เดิม
- [ ] รักษา `updateMapping`, `updateCellOverride` และ row exclusion handlers เดิม
- [ ] แสดงเครื่องมือแก้ไขเฉพาะชีตที่ระบบอนุญาตให้แก้

ผ่านเมื่อ: ผู้ใช้เปิด Advanced Mapping และแก้ mapping ได้เหมือน flow เดิม

### Step 7 — กำหนดพฤติกรรมปุ่มดำเนินการต่อ

- [ ] ใช้ `canContinue` และ `loading` เดิม
- [ ] disabled ปุ่มเมื่อไม่มีชีตที่พร้อมส่งออก
- [ ] แสดง loading label ระหว่าง validation
- [ ] ปุ่มย้อนกลับยังเรียก `onBack`
- [ ] ปุ่มดำเนินการต่อยังเรียก `onNext`
- [ ] อธิบายให้ผู้ใช้เข้าใจว่าทำไมปุ่มจึงถูก disabled

ผ่านเมื่อ: ปุ่มทำงานตามสถานะจริงและไม่ข้าม validation

### Step 8 — ปรับ CSS และ Responsive

- [ ] เพิ่ม class ใหม่ภายใต้กลุ่ม `review-` เพื่อไม่ชน style เก่า
- [ ] Desktop แสดง Sheet List และ Problem Details สองคอลัมน์
- [ ] Tablet/Mobile เปลี่ยนเป็นหนึ่งคอลัมน์
- [ ] ตารางที่กว้างเลื่อนแนวนอนได้
- [ ] ปุ่มมีความสูงอย่างน้อย 44px
- [ ] focus state มองเห็นได้เมื่อใช้ keyboard
- [ ] ตรวจ contrast ของข้อความและ status badge
- [ ] รองรับ `prefers-reduced-motion`

ผ่านเมื่อ: ใช้งานได้ที่ความกว้างประมาณ 1440px, 768px และ 375px

### Step 9 — ตรวจข้อความและ Empty States

- [ ] เลือกว่าจะใช้ภาษาไทยทั้งหมดหรือไทยร่วมกับอังกฤษอย่างสม่ำเสมอ
- [ ] มีข้อความเมื่อไม่มีชีต
- [ ] มีข้อความเมื่อชีตไม่มี issue
- [ ] มีข้อความสำหรับ unsupported, preserved และ skipped
- [ ] ข้อความบอกสิ่งที่ผู้ใช้ทำต่อได้ ไม่แสดงแค่ชื่อ error ทางเทคนิค

ผ่านเมื่อ: ทุกสถานะมีคำอธิบายและทางไปต่อที่ชัดเจน

### Step 10 — ตรวจงานก่อนถือว่าเสร็จ

- [ ] รัน `npm.cmd run typecheck --workspace frontend`
- [ ] เปิดหน้าเว็บจริงและตรวจว่าไม่มี console error
- [ ] ทดสอบไฟล์ที่ทุกชีตพร้อมใช้งาน
- [ ] ทดสอบไฟล์ที่มี warning/error
- [ ] ทดสอบชีต unsupported, preserved หรือ skipped ถ้ามี fixture
- [ ] ทดลองแก้ mapping แล้ว validation ใหม่
- [ ] ทดลองย้อนกลับไปเปลี่ยนไฟล์
- [ ] ทดลองไปหน้าดาวน์โหลดและสร้างไฟล์จริง
- [ ] ตรวจว่า Upload และ Download ไม่เสียจากการแก้ Review

ผ่านเมื่อ: typecheck ผ่าน และ flow จริงตั้งแต่อัปโหลดจนดาวน์โหลดทำงานครบ

## คำสั่งที่ใช้บ่อย

เริ่ม frontend และ backend:

```powershell
npm.cmd run dev
```

ตรวจ TypeScript ของ frontend:

```powershell
npm.cmd run typecheck --workspace frontend
```

ดูไฟล์ที่ถูกแก้:

```powershell
git status --short
```

ดู diff เฉพาะงาน Review:

```powershell
git diff -- frontend/app/components/PreviewStep.tsx frontend/app/components/ReviewShell.tsx frontend/app/globals.css
```

## วิธีทำงานร่วมกัน

1. ทำทีละ step จาก checklist
2. รัน typecheck หลังจบแต่ละ step
3. ส่งโค้ด ผลลัพธ์ หรือ error มาให้ตรวจ
4. ทำเครื่องหมาย `[x]` เมื่อทดสอบผ่านแล้ว ไม่ใช่แค่เขียนโค้ดเสร็จ
5. ถ้า flow เดิมเสีย ให้หยุดแก้และหาสาเหตุก่อนเริ่ม step ถัดไป
