import { Fingerprint } from "lucide-react";
import ActionNotice from "../common/ActionNotice";

export default function AuditTimeline({ events = [], scopeLabel = "" }) {
  return (
    <section className="pagePanel">
      <h2>Lịch sử truy vết</h2>
      {scopeLabel ? <p className="auditScope">{scopeLabel}</p> : null}
      <div className="card auditCard">
        {events.length === 0 ? <ActionNotice>Chưa có hoạt động nào trong phạm vi truy vết hiện tại.</ActionNotice> : null}
        {events.map((event) => (
          <div className="auditItem" key={event.id || `${event.event}-${event.time}`}>
            <div className="auditDot">
              <Fingerprint size={18} />
            </div>
            <div>
              <strong>{event.event}</strong>
              <p>{event.description}</p>
              {event.actorName ? <span className="auditActor">{event.actorName}{event.actorRole ? ` · ${event.actorRole}` : ""}</span> : null}
              <small>{event.time}</small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
