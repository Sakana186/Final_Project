import {
  LayoutDashboard,
  FileText,
  KeyRound,
  History,
  Bell,
  Plus,
  ClipboardList,
  Users,
  ShieldCheck
} from "lucide-react";

export const menus = {
  PATIENT: [
    { id: "patient-overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "my-records", label: "Hồ sơ của tôi", icon: FileText },
    { id: "patient-access", label: "Quyền truy cập", icon: KeyRound },
    { id: "patient-requests", label: "Yêu cầu truy cập", icon: Bell },
    { id: "audit", label: "Lịch sử truy vết", icon: History }
  ],
  DOCTOR: [
    { id: "doctor-overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "create-record", label: "Tạo bệnh án", icon: Plus },
    { id: "doctor-records", label: "Hồ sơ điều trị", icon: ClipboardList },
    { id: "doctor-request", label: "Yêu cầu truy cập", icon: KeyRound },
    { id: "audit", label: "Lịch sử truy vết", icon: History }
  ],
  ADMIN: [
    { id: "admin-overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "user-management", label: "Quản lý người dùng", icon: Users },
    { id: "role-management", label: "Gán vai trò", icon: ShieldCheck },
    { id: "audit", label: "Lịch sử truy vết", icon: History }
  ]
};
