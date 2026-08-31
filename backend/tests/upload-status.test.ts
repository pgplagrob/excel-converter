import assert from "node:assert/strict";
import test from "node:test";
import {
  getUploadStatus,
  markUploadError,
  markUploadProcessing,
  markUploadSuccess,
  resetUploadStatus,
} from "../lib/upload-status";

test("upload status follows the idle, processing, success flow", () => {
  assert.equal(resetUploadStatus().state, "idle");

  const receiving = markUploadProcessing();
  assert.equal(receiving.state, "processing");
  assert.equal(receiving.fileName, null);

  const processing = markUploadProcessing("example.xlsx");
  assert.equal(processing.state, "processing");
  assert.equal(processing.fileName, "example.xlsx");

  const success = markUploadSuccess("example.xlsx");
  assert.equal(success.state, "success");
  assert.equal(success.fileName, "example.xlsx");
  assert.deepEqual(getUploadStatus(), success);
});

test("upload status records the latest processing error", () => {
  resetUploadStatus();
  const failed = markUploadError("broken.xlsx", "อ่านไฟล์ไม่ได้");

  assert.equal(failed.state, "error");
  assert.equal(failed.fileName, "broken.xlsx");
  assert.equal(failed.message, "อ่านไฟล์ไม่ได้");
});
