# Download UX/UI Implementation Guide

Status: **Ready for Desktop structure only**

Use this document when redesigning the final Download page. The supplied `Download - Ready` HTML is the primary Desktop structure and visual reference. Recreate that HTML composition in the current React application, then connect it to live data. It does not authorize unrelated changes to Review, Advanced Mapping, Settings, or the workbook format.

The product rules in [`ADVANCED_MAPPING_UX.md`](./ADVANCED_MAPPING_UX.md) remain authoritative. If this guide and that document disagree, follow `ADVANCED_MAPPING_UX.md`.

## Outcome

The final step must answer these questions without making the user inspect raw validation output:

1. Is the selected batch ready to download?
2. Which source file and sheets will be included?
3. How many asset rows will be exported?
4. Are there warnings that do not block download?
5. What can the user do next?

The page should feel like a calm completion screen. The first implementation round covers only the Desktop structure and live ready-state content.

## Current scope

Implement only the Desktop structure at viewport widths of `1024px` and above:

- fixed left sidebar from the supplied HTML;
- Desktop top bar inside the main content area;
- three-step horizontal progress indicator;
- final-step heading;
- primary action card matching the supplied HTML hierarchy;
- export preview card below the action card;
- sticky summary sidebar on the right;
- live values already available from the current Download props;
- existing actions and download behavior placed into the new structure.

Keep the current mobile rendering usable, but do not redesign or certify it in this round. State-contract changes, accessibility QA, and backend enforcement are deferred.

## Reference interpretation

The supplied HTML is the primary Desktop reference for:

- the fixed `w-64` left sidebar and active Download navigation item;
- the main content offset beside the sidebar;
- the Desktop top bar;
- the three-step progress line and step markers;
- a clear final-step heading;
- a prominent download action card;
- a compact export preview;
- a summary card on the right;
- a two-column Desktop layout;
- restrained indigo, neutral surfaces, status color, rounded cards, and light shadow.

Implementation translation rules:

- Preserve the supplied HTML section order and Desktop proportions.
- Convert its static HTML/Tailwind structure into React JSX and project CSS. Do not embed the Tailwind CDN script in the Next.js page.
- Reproduce the Material Symbols visually with a project-safe icon approach. Do not depend on the mock remote avatar image; use a neutral placeholder or omit only the image content while preserving its space.
- Use Thai interface copy and the existing Thai-capable font stack.
- Replace every mock filename, sheet count, row count, table row, category, and status with live Parse/Validate data.
- Treat the reference as a ready-state composition, not as the only state the real page needs.

Do not reinterpret the Desktop page into the old application panel layout. The supplied HTML shell and bento composition control this Desktop round.

## Current baseline to re-check before editing

Inspect these files at the start of every implementation slice:

- `frontend/app/components/DownloadStep.tsx`
- `frontend/app/page.tsx`
- `frontend/app/globals.css`
- `frontend/lib/client-types.ts`
- `frontend/lib/sheet-selection.ts`
- `backend/app/api/v1/export/route.ts`
- [`ADVANCED_MAPPING_UX.md`](./ADVANCED_MAPPING_UX.md)

As of this document, the current implementation has these important behaviors:

- `page.tsx` has three steps: Upload, Preview/Mapping/Validate, and Export.
- `DownloadStep.tsx` labels itself `Step 4`; this must become the final third step.
- Validate supplies `issues`, `issueSummary`, `sheetSummaries`, and `transformedSheets`.
- `transformedSheets[].sampleRows` contains up to five live output rows for preview.
- The current Download page independently filters out sheets with errors and opens another sheet-selection dialog.
- The current backend may build a workbook from only the sheets without errors. Do not describe a partially exported batch as the originally validated batch.

Reinspection is required because this baseline can change.

## Product rules

### Selected batch

The sheets selected in Review form the validated batch. The Download page summarizes that batch; it does not silently replace it with only the passing sheets.

- If every selected data sheet has zero Errors, the batch is ready.
- Warnings remain visible but do not block download.
- If any selected data sheet has an Error, the whole batch is blocked.
- The recovery action is `กลับไปตรวจสอบและแก้ไข` or `กลับไปเปลี่ยนชีตที่เลือก`.
- A different subset must be an explicit user decision and must be validated as that subset before download.

Do not derive the displayed batch only from `availableSheets`, because that hides failed sheets. Pass the validated selection and `validatedSheetSummaries` from `page.tsx` into the Download UI, or introduce an equally explicit typed view model.

### Counts

Every count must have one meaning:

- `ชีตที่จะส่งออก`: selected, freshly validated data sheets included in this batch.
- `จำนวนรายการ`: sum of the row counts for those selected data sheets.
- `คำเตือน`: warning issues for the same selected batch.
- `ข้อผิดพลาด`: error issues for the same selected batch.

Do not label parse-time rows, preserved sheets, skipped sheets, or mock values as exported asset rows. If a summary sheet will be attached unchanged, describe it separately as an attachment rather than adding it to the asset-sheet count.

### Preview

- Preview only live `transformedSheets[].sampleRows` returned by the latest validation.
- Keep the current sheet selector when the batch has multiple transformed sheets.
- Show the active sheet name and `แสดง N จากทั้งหมด M รายการ`.
- Preserve all runtime output columns; do not hard-code the four columns from the HTML reference.
- Horizontal table scrolling is acceptable. The surrounding page must not overflow horizontally.
- Empty preview data needs an explicit empty state rather than a blank card.

### Validation freshness

The Download page represents the latest completed validation only. If mapping, selection, header range, cell overrides, or exclusions change, return to Review and mark the prior result stale. A stale result must never show `ไฟล์ของคุณพร้อมแล้ว` or enable Download.

## Future page states — reference only

The states below describe the intended later behavior. They are not part of the Desktop-structure implementation round unless the current UI already provides them without contract changes.

### 1. Ready, no warnings

- Eyebrow: `ขั้นตอนที่ 3 จาก 3`
- Heading: `ไฟล์ของคุณพร้อมดาวน์โหลด`
- Supporting copy: `ระบบตรวจสอบและจัดรูปแบบข้อมูลเรียบร้อยแล้ว`
- Status treatment: green/teal success icon and `พร้อมดาวน์โหลด`
- Primary action: `ดาวน์โหลดไฟล์ .xlsx`
- Secondary actions: `กลับไปตรวจสอบข้อมูล` and `แปลงไฟล์อื่น`

The primary action downloads the already selected and validated batch. It must not open a second selector unless the product intentionally keeps sheet selection at this step.

### 2. Ready with warnings

- Heading remains `ไฟล์ของคุณพร้อมดาวน์โหลด`.
- Status treatment uses amber and says `พร้อมดาวน์โหลด โดยมีคำเตือน`.
- Show the warning count near the status.
- Provide a compact disclosure for warning details; warnings must not visually compete with the primary action.
- Keep Download enabled.

### 3. Blocked by errors

- Heading: `ยังดาวน์โหลดไม่ได้`
- Supporting copy: `พบข้อมูลที่ต้องแก้ไขในชีตที่เลือก`
- Status treatment uses the error color and the real error count.
- Primary recovery action: `กลับไปตรวจสอบและแก้ไข`.
- Download is disabled or absent.
- Show affected sheet names and concise issue summaries. Avoid rendering 200 ungrouped rows as the main page hierarchy.
- Never show a success icon or ready copy in this state.

### 4. Downloading

- Keep the layout stable.
- Disable actions that can submit or reset the flow.
- Button copy: `กำลังสร้างไฟล์...`.
- Expose progress with `aria-live="polite"` or an equivalent accessible status.

### 5. Download request failed

- Keep the validated summary and preview visible.
- Show the server error in the existing page error region.
- Restore the primary action as `ลองดาวน์โหลดอีกครั้ง`.
- Do not reset the uploaded file or validation state automatically.

The browser starting a file download is not proof that the user saved or opened it. Avoid a permanent `ดาวน์โหลดสำเร็จ` claim unless the application has evidence for that claim.

## Information architecture

Desktop uses an 8/4-style grid at `1024px` and above.

```text
ขั้นตอนที่ 3 จาก 3
ไฟล์ของคุณพร้อมดาวน์โหลด / ยังดาวน์โหลดไม่ได้
คำอธิบายสถานะ

┌─────────────────────────────────────┬──────────────────────┐
│ Action card                         │ สรุปไฟล์             │
│ status icon                         │ ไฟล์ต้นฉบับ          │
│ primary download/recovery action    │ ชีตที่จะส่งออก       │
│ back + reset actions                │ จำนวนรายการ          │
│                                     │ warning/error status │
├─────────────────────────────────────┤                      │
│ ตัวอย่างข้อมูลที่จะส่งออก           │                      │
│ sheet selector + live preview table │                      │
└─────────────────────────────────────┴──────────────────────┘
```

The full Desktop shell follows the supplied HTML:

```text
┌────────────── fixed sidebar ──────────────┬──────── main content ────────┐
│ Excel Converter                           │ Desktop top bar               │
│ 3-Step Process                            │ 3-step progress               │
│                                           │                               │
│ อัปโหลด                                   │ heading                       │
│ ตรวจสอบ                                   │ ┌──────────────┬────────────┐ │
│ ดาวน์โหลด  ← active                       │ │ action       │ summary    │ │
│                                           │ │ preview      │ sticky     │ │
│ ตั้งค่าเทมเพลต                            │ └──────────────┴────────────┘ │
│ ช่วยเหลือ                                 │                               │
└───────────────────────────────────────────┴───────────────────────────────┘
```

For a blocked state, place the affected-sheet summary below the action card and above the preview. The preview may remain available for diagnosis.

## Component and data contract

Prefer a small view model over repeated filtering inside JSX. The exact names may change, but the UI needs these derived values:

```ts
interface DownloadViewModel {
  sourceFileName: string;
  selectedSheetNames: string[];
  selectedSheetCount: number;
  exportedRowCount: number;
  errorCount: number;
  warningCount: number;
  blockedSheetNames: string[];
  isReady: boolean;
}
```

Derive it from the current sheet selection plus the latest validation response. Keep one source of truth for readiness and reuse it for heading, status, button availability, and summary copy.

Suggested component boundaries inside `DownloadStep.tsx`:

- `DownloadHeroCard`: status, primary action, back, and reset.
- `DownloadSummaryCard`: filename, selected sheets, rows, and validation status.
- `DownloadPreview`: existing selector and live transformed table.
- `DownloadIssuesSummary`: grouped recovery information for warnings/errors.

Extract these only when it makes the main component easier to understand; they may remain local to the same file initially.

## Visual rules

- Scope new selectors under a Download root such as `.download-page` to avoid changing Upload, Review, or Settings.
- Use existing tokens: `--paper`, `--paper-2`, `--ink`, `--ink-soft`, `--line`, `--indigo`, `--teal`, `--ok`, `--error`, and their soft variants.
- Use indigo for the primary action, teal/green only for genuinely ready status, amber for warnings, and red only for blocking errors.
- Cards use a subtle border and shadow. Motion is optional and must not be required to understand state.
- Primary controls have a minimum 44px target height.
- Avoid inline styles; add scoped classes in `globals.css`.
- Respect `prefers-reduced-motion` for new decorative movement.

## Baseline semantics for this round

- Use one page `h2` within the existing application `h1`; card titles follow as `h3`.
- The visible heading, status icon, and status text must communicate the same state.
- Decorative icons are hidden from assistive technology; meaningful icons have an accessible name through adjacent text.
- Native buttons remain native buttons. Focus indicators must remain visible.
- The preview selector has a persistent visible label.
- The preview table retains semantic `table`, `thead`, `tbody`, and header cells.
- Error and warning information is not conveyed by color alone.
- Preserve native buttons, labels, table semantics, and visible focus behavior while rearranging the Desktop structure.

## Desktop implementation slice

Complete this slice, verify it, report results, and stop.

Scope:

- Add a Download-specific root and an 8/4 two-column layout for widths of `1024px` and above.
- Recreate the supplied Desktop sidebar, top bar, progress indicator, hero action card, live summary card, and preview composition.
- Correct `Step 4` to `ขั้นตอนที่ 3 จาก 3`.
- Replace mock/reference values with current props and derived live values.
- Preserve the current download API and preview behavior.
- Preserve existing warning, error, loading, dialog, Back, and Reset behavior. Repositioning is allowed; redesigning their contracts is outside this slice.
- Do not edit backend files in this slice.

Completion gate:

- No hard-coded filename, sheet count, row count, or preview row exists in production JSX.
- At Desktop widths, the action/preview area and summary sidebar form the specified 8/4 hierarchy.
- Sidebar, top bar, progress indicator, action card, preview card, and sticky summary appear in the same order and relative placement as the supplied HTML.
- The summary sidebar remains visually stable beside long filenames and a wide preview table.
- `npm.cmd run typecheck --workspace frontend` passes.
- Inspect the actual ready page at `1440px` and `1024px` with a real workbook.

Stop after reporting changed files, Desktop screenshots/observations, checks, and untested cases.

## Deferred after Desktop structure

- Mobile and tablet responsive redesign.
- Ready-with-warning, blocked, stale, loading, and request-failure state redesign.
- Passing validated selection and `validatedSheetSummaries` into a new Download view model.
- Removing or redesigning the second sheet-selection dialog.
- Frontend and backend enforcement that blocks partial export when a selected sheet has Errors.
- Full keyboard, focus management, screen-reader, and reduced-motion QA.
- Complete browser flow and downloaded-workbook inspection.

These items require a separate approval and implementation slice. Do not start them while implementing Desktop structure.

## Acceptance checklist

- [ ] Final progress label says step 3 of 3.
- [ ] Desktop includes the supplied fixed sidebar and active Download item.
- [ ] Desktop includes the supplied top bar and horizontal three-step progress indicator.
- [ ] Action card, Preview card, and sticky Summary card follow the supplied HTML composition.
- [ ] The source filename is live and wraps safely.
- [ ] Sheet and row counts describe the actual batch.
- [ ] Preview uses live transformed rows and runtime columns.
- [ ] Download, Back, and Reset actions have distinct visual priority.
- [ ] Desktop at `1440px` and `1024px` matches the 8/4 information hierarchy.
- [ ] Existing warning, error, loading, dialog, Back, Reset, and Download behavior remains intact.
- [ ] Frontend typecheck passes; visual browser inspection is still required.

## Prompt for the implementing agent

```text
Implement only the Desktop structure slice from Scope of Work/DOWNLOAD_UX_IMPLEMENTATION.md.

First inspect the current Git status, the supplied Download HTML, and the frontend baseline files named in the document. Preserve unrelated user changes. Treat Scope of Work/ADVANCED_MAPPING_UX.md as the product-rule source of truth and the supplied Download HTML as the primary Desktop structure and visual reference. Recreate its sidebar, top bar, progress indicator, action card, preview, and summary composition in React/CSS. Use live Parse/Validate state, keep runtime template columns, and do not introduce mock values or a Tailwind CDN script.

Build the 8/4 Desktop layout at `1024px` and above, inspect it at `1440px` and `1024px`, run the Desktop completion gate, report Passed / Failed / Not tested separately, and stop. Do not redesign mobile, state contracts, accessibility behavior, the export dialog, or backend behavior in this slice.
```
