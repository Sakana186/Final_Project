export default function OperationOverlay({ phase, message }) {
  if (!phase) {
    return null;
  }

  const isSuccess = phase === "success";
  const isError = phase === "error";

  return (
    <div className="operationOverlay" role="status" aria-live="polite" aria-busy={!isSuccess && !isError}>
      <div className={`operationDialog ${isSuccess ? "success" : isError ? "error" : "pending"}`}>
        {isSuccess ? (
          <div className="operationSuccessMark" aria-hidden="true">
            <span />
          </div>
        ) : isError ? (
          <div className="operationErrorMark" aria-hidden="true">
            <span />
          </div>
        ) : (
          <div className="operationSpinner" aria-hidden="true" />
        )}
        <strong>
          {isSuccess ? "Xử lý yêu cầu thành công" : isError ? "Xử lý yêu cầu thất bại" : "Đang tiến hành"}
        </strong>
        {message ? <p>{message}</p> : null}
      </div>
    </div>
  );
}
