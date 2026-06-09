import { LogOut, ShieldPlus, Wallet } from "lucide-react";
import { profiles } from "../../data/profiles";
import { menus } from "../../data/menus";
import { short } from "../../utils/format";
import RoleSelector from "./RoleSelector";

export default function Sidebar({ role, onRoleChange, page, setPage, actors = {}, session, onLogout }) {
  const profile = profiles[role];
  const items = menus[role];
  const actor = actors[role] || {};
  const activePage = page === "patient-record-detail" ? "my-records" : page;
  const isProtectedRole = role === "PATIENT" || role === "DOCTOR" || role === "ADMIN";
  const hasMatchingSession = session?.role === role;
  const showSessionCard = hasMatchingSession;

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brandIcon">
          <ShieldPlus size={28} />
        </div>
        <div>
          <h1>MedChain EHR</h1>
          <p>Blockchain · IPFS · ABE</p>
        </div>
      </div>

      <RoleSelector role={role} onRoleChange={onRoleChange} />

      <nav>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`navItem ${activePage === item.id ? "active" : ""}`}
              onClick={() => setPage(item.id)}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {showSessionCard ? (
        <>
          <div className="profileCard">
            <div className={`avatar ${profile.color}`}>{profile.avatar}</div>
            <div>
              <strong>{actor.name || profile.label}</strong>
              <p>{profile.desc}</p>
            </div>
          </div>

          <div className="walletBox">
            <Wallet size={15} />
            <span>{actor.address ? short(actor.address) : "Chưa cấu hình ví"}</span>
          </div>
        </>
      ) : null}

      {isProtectedRole && hasMatchingSession ? (
        <button className="ghostBtn logoutBtn" onClick={onLogout}>
          <LogOut size={16} /> Đăng xuất
        </button>
      ) : null}
    </aside>
  );
}
