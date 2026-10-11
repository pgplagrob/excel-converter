# Python workbook extractor

The backend prefers this extractor for `.xlsx` uploads. It emits structured
JSON while TypeScript continues to own profile detection, mapping, review,
validation, and export.

## Setup

```powershell
python -m pip install -r backend/python/requirements.txt
```

If Python is not on `PATH`, set the executable explicitly before starting the
backend:

```powershell
$env:PYTHON_EXECUTABLE = "C:\Python312\python.exe"
npm.cmd run dev
```

The adapter forces UTF-8 for the Python process, so Thai sheet names and cell
values do not require `PYTHONUTF8` to be configured in the terminal.

`WORKBOOK_EXTRACTOR` controls selection:

- `auto` (default): prefer Python and fall back to the TypeScript reader when
  Python or `openpyxl` is unavailable.
- `python`: require Python and fail with a clear error if it is unavailable.
- `typescript`: use the previous TypeScript reader.

The process accepts workbook bytes on stdin and writes one JSON document to
stdout. Diagnostic messages belong on stderr so they cannot corrupt the JSON.


.xlsx
  -> Python + openpyxl
  -> Structured JSON
  -> TypeScript datasource
  -> mapping
  -> review / validation
  -> export

.xls
  -> SheetJS เดิม