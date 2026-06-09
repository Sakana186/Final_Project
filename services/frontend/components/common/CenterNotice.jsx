export default function CenterNotice({ tone = "success", title, message, onClose }) {
  return (
    <div className="centerNoticeOverlay" onClick={onClose}>
      <div className={`centerNotice ${tone}`} onClick={(event) => event.stopPropagation()}>
        <strong>{title}</strong>
        <p>{message}</p>
        <button className="primaryBtn" onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}
