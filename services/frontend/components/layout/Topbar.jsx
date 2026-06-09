import { Activity } from "lucide-react";
import { profiles } from "../../data/profiles";

export default function Topbar({ role, networkLabel = "N/A" }) {
  const profile = profiles[role];
  const Icon = profile.icon;

  return (
    <header className="topbar">
      <div>
        <h2>{profile.label} Dashboard</h2>
      </div>
      <div className="topActions">
        <button className={`network ${profile.color}`}>
          <Icon size={16} />
          {profile.role}
        </button>
        <button className="network">
          <Activity size={16} />
          {networkLabel}
        </button>
      </div>
    </header>
  );
}
