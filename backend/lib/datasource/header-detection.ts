import { getAllKeywords } from "../mapping";
import { cellText, normalizeForScore } from "./text";

const ALL_KEYWORDS: string[] = getAllKeywords();

function scoreRowAsHeader(row: any[]): number {
  let score = 0;
  for (const cell of row) {
    const text = normalizeForScore(cellText(cell));
    if (!text || text.length < 2) continue;
    if (
      text.length >= 4 &&
      ALL_KEYWORDS.some((kw) => kw.length >= 4 && (text.includes(kw) || kw.includes(text)))
    ) {
      score += 5;
    } else {
      score += 0.2;
    }
  }
  return score;
}

export function detectHeaderRow(matrix: any[][]): number {
  const scanLimit = Math.min(matrix.length, 15);
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < scanLimit; i += 1) {
    const score = scoreRowAsHeader(matrix[i] || []);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestIdx;
}
