import { PatientOverview, PatientRecords, PatientAccess, PatientRequests, PatientRecordDetails } from "./patient";
import { DoctorOverview, CreateRecord, DoctorRecords, DoctorRequest } from "./doctor";
import { AdminOverview, UserManagement, RoleManagement } from "./admin";
import AuditTimeline from "../components/audit/AuditTimeline";
import EmptyState from "../components/common/EmptyState";

export function renderPage(page, props) {
  const pages = {
    "patient-overview": () => (
      <PatientOverview
        records={props.patientRecords}
        permissions={props.permissions}
        requests={props.accessRequests}
        auditLogs={props.auditLogs}
        setPage={props.setPage}
        systemStatus={props.systemStatus}
        networkLabel={props.networkLabel}
      />
    ),
    "my-records": () => (
      <PatientRecords
        records={props.patientRecords}
        onCheckAccess={props.actions.checkAccess}
        actors={props.actors}
        setPage={props.setPage}
        onOpenRecordDetail={props.setPatientRecordDetail}
      />
    ),
    "patient-record-detail": () => (
      <PatientRecordDetails
        record={props.patientRecords.find((item) => item.id === props.patientRecordDetail?.recordId) || null}
        accessCheck={props.patientRecordDetail?.accessCheck || null}
        permissions={props.permissions}
        actor={props.actors.PATIENT}
        setPage={props.setPage}
      />
    ),
    "patient-access": () => <PatientAccess permissions={props.permissions} onTogglePermission={props.actions.togglePermission} />,
    "patient-requests": () => (
      <PatientRequests
        requests={props.accessRequests}
        onApproveRequest={props.actions.approveRequest}
        onRejectRequest={props.actions.rejectRequest}
      />
    ),
    "doctor-overview": () => (
      <DoctorOverview
        records={props.doctorRecords}
        setPage={props.setPage}
        systemStatus={props.systemStatus}
        networkLabel={props.networkLabel}
      />
    ),
    "create-record": () => (
      <CreateRecord
        users={props.users}
        actors={props.actors}
        contractReady={props.contractReady}
        onCreateRecord={props.actions.createRecord}
        setPage={props.setPage}
      />
    ),
    "doctor-records": () => <DoctorRecords records={props.doctorRecords} />,
    "doctor-request": () => (
      <DoctorRequest
        records={props.doctorRequestableRecords}
        pendingRequests={props.doctorPendingRequests}
        actors={props.actors}
        contractReady={props.contractReady}
        onRequestAccess={props.actions.requestAccess}
      />
    ),
    "admin-overview": () => (
      <AdminOverview
        users={props.users}
        records={props.allRecords}
        auditLogs={props.auditLogs}
        setPage={props.setPage}
        systemStatus={props.systemStatus}
        networkLabel={props.networkLabel}
      />
    ),
    "user-management": () => <UserManagement users={props.users} onAddUser={props.actions.addUser} onToggleUserStatus={props.actions.toggleUserStatus} />,
    "role-management": () => <RoleManagement users={props.users} onAssignRole={props.actions.assignRole} />,
    audit: () => <AuditTimeline events={props.auditLogs} scopeLabel={props.auditScopeLabel} />
  };

  const Page = pages[page] || (() => <EmptyState title="Màn hình chưa triển khai" />);
  return <Page />;
}
