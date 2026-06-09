import { profiles } from "../../data/profiles";
import { menus } from "../../data/menus";

export default function RoleSelector({ role, onRoleChange }) {
  return (
    <div className="roleSwitcher">
      {Object.values(profiles).map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.role}
            className={`roleButton ${role === item.role ? "selected" : ""} ${item.color}`}
            onClick={() => onRoleChange(item.role, menus[item.role][0].id)}
          >
            <Icon size={17} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
