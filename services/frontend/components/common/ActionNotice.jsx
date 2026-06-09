export default function ActionNotice({ tone = "info", children }) {
  return <div className={`actionNotice ${tone}`}>{children}</div>;
}
