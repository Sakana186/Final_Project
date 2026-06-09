import { AlertTriangle } from "lucide-react";

export default function EmptyState({ title }) {
  return (
    <section className="pagePanel">
      <div className="emptyState">
        <AlertTriangle size={44} />
        <h2>{title}</h2>
      </div>
    </section>
  );
}
