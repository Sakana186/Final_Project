export default function StatCard({ icon, value, label, sub }) {
  const Icon = icon;

  return (
    <div className="statCard">
      <div className="statIcon">
        <Icon size={28} />
      </div>
      <div>
        <h3>{value}</h3>
        <p>{label}</p>
        {sub ? <small>{sub}</small> : null}
      </div>
    </div>
  );
}
