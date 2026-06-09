import { useEffect, useState } from "react";
import {
  FileText,
  Database,
  KeyRound,
  Lock,
  ClipboardList,
  ArrowLeft
} from "lucide-react";
import Topbar from "../../components/layout/Topbar";
import ActionNotice from "../../components/common/ActionNotice";
import StatCard from "../../components/common/StatCard";
import InfoRow from "../../components/common/InfoRow";
import StatusList from "../../components/common/StatusList";

export function DoctorOverview({ records, setPage, systemStatus, networkLabel }) {
  return (
    <>
      <Topbar role="DOCTOR" networkLabel={networkLabel} />
      <section className="hero doctorHero">
        <div>
          <h1>Tận tình, tận tâm, tận hiến</h1>
          <button className="primaryBtn" onClick={() => setPage("create-record")}>Tạo hồ sơ mới</button>
        </div>
      </section>

      <section className="statsGrid">
        <StatCard icon={FileText} value={records.length} label="Hồ sơ bác sĩ đã ghi" />
        <StatCard icon={Database} value={records.filter((item) => item.txHash).length} label="Tx on-chain" />
        <StatCard icon={Lock} value={records.filter((item) => item.recordHash).length} label="Record hash" />
        <StatCard icon={KeyRound} value={records.filter((item) => item.policyHash).length} label="Policy hash" />
      </section>

      <section className="dashboardGrid">
        <div className="card activityCard">
          <div className="cardHeader">
            <h3>Hồ sơ điều trị gần đây</h3>
            <button className="linkBtn" onClick={() => setPage("doctor-records")}>Xem tất cả →</button>
          </div>
          {records.length === 0 ? <ActionNotice>Không có hồ sơ</ActionNotice> : null}
          {records.map((record) => (
            <div className="recordRow" key={record.id}>
              <div className="recordIcon"><ClipboardList size={22} /></div>
              <div>
                <strong>{record.id}</strong>
                <p>{record.patient} · {record.diagnosis}</p>
              </div>
              <span className="pill">{record.activePermission?.status || record.status}</span>
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

export function CreateRecord({ users, actors, contractReady, onCreateRecord, setPage }) {
  const [form, setForm] = useState({
    id: "",
    patientAddress: "",
    birthday: "",
    gender: "",
    diagnosis: "",
    lab: "",
    treatment: "",
    note: "",
    policy: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [createdRecord, setCreatedRecord] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const patientUsers = users.filter((user) => user.role === "PATIENT");

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    if (createdRecord || submitting) {
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await onCreateRecord({
        ...form,
        creatorAddress: actors.DOCTOR.address
      });

      setCreatedRecord(response.record);
      setMessage(response.message);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="pagePanel">
      <div className="pageHeader">
        <button className="backBtn" onClick={() => setPage("doctor-overview")}><ArrowLeft size={16} /> Quay lại</button>
        <h2>Tạo hồ sơ bệnh án mới</h2>
      </div>

      {message ? <ActionNotice tone="success">{message}</ActionNotice> : null}
      {error ? <ActionNotice tone="error">{error}</ActionNotice> : null}
      {!actors.DOCTOR.address ? (
        <ActionNotice tone="error">Bạn cần đăng nhập MetaMask với tài khoản bác sĩ hợp lệ.</ActionNotice>
      ) : null}
      {!contractReady ? (
        <ActionNotice tone="error">Smart contract chưa sẵn sàng. Kiểm tra cấu hình Sepolia rồi tải lại trạng thái hệ thống.</ActionNotice>
      ) : null}

      <div className="recordEditorLayout singleColumn">
        <div className="card formCard">
          <div className="cardHeader compactHeader">
            <div>
              <h3>Tạo hồ sơ mới</h3>
              <p className="muted">Nhập dữ liệu một lần rồi bấm hoàn tất để hệ thống mã hoá, lưu IPFS và ghi blockchain.</p>
            </div>
          </div>

          <h3>Thông tin người bệnh</h3>
          <label>Mã hồ sơ nghiệp vụ</label>
          <input value={form.id} onChange={(e) => update("id", e.target.value)} placeholder="VD: MC-REC-0001" />
          <label>Địa chỉ bệnh nhân</label>
          <input
            list="patient-addresses"
            value={form.patientAddress}
            onChange={(e) => update("patientAddress", e.target.value)}
            placeholder="0x..."
          />
          <datalist id="patient-addresses">
            {patientUsers.map((user) => (
              <option key={user.address} value={user.address}>{user.name}</option>
            ))}
          </datalist>

          <div className="twoCols">
            <div>
              <label>Ngày sinh</label>
              <input value={form.birthday} onChange={(e) => update("birthday", e.target.value)} placeholder="dd/mm/yyyy" />
            </div>
            <div>
              <label>Giới tính</label>
              <input value={form.gender} onChange={(e) => update("gender", e.target.value)} placeholder="Nam / Nữ / Khác" />
            </div>
          </div>

          <h3>Metadata hồ sơ</h3>
          <label>Chẩn đoán</label>
          <input value={form.diagnosis} onChange={(e) => update("diagnosis", e.target.value)} />
          <label>Kết quả xét nghiệm</label>
          <input value={form.lab} onChange={(e) => update("lab", e.target.value)} />
          <label>Điều trị</label>
          <input value={form.treatment} onChange={(e) => update("treatment", e.target.value)} />
          <label>Ghi chú</label>
          <input value={form.note} onChange={(e) => update("note", e.target.value)} />
          <label>Policy truy cập</label>
          <input value={form.policy} onChange={(e) => update("policy", e.target.value)} placeholder="role:doctor AND department:cardiology" />

          <div className="formActions">
            <button className="ghostBtn" onClick={() => setPage("doctor-overview")}>Huỷ</button>
            <button className="primaryBtn" onClick={submit} disabled={submitting || !actors.DOCTOR.address || !contractReady}>
              {submitting ? "Đang hoàn tất..." : createdRecord ? "Đã hoàn tất" : "Hoàn tất"}
            </button>
          </div>
        </div>
      </div>

      {createdRecord ? (
        <div className="postCreateActions">
          <button className="primaryBtn" onClick={() => setPage("doctor-records")}>
            Xem hồ sơ điều trị
          </button>
        </div>
      ) : null}
    </section>
  );
}

export function DoctorRecords({ records }) {
  const [activeRecordId, setActiveRecordId] = useState(records[0]?.id ?? "");

  useEffect(() => {
    if (!records.length) {
      setActiveRecordId("");
      return;
    }

    if (!records.find((record) => record.id === activeRecordId)) {
      setActiveRecordId(records[0].id);
    }
  }, [activeRecordId, records]);

  const activeRecord = records.find((record) => record.id === activeRecordId) || records[0] || null;

  return (
    <section className="pagePanel">
      <h2>Hồ sơ điều trị</h2>
      {records.length === 0 ? <ActionNotice>Không có hồ sơ</ActionNotice> : null}
      <div className="recordSplitLayout">
        <div className="card recordListCard">
          {records.map((record) => (
            <button
              className={`recordListItem ${record.id === activeRecord?.id ? "active" : ""}`}
              key={record.id}
              onClick={() => setActiveRecordId(record.id)}
            >
              <div className="recordListIcon">
                <ClipboardList size={22} />
              </div>
              <div className="recordListBody">
                <strong>{record.id}</strong>
                <p>{record.patient} · {record.diagnosis}</p>
              </div>
              <span className="pill">{record.activePermission?.status || record.status}</span>
            </button>
          ))}
        </div>

        <div className="card detailsCard">
          {!activeRecord ? <ActionNotice>Chọn một bệnh án để xem toàn bộ nội dung điều trị.</ActionNotice> : null}
          {activeRecord ? (
            <>
              <div className="cardHeader">
                <div>
                  <h3>{activeRecord.id}</h3>
                  <p className="muted">{activeRecord.patient} · {activeRecord.diagnosis}</p>
                </div>
                <span className="pill">{activeRecord.activePermission?.status || activeRecord.status}</span>
              </div>

              <div className="recordDetailSection">
                <h4>Thông tin người bệnh</h4>
                <InfoRow label="Bệnh nhân" value={activeRecord.patient} />
                <InfoRow label="Địa chỉ bệnh nhân" value={activeRecord.patientAddress} copy />
                <InfoRow label="Ngày sinh" value={activeRecord.birthday || "Chưa cập nhật"} />
                <InfoRow label="Giới tính" value={activeRecord.gender || "Chưa cập nhật"} />
              </div>

              <div className="recordDetailSection">
                <h4>Nội dung bệnh án</h4>
                <InfoRow label="Chẩn đoán" value={activeRecord.diagnosis || "Chưa cập nhật"} />
                <InfoRow label="Kết quả xét nghiệm" value={activeRecord.lab || "Chưa cập nhật"} />
                <InfoRow label="Điều trị" value={activeRecord.treatment || "Chưa cập nhật"} />
                <InfoRow label="Ghi chú" value={activeRecord.note || "Chưa cập nhật"} />
                <InfoRow label="Chính sách truy cập" value={activeRecord.policy || "Chưa cập nhật"} />
              </div>

              <div className="recordDetailSection">
                <h4>Quyền điều trị hiện tại</h4>
                <InfoRow label="Mục đích" value={activeRecord.activePermission?.purpose || "Không có thông tin"} />
                <InfoRow label="Thời hạn" value={activeRecord.activePermission?.expiredAt || "Không có thông tin"} />
                <InfoRow label="Cấp bởi" value={activeRecord.activePermission?.grantedBy || "Không có thông tin"} />
              </div>

              <div className="recordDetailSection">
                <h4>Metadata lưu trữ</h4>
                <InfoRow label="CID" value={activeRecord.cid} copy />
                <InfoRow label="Record Hash" value={activeRecord.recordHash} copy />
                <InfoRow label="Policy Hash" value={activeRecord.policyHash} copy />
                <InfoRow label="Tx Hash" value={activeRecord.txHash} copy />
                <InfoRow label="Contract Record Id" value={String(activeRecord.contractRecordId)} />
                <InfoRow label="Thời điểm tạo" value={activeRecord.createdAt || "Chưa cập nhật"} />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function DoctorRequest({ records, pendingRequests, actors, contractReady, onRequestAccess }) {
  const [form, setForm] = useState({
    recordId: records[0]?.id || "",
    purpose: "",
    duration: "7"
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!records.length) {
      setForm((current) => ({ ...current, recordId: "" }));
      return;
    }

    if (!records.find((record) => record.id === form.recordId)) {
      setForm((current) => ({ ...current, recordId: records[0].id }));
    }
  }, [form.recordId, records]);

  const selectedRecord = records.find((record) => record.id === form.recordId) || records[0] || null;

  async function submit() {
    if (!actors.DOCTOR.address) {
      setError("Bạn cần đăng nhập MetaMask với tài khoản bác sĩ hợp lệ.");
      return;
    }

    if (!form.recordId) {
      setError("Vui lòng chọn hồ sơ cần yêu cầu truy cập.");
      return;
    }

    if (!form.purpose.trim()) {
      setError("Vui lòng nhập mục đích truy cập.");
      return;
    }

    const durationDays = Number.parseInt(form.duration, 10);
    if (!Number.isFinite(durationDays) || durationDays <= 0) {
      setError("Thời hạn đề xuất phải là số ngày lớn hơn 0.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await onRequestAccess({
        recordId: form.recordId,
        purpose: form.purpose.trim(),
        durationDays,
        requesterAddress: actors.DOCTOR.address
      });
      setMessage(response.message);
      setForm((current) => ({ ...current, purpose: "", duration: "7" }));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="pagePanel">
      <h2>Gửi yêu cầu truy cập</h2>
      {message ? <ActionNotice tone="success">{message}</ActionNotice> : null}
      {error ? <ActionNotice tone="error">{error}</ActionNotice> : null}
      {!actors.DOCTOR.address ? (
        <ActionNotice tone="error">Bạn cần đăng nhập MetaMask với tài khoản bác sĩ hợp lệ.</ActionNotice>
      ) : null}
      {!contractReady ? (
        <ActionNotice tone="error">Smart contract chưa sẵn sàng. Kiểm tra cấu hình Sepolia rồi tải lại trạng thái hệ thống.</ActionNotice>
      ) : null}
      {pendingRequests.length > 0 ? (
        <ActionNotice>
          Bạn đang có <strong>{pendingRequests.length}</strong> yêu cầu truy cập chờ xử lý.
        </ActionNotice>
      ) : null}
      {records.length === 0 ? (
        <ActionNotice>
          Hiện không còn hồ sơ nào để gửi yêu cầu truy cập. Các hồ sơ bạn đã có quyền hoặc đang chờ duyệt sẽ không hiển thị ở đây.
        </ActionNotice>
      ) : null}

      <div className="formGrid">
        <div className="card formCard">
          <label>Mã hồ sơ cần truy cập</label>
          <select
            value={form.recordId}
            onChange={(event) => setForm((current) => ({ ...current, recordId: event.target.value }))}
            disabled={records.length === 0}
          >
            {records.length === 0 ? <option value="">Không có hồ sơ khả dụng</option> : null}
            {records.map((record) => (
              <option key={record.id} value={record.id}>
                {record.id} - {record.patient} - {record.diagnosis}
              </option>
            ))}
          </select>
          <label>Mục đích truy cập</label>
          <input
            value={form.purpose}
            onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))}
            placeholder="Ví dụ: Khám lại, hội chẩn, đọc kết quả xét nghiệm"
          />
          <label>Thời hạn đề xuất (ngày)</label>
          <input
            value={form.duration}
            onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))}
            inputMode="numeric"
            placeholder="7"
          />
          <button className="primaryBtn wide" onClick={submit} disabled={submitting || records.length === 0 || !actors.DOCTOR.address || !contractReady}>
            {submitting ? "Đang gửi..." : "Gửi yêu cầu truy cập"}
          </button>
        </div>
        <div className="card processCard">
          <h3>Chi tiết</h3>
          <InfoRow label="Bác sĩ yêu cầu" value={actors.DOCTOR.address || "Chưa đăng nhập"} copy />
          <InfoRow label="Mã hồ sơ" value={selectedRecord?.id || "Chưa chọn"} />
          <InfoRow label="Bệnh nhân" value={selectedRecord?.patient || "Chưa có"} />
          <InfoRow label="Ngày khám" value={selectedRecord?.createdAt || "Chưa có"} />
          <InfoRow label="Chẩn đoán" value={selectedRecord?.diagnosis || "Chưa có"} />
          <InfoRow label="Người tạo hồ sơ" value={selectedRecord?.creator || "Chưa có"} />
          <InfoRow label="Mục đích truy cập" value={form.purpose || "Chưa nhập"} />
          <InfoRow label="Thời hạn đề xuất" value={form.duration ? `${form.duration} ngày` : "Chưa nhập"} />
        </div>
      </div>
    </section>
  );
}
