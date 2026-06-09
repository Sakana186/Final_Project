import { Box } from "lucide-react";

export default function StatusList({ rows = [] }) {
  const issues = rows
    .filter(([, state]) => String(state || "").trim().toUpperCase() !== "OK")
    .map(([, state]) => state);
  const allGood = issues.length === 0;
  const summary = allGood ? "Tốt" : String(issues[0]).replace(/^ERROR:\s*/i, "");

  return (
    <div className="card">
      <div className="cardHeader">
        <h3>Tình trạng hệ thống</h3>
      </div>
      <div className="statusSummary">
        <div className="statusSummaryIcon">
          <Box size={18} />
        </div>
        <strong className={allGood ? "ok" : "issue"}>{summary}</strong>
      </div>
    </div>
  );
}
