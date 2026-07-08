import type { ValidationIssue } from "@/lib/client-types";
import { displayIssueColumn, displayIssueMessage, issueSeverityLabel } from "./display";

interface IssueListProps {
  issues: ValidationIssue[];
  emptyText: string;
}

export function IssueList({ issues, emptyText }: IssueListProps) {
  if (!issues.length) {
    return (
      <div className="success-block inline">
        <div className="icon">✓</div>
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="issue-list">
      {issues.slice(0, 200).map((issue, idx) => (
        <div className={`issue-row ${issue.severity}`} key={idx}>
          <span className="tag">{issueSeverityLabel(issue.severity)}</span>
          <span>
            <strong>{issue.sheetName}</strong>{" "}
            {issue.rowIndex >= 0 ? `แถวที่ ${issue.rowIndex + 1}` : "ระดับชีต"}
            {issue.column ? ` · ${displayIssueColumn(issue.column)}` : ""}:{" "}
            {displayIssueMessage(issue.message)}
          </span>
        </div>
      ))}
    </div>
  );
}
