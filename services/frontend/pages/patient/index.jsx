import { useEffect, useMemo, useState } from "react";
import { FileText, KeyRound, Bell, History, Ban, RotateCcw, ArrowLeft } from "lucide-react";
import ActionNotice from "../../components/common/ActionNotice";
import Topbar from "../../components/layout/Topbar";
import StatCard from "../../components/common/StatCard";
import InfoRow from "../../components/common/InfoRow";
import StatusList from "../../components/common/StatusList";

export function PatientOverview({ records, setPage, permissions, requests, auditLogs, systemStatus, networkLabel }) {
  const activePermissions = permissions.filter((item) => item.status === "Đang hiệu lực");

  return (
    <>
      <Topbar role="PATIENT" networkLabel={networkLabel} />
      <section className="hero patientHero">
        <div>
          <h1>Sức khoẻ của bạn là hạnh phúc của chúng tôi</h1>
          <button className="primaryBtn" onClick={() => setPage("my-records")}>Xem hồ sơ của tôi</button>
        </div>
      </section>

      <section className="statsGrid">
        <StatCard icon={FileText} value={records.length} label="Hồ sơ" />
        <StatCard icon={KeyRound} value={activePermissions.length} label="Quyền đang hiệu lực" />
        <StatCard icon={Bell} value={requests.length} label="Yêu cầu chờ duyệt" />
        <StatCard icon={History} value={auditLogs.length} label="Audit log" />
      </section>

      <section className="dashboardGrid">
        <div className="card activityCard">
          <div className="cardHeader">
            <h3>Hồ sơ mới nhất</h3>
            <button className="linkBtn" onClick={() => setPage("my-records")}>Xem tất cả →</button>
          </div>
          {records.length === 0 ? <ActionNotice>Chưa có hồ sơ nào gắn với patient session hiện tại.</ActionNotice> : null}
          {records.map((record) => (
            <div className="recordRow" key={record.id}>
              <div className="recordIcon"><FileText size={22} /></div>
              <div>
                <strong>{record.id}</strong>
                <p>{record.diagnosis} · Tạo bởi {record.creator}</p>
              </div>
              <span className="pill">{record.status}</span>
            </div>
          ))}
        </div>
        <div className="rightColumn">
          <StatusList rows={systemStatus} />
        </div>
      </section>
    </>
  );
}

export function PatientRecords({ records, onCheckAccess, actors, setPage, onOpenRecordDetail }) {
  const [query, setQuery] = useState("");
  const [activeRecordId, setActiveRecordId] = useState(records[0]?.id ?? "");
  const [error, setError] = useState("");
  const filteredRecords = useMemo(() => {
    return records.filter((record) =>
      `${record.id} ${record.createdAt || ""} ${record.diagnosis}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [query, records]);

  useEffect(() => {
    if (!filteredRecords.length) {
      setActiveRecordId("");
      return;
    }

    if (!filteredRecords.find((record) => record.id === activeRecordId)) {
      setActiveRecordId(filteredRecords[0].id);
    }
  }, [activeRecordId, filteredRecords]);

  const activeRecord = filteredRecords.find((record) => record.id === activeRecordId) || filteredRecords[0];

  async function inspectRecord(record) {
    setActiveRecordId(record.id);
    setError("");

    if (!actors.PATIENT.address) {
      setError("Bạn cần đăng nhập MetaMask với tài khoản bệnh nhân hợp lệ.");
      return;
    }

    try {
      const response = await onCheckAccess({
        recordId: record.id,
        userAddress: actors.PATIENT.address
      });

      onOpenRecordDetail({
        recordId: record.id,
        accessCheck: response,
      });
      setPage("patient-record-detail");
    } catch (inspectError) {
      setError(inspectError.message);
    }
  }

  return (
    <section className="pagePanel">
      <div className="accessHeader">
        <div>
          <h2>Hồ sơ bệnh án của tôi</h2>
        </div>
      </div>

      <div className="searchBox compactSearch">
        <input
          placeholder="Tìm theo ID, ngày khám hoặc chẩn đoán..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {activeRecord ? (
        <ActionNotice tone="success">
          Hồ sơ đang xem: <strong>ID: {activeRecord.id}</strong>
        </ActionNotice>
      ) : null}
      {error ? <ActionNotice tone="error">{error}</ActionNotice> : null}
      {!actors.PATIENT.address ? <ActionNotice tone="error">Bạn cần đăng nhập MetaMask với tài khoản bệnh nhân hợp lệ.</ActionNotice> : null}

      <div className="cardsGrid">
        {filteredRecords.map((record) => (
          <div className="card recordCard" key={record.id}>
            <div className="recordSummaryLines">
              <h3>ID: {record.id}</h3>
              <p>Ngày khám: {record.createdAt || "Chưa cập nhật"}</p>
              <p>Chẩn đoán: {record.diagnosis || "Chưa cập nhật"}</p>
            </div>
            <button className="primaryBtn wide" onClick={() => inspectRecord(record)}>
              Kiểm tra quyền & xem hồ sơ
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PatientRecordDetails({ record, accessCheck, permissions, actor, setPage }) {
  const viewerAddress = actor?.address || "";

  if (!record) {
    return (
      <section className="pagePanel">
        <div className="pageHeader">
          <button className="backBtn" onClick={() => setPage("my-records")}><ArrowLeft size={16} /> Quay lại</button>
          <h2>Chi tiết hồ sơ bệnh án</h2>
        </div>
        <ActionNotice tone="error">Không tìm thấy hồ sơ để hiển thị chi tiết.</ActionNotice>
      </section>
    );
  }

  const recordPermissions = permissions.filter((item) => item.recordId === record.id);
  const viewerPermission = viewerAddress
    ? recordPermissions.find((item) => item.granteeAddress.toLowerCase() === viewerAddress.toLowerCase()) || null
    : null;
  const isOwner = viewerAddress
    ? record.patientAddress.toLowerCase() === viewerAddress.toLowerCase()
    : false;
  const accessMessage = accessCheck
    ? accessCheck.hasAccess
      ? "Kiểm tra quyền thành công."
      : "Địa chỉ ví hiện chưa có quyền truy cập."
    : "Chưa có dữ liệu kiểm tra quyền.";
  const accessStatus = accessCheck?.hasAccess ? "Có quyền truy cập" : "Chưa có quyền truy cập";

  return (
    <section className="pagePanel">
      <div className="pageHeader">
        <button className="backBtn" onClick={() => setPage("my-records")}><ArrowLeft size={16} /> Quay lại</button>
        <h2>Chi tiết hồ sơ bệnh án</h2>
      </div>

      <div className="recordSplitLayout">
        <div className="card recordCard">
          <div className="recordSummaryLines">
            <h3>ID: {record.id}</h3>
            <p>Ngày khám: {record.createdAt || "Chưa cập nhật"}</p>
            <p>Chẩn đoán: {record.diagnosis || "Chưa cập nhật"}</p>
            <p>Người tạo: {record.creator || "Chưa cập nhật"}</p>
          </div>
          <ActionNotice tone={accessCheck?.hasAccess ? "success" : "error"}>{accessMessage}</ActionNotice>
          <InfoRow label="Kết quả kiểm tra quyền" value={accessStatus} />
          <InfoRow label="Quyền liên quan" value={String(recordPermissions.length)} />
          <InfoRow label="Trạng thái hồ sơ" value={record.status || "Chưa cập nhật"} />
        </div>

        <div className="card detailsCard">
          <div className="cardHeader">
            <div>
              <h3>{record.id}</h3>
              <p className="muted">{record.patient} · {record.diagnosis}</p>
            </div>
            <span className="pill">{record.status}</span>
          </div>

          <div className="recordDetailSection">
            <h4>Quyền của người dùng</h4>
            <InfoRow label="Người dùng" value={actor?.name || "Bệnh nhân"} />
            <InfoRow label="Vai trò" value="PATIENT" />
            <InfoRow label="Địa chỉ ví" value={viewerAddress || "Chưa đăng nhập"} copy={Boolean(viewerAddress)} />
            <InfoRow label="Liên hệ với hồ sơ" value={isOwner ? "Chủ hồ sơ" : "Không phải chủ hồ sơ"} />
            <InfoRow label="Quyền truy cập on-chain" value={accessStatus} />
            <InfoRow label="Quyền được cấp trực tiếp" value={viewerPermission?.status || "Không có"} />
            <InfoRow label="Mục đích quyền" value={viewerPermission?.purpose || "Không có"} />
            <InfoRow label="Thời hạn quyền" value={viewerPermission?.expiredAt || "Không có"} />
          </div>

          <div className="recordDetailSection">
            <h4>Thông tin người bệnh</h4>
            <InfoRow label="Bệnh nhân" value={record.patient} />
            <InfoRow label="Địa chỉ bệnh nhân" value={record.patientAddress} copy />
            <InfoRow label="Ngày sinh" value={record.birthday || "Chưa cập nhật"} />
            <InfoRow label="Giới tính" value={record.gender || "Chưa cập nhật"} />
          </div>

          <div className="recordDetailSection">
            <h4>Nội dung bệnh án</h4>
            <InfoRow label="Ngày khám" value={record.createdAt || "Chưa cập nhật"} />
            <InfoRow label="Chẩn đoán" value={record.diagnosis || "Chưa cập nhật"} />
            <InfoRow label="Kết quả xét nghiệm" value={record.lab || "Chưa cập nhật"} />
            <InfoRow label="Điều trị" value={record.treatment || "Chưa cập nhật"} />
            <InfoRow label="Ghi chú" value={record.note || "Chưa cập nhật"} />
            <InfoRow label="Chính sách truy cập" value={record.policy || "Chưa cập nhật"} />
          </div>

          <div className="recordDetailSection">
            <h4>Metadata lưu trữ</h4>
            <InfoRow label="CID" value={record.cid} copy />
            <InfoRow label="Record Hash" value={record.recordHash} copy />
            <InfoRow label="Policy Hash" value={record.policyHash} copy />
            <InfoRow label="Tx Hash" value={record.txHash} copy />
            <InfoRow label="Contract Record Id" value={String(record.contractRecordId)} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function PatientAccess({ permissions, onTogglePermission }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyPermissionId, setBusyPermissionId] = useState("");

  async function togglePermission(permission) {
    setBusyPermissionId(permission.id);
    setError("");

    try {
      const response = await onTogglePermission(permission);
      setMessage(response.message);
    } catch (toggleError) {
      setError(toggleError.message);
    } finally {
      setBusyPermissionId("");
    }
  }

  return (
    <section className="pagePanel">
      <div className="accessHeader">
        <div>
          <h2>Quản lý quyền truy cập</h2>
        </div>
      </div>

      {message ? <ActionNotice>{message}</ActionNotice> : null}
      {error ? <ActionNotice tone="error">{error}</ActionNotice> : null}
      {permissions.length === 0 ? <ActionNotice>Chưa có quyền truy cập nào được cấp cho hồ sơ của bạn.</ActionNotice> : null}

      <div className="card tableCard">
        <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>ID hồ sơ</th>
              <th>Người được cấp</th>
              <th>Vai trò</th>
              <th>Mục đích</th>
              <th>Thời hạn</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            {permissions.map((item) => (
              <tr key={item.id}>
                <td>{item.recordId}</td>
                <td>
                  <div className="person">
                    <div className="miniAvatar">{item.granteeName.slice(0, 2)}</div>
                    <span>{item.granteeName}</span>
                  </div>
                </td>
                <td><span className={`roleTag ${item.role.toLowerCase()}`}>{item.role}</span></td>
                <td>{item.purpose}</td>
                <td>{item.expiredAt}</td>
                <td><span className={`pill ${item.status === "Đã thu hồi" ? "danger" : ""}`}>{item.status}</span></td>
                <td>
                  <button
                    className={`iconBtn ${item.status === "Đang hiệu lực" ? "dangerIcon" : ""}`}
                    onClick={() => togglePermission(item)}
                    disabled={busyPermissionId === item.id}
                  >
                    {item.status === "Đang hiệu lực" ? <Ban size={15} /> : <RotateCcw size={15} />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </section>
  );
}

export function PatientRequests({ requests, onApproveRequest, onRejectRequest }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  return (
    <section className="pagePanel">
      <h2>Yêu cầu truy cập chờ duyệt</h2>
      {message ? <ActionNotice tone="success">{message}</ActionNotice> : null}
      {error ? <ActionNotice tone="error">{error}</ActionNotice> : null}
      <div className="requestList">
        {requests.length === 0 ? <ActionNotice>Không còn yêu cầu nào đang chờ duyệt.</ActionNotice> : null}
        {requests.map((req) => (
          <div className="card requestCard" key={req.id}>
            <div>
              <h3>{req.requesterName}</h3>
              <p>{req.purpose}</p>
              <small>{req.recordId} · {req.requestedAt}</small>
            </div>
            <div className="requestActions">
              <button
                className="ghostBtn dangerText"
                onClick={async () => {
                  try {
                    const response = await onRejectRequest(req.id);
                    setMessage(response.message);
                  } catch (rejectError) {
                    setError(rejectError.message);
                  }
                }}
              >
                Từ chối
              </button>
              <button
                className="primaryBtn"
                onClick={async () => {
                  try {
                    const response = await onApproveRequest(req);
                    setMessage(response.message);
                  } catch (approveError) {
                    setError(approveError.message);
                  }
                }}
              >
                Chấp nhận
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
