import { Copy } from "lucide-react";
import { short } from "../../utils/format";

export default function InfoRow({ label, value, copy }) {
  return (
    <div className="infoRow">
      <span>{label}</span>
      <strong>{short(value)}</strong>
      {copy && (
        <button className="copyBtn">
          <Copy size={14} />
        </button>
      )}
    </div>
  );
}
