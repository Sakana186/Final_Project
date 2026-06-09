import Sidebar from "./Sidebar";

export default function AppShell({ role, onRoleChange, page, setPage, actors, session, onLogout, children }) {
  return (
    <div className="appShell">
      <Sidebar
        role={role}
        onRoleChange={onRoleChange}
        page={page}
        setPage={setPage}
        actors={actors}
        session={session}
        onLogout={onLogout}
      />
      <main className="mainContent">{children}</main>
    </div>
  );
}
