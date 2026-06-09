import { useEffect, useMemo, useState } from "react";
import {
  Users,
  ShieldCheck,
  FileText,
  Plus,
  History,
  Search,
  Ban,
  RefreshCw
} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import ActionNotice from "../../components/common/ActionNotice";
import CenterNotice from "../../components/common/CenterNotice";
import StatCard from "../../components/common/StatCard";
import InfoRow from "../../components/common/InfoRow";
import StatusList from "../../components/common/StatusList";

export function AdminOverview({ users, records, auditLogs, setPage, systemStatus, networkLabel }) {
  return (
    <>
      <Topbar role="ADMIN" networkLabel={networkLabel} />
      <section className="hero adminHero">
        <div>
          <h1>Mọi nỗ lực đều đáng trân trọng</h1>
          <button className="primaryBtn" onClick={() => setPage("user-management")}>Quản lý người dùng</button>
        </div>
      </section>

      <section className="statsGrid">
        <StatCard icon={Users} value={users.length} label="Người dùng đã đăng ký" />
        <StatCard icon={ShieldCheck} value={new Set(users.map((item) => item.role)).size} label="Vai trò hoạt động" />
        <StatCard icon={FileText} value={records.length} label="Metadata hồ sơ" />
        <StatCard icon={History} value={auditLogs.length} label="Lịch sử truy vết" />
      </section>

      <section className="dashboardGrid">
        <div className="card">
          <div className="cardHeader">
            <h3>Quản trị nhanh</h3>
          </div>
          <div className="quickGrid">
            <button onClick={() => setPage("user-management")}><Users size={24} /> Quản lý user</button>
            <button onClick={() => setPage("role-management")}><ShieldCheck size={24} /> Gán vai trò</button>
            <button onClick={() => setPage("audit")}><History size={24} /> Xem audit log</button>
          </div>
        </div>
        <div className="rightColumn">
          <StatusList rows={systemStatus} />
        </div>
      </section>
    </>
  );
}

export function UserManagement({ users, onAddUser, onToggleUserStatus }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [form, setForm] = useState({
    displayName: "",
    address: "",
    role: "PATIENT",
    attributes: ""
  });

  const filtered = useMemo(() => {
    return users.filter((u) =>
      `${u.name} ${u.role} ${u.address}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, users]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <section className="pagePanel">
      <div className="accessHeader">
        <div>
          <h2>Quản lý người dùng</h2>
        </div>
      </div>

      {error ? <ActionNotice tone="error">{error}</ActionNotice> : null}
      {notice ? (
        <CenterNotice
          tone={notice.tone}
          title={notice.title}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      ) : null}

      <div className="formGrid">
        <div className="card formCard">
          <h3>Đăng ký user mới</h3>
          <label>Tên hiển thị</label>
          <input value={form.displayName} onChange={(event) => update("displayName", event.target.value)} placeholder="Ví dụ: Nguyen Van A" />
          <label>Địa chỉ ví</label>
          <input value={form.address} onChange={(event) => update("address", event.target.value)} placeholder="0x..." />
          <label>Vai trò</label>
          <select value={form.role} onChange={(event) => update("role", event.target.value)}>
            <option value="PATIENT">PATIENT</option>
            <option value="DOCTOR">DOCTOR</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <label>Attribute thô</label>
          <input
            value={form.attributes}
            onChange={(event) => update("attributes", event.target.value)}
            placeholder="Ví dụ: department:cardiology"
          />
          <button
            className="primaryBtn wide"
            onClick={async () => {
              try {
                const response = await onAddUser(form);
                setNotice({
                  tone: "success",
                  title: "Đăng ký thành công",
                  message: response.message,
                });
                setForm({
                  displayName: "",
                  address: "",
                  role: "PATIENT",
                  attributes: ""
                });
              } catch (addError) {
                setNotice({
                  tone: "error",
                  title: "Đăng ký thất bại",
                  message: addError.message,
                });
              }
            }}
          >
            <Plus size={16} /> Đăng ký user
          </button>
        </div>

        <div className="card tableCard">
          <div className="searchBox">
            <Search size={18} />
            <input placeholder="Tìm theo tên, role hoặc address..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {filtered.length === 0 ? <ActionNotice>Chưa có user nào được đăng ký.</ActionNotice> : null}
          <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>Người dùng</th>
                <th>Address</th>
                <th>Role</th>
                <th>Trạng thái</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.address}>
                  <td>
                    <div className="person">
                      <div className="miniAvatar">{user.name.slice(0, 2)}</div>
                      <span>{user.name}</span>
                    </div>
                  </td>
                  <td>{user.address.length > 18 ? `${user.address.slice(0, 8)}...${user.address.slice(-6)}` : user.address}</td>
                  <td><span className={`roleTag ${user.role.toLowerCase()}`}>{user.role}</span></td>
                  <td><span className={`pill ${user.status === "Disabled" ? "danger" : ""}`}>{user.status}</span></td>
                  <td>
                    <button
                      className="iconBtn"
                      onClick={async () => {
                        try {
                          const response = await onToggleUserStatus(user.address);
                          setNotice({
                            tone: "success",
                            title: "Cập nhật thành công",
                            message: response.message,
                          });
                        } catch (toggleError) {
                          setError(toggleError.message);
                        }
                      }}
                    >
                      {user.status === "Active" ? <Ban size={15} /> : <RefreshCw size={15} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </section>
  );
}

export function RoleManagement({ users, onAssignRole }) {
  const [selected, setSelected] = useState(users[0]?.address || "");
  const [newRole, setNewRole] = useState("PATIENT");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selected && users[0]?.address) {
      setSelected(users[0].address);
    }
  }, [selected, users]);

  const selectedUser = users.find((user) => user.address === selected);

  async function assignRole() {
    try {
      const response = await onAssignRole(selected, newRole);
      setMessage(response.message);
    } catch (assignError) {
      setError(assignError.message);
    }
  }

  return (
    <section className="pagePanel">
      <h2>Gán vai trò</h2>
      {message ? <ActionNotice tone="success">{message}</ActionNotice> : null}
      {error ? <ActionNotice tone="error">{error}</ActionNotice> : null}
      {users.length === 0 ? <ActionNotice>Hãy đăng ký user trước khi gán role.</ActionNotice> : null}
      <div className="formGrid">
        <div className="card formCard">
          <label>Chọn người dùng</label>
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {users.map((u) => (
              <option key={u.address} value={u.address}>
                {u.name} - {u.role}
              </option>
            ))}
          </select>

          <label>Vai trò mới</label>
          <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
            <option value="PATIENT">PATIENT</option>
            <option value="DOCTOR">DOCTOR</option>
            <option value="ADMIN">ADMIN</option>
          </select>

          <button className="primaryBtn wide" onClick={assignRole}>Gán vai trò on-chain</button>
        </div>

        <div className="card processCard">
          <h3>Vai trò trong hệ thống</h3>
          {selectedUser ? (
            <div className="roleSummary">
              <span className={`roleTag ${selectedUser.role.toLowerCase()}`}>{selectedUser.role}</span>
              <strong>{selectedUser.name}</strong>
              <p>{selectedUser.address}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
