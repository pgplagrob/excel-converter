# Template Mapping Report

| Template Column | Source Column | Status | Note |
|---|---|---|---|
| RFID/QR CODE | - | Missing Source | Not confirmed in the provided source workbook. |
| รหัสสินทรัพย์ Elaas | - | Missing Source | No confirmed source column yet. |
| รหัสสินทรัพย์ | รหัสสินทรัพย์ / รหัสครุภัณฑ์ / รหัสพัสดุ / เลขครุภัณฑ์ | OK | Required after transform. |
| รหัสสินทรัพย์ (ส่วนประกอบ) | - | Missing Source | No confirmed source column yet. |
| ชื่อสินทรัพย์ | sourceAssetName | Need Transform | Filled from carried-forward asset group header, for example `เครื่องทำลายเอกสาร (470)`. |
| รายละเอียด | รายละเอียดสินทรัพย์ / รายละเอียดครุภัณฑ์ | OK | Source column depends on sheet pattern. |
| ระบุอื่น ๆ | หมายเหตุ / อื่นๆ | Ambiguous | Only map when the source header exists. |
| ประเภทสินทรัพย์ | ประเภท / ประเภทครุภัณฑ์ | Ambiguous | Not confirmed in the source workbook. |
| ชนิดสินทรัพย์ | *ชนิดสินทรัพย์ / ชนิดสินทรัพย์ / หมวดสินทรัพย์ | OK | Also used to detect asset group headers. |
| รายการสินทรัพย์ | - | Missing Source | Keep blank unless a real source column exists. |
| หน่วยนับ | หน่วย / หน่วยนับ | OK | Alias based. |
| อาคาร | สถานที่ตั้ง / สถานที่ใช้งาน / หน่วยงาน | Ambiguous | May be better mapped to `สำนัก` depending on template use. |
| ห้อง | ห้อง / ห้องที่ตั้ง | Missing Source | No confirmed source column yet. |
| ได้มาโดย | *ได้มาโดย / วิธีได้มา | OK | Alias based. |
| ได้มาจาก | ผู้ขาย / supplier / ได้มาจาก | Missing Source | No confirmed source column yet. |
| แหล่งงบประมาณ | งบประมาณ / แหล่งที่มา | Ambiguous | Needs workbook confirmation. |
| มูลค่า | *ราคาสินทรัพย์ (ราคาทุน) (บาท) / ราคาที่ได้มา | OK | Validated as numeric after transform. |
| วันที่ได้รับ | วันที่ได้มา + next date-part columns | Need Transform | Combines day/month/year when the workbook splits date parts. |
| วันที่ได้รับโอน | วันโอน / วัน เดือน ปีที่โอน | Missing Source | No confirmed source column yet. |
| วันที่ออกจำหน่าย | วันจำหน่าย | Missing Source | No confirmed source column yet. |
| วันที่เริ่มรับประกัน | วันเริ่มประกัน | Missing Source | No confirmed source column yet. |
| วันที่หมดประกัน | วันหมดประกัน / วันสิ้นสุดประกัน | Missing Source | No confirmed source column yet. |
| อายุการรับประกัน | ระยะเวลาประกัน | Missing Source | No confirmed source column yet. |
| อายุการใช้งาน | อายุใช้งาน | Missing Source | No confirmed source column yet. |
| ผู้ถือครอง | ผู้ครอบครอง / ผู้ดูแล | Missing Source | No confirmed source column yet. |
| สำนัก | สำนักงาน / สถานที่ตั้ง | Ambiguous | User requested location may map here; confirm with template. |
| ฝ่าย | division / department | Missing Source | No confirmed source column yet. |
| งาน | - | Missing Source | Exact-only to avoid false matches. |
| งานที่รับผิดชอบ | งานที่รับผิดชอบ / ผู้รับผิดชอบ | OK | Alias based. |
| สถานะ | สภาพ / สภาพครุภัณฑ์ | OK | Currently optional because some source files may omit it. |
| ต้องตรวจนับ | ตรวจนับ | Missing Source | No confirmed source column yet. |
| คิดค่าเสื่อม | ค่าเสื่อม | Missing Source | No confirmed source column yet. |
| ของสำคัญ | สำคัญ | Missing Source | No confirmed source column yet. |
| ค่าเสื่อมสะสมยกมา | ค่าเสื่อมยกมา | Missing Source | Validated as numeric if present. |
| ณ วันที่ (ค่าเสื่อมยกมา) | ณ วันที่ | Missing Source | Validated as date if present. |
| ส่งคืนสินทรัพย์ | คืนสินทรัพย์ | Missing Source | No confirmed source column yet. |
| เงินงบประมาณ | เงินงบ | Missing Source | No confirmed source column yet. |
| เงินสะสม/เงินทุนสำรองเงินสะสม | เงินสะสม / เงินทุนสำรองเงินสะสม | Missing Source | No confirmed source column yet. |
| เงินอุดหนุนระบุวัตถุประสงค์/เฉพาะกิจ | เงินอุดหนุน / เฉพาะกิจ | Missing Source | No confirmed source column yet. |
| เงินรับฝาก | deposit fund | Missing Source | No confirmed source column yet. |
| รับโอน/รับบริจาค | รับโอน / รับบริจาค / donation | Missing Source | No confirmed source column yet. |
| เงินกู้ | loan fund | Missing Source | No confirmed source column yet. |
| รายได้สะสม | accumulated income | Missing Source | No confirmed source column yet. |
| ทุนดำเนินการ | operating capital | Missing Source | No confirmed source column yet. |
