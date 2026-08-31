export type UploadState = "idle" | "processing" | "success" | "error";

export interface UploadStatus {
  state: UploadState;
  fileName: string | null;
  message: string;
  updatedAt: string;
}

const UPLOAD_STATUS_VERSION = 1;

declare global {
  var __excelConverterUploadStatus: UploadStatus | undefined;
  var __excelConverterUploadStatusVersion: number | undefined;
}

function createIdleStatus(): UploadStatus {
  return {
    state: "idle",
    fileName: null,
    message: "ยังไม่ได้รับไฟล์",
    updatedAt: new Date().toISOString(),
  };
}

if (globalThis.__excelConverterUploadStatusVersion !== UPLOAD_STATUS_VERSION) {
  globalThis.__excelConverterUploadStatus = createIdleStatus();
  globalThis.__excelConverterUploadStatusVersion = UPLOAD_STATUS_VERSION;
} else if (!globalThis.__excelConverterUploadStatus) {
  globalThis.__excelConverterUploadStatus = createIdleStatus();
}

function setUploadStatus(status: Omit<UploadStatus, "updatedAt">): UploadStatus {
  const nextStatus: UploadStatus = {
    ...status,
    updatedAt: new Date().toISOString(),
  };
  globalThis.__excelConverterUploadStatus = nextStatus;
  return nextStatus;
}

export function getUploadStatus(): UploadStatus {
  return { ...(globalThis.__excelConverterUploadStatus ?? createIdleStatus()) };
}

export function markUploadProcessing(fileName: string | null = null): UploadStatus {
  return setUploadStatus({
    state: "processing",
    fileName,
    message: fileName ? "กำลังประมวลผลไฟล์" : "กำลังรับไฟล์",
  });
}

export function markUploadSuccess(fileName: string): UploadStatus {
  return setUploadStatus({
    state: "success",
    fileName,
    message: "ประมวลผลเสร็จแล้ว",
  });
}

export function markUploadError(fileName: string | null, message: string): UploadStatus {
  return setUploadStatus({
    state: "error",
    fileName,
    message,
  });
}

export function resetUploadStatus(): UploadStatus {
  const status = createIdleStatus();
  globalThis.__excelConverterUploadStatus = status;
  return { ...status };
}
