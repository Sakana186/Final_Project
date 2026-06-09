import { UserRound, Stethoscope, UserCog } from "lucide-react";

export const profiles = {
  PATIENT: {
    role: "PATIENT",
    label: "Bệnh nhân",
    desc: "Phiên thao tác của bệnh nhân",
    icon: UserRound,
    avatar: "PT",
    color: "patient"
  },
  DOCTOR: {
    role: "DOCTOR",
    label: "Bác sĩ",
    desc: "Phiên thao tác của bác sĩ",
    icon: Stethoscope,
    avatar: "DR",
    color: "doctor"
  },
  ADMIN: {
    role: "ADMIN",
    label: "Quản trị viên",
    desc: "Phiên thao tác của quản trị viên",
    icon: UserCog,
    avatar: "AD",
    color: "admin"
  }
};
