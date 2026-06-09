import { Lock, UploadCloud, Database, CheckCircle2 } from "lucide-react";
import { short } from "../../utils/format";

export default function ProcessPanel({ record }) {
  const rows = [
    { icon: Lock, title: "Chuẩn hóa dữ liệu", desc: "API gateway chuẩn bị recordHash và policyHash từ metadata nhập vào" },
    { icon: UploadCloud, title: "Mã hoá KP-ABE và upload IPFS", desc: record?.cid ? `Đã nhận CID ${short(record.cid)}` : "Storage service đóng gói bệnh án bằng KP-ABE hybrid rồi upload IPFS để nhận CID" },
    { icon: Database, title: "Ghi lên Blockchain", desc: "Lưu metadata, CID, hash và policyHash lên smart contract" },
    { icon: CheckCircle2, title: "Hoàn tất", desc: "Hồ sơ sẵn sàng cho kiểm tra quyền và cấp quyền truy cập" }
  ];

  return (
    <div className="card processCard">
      <h3>Luồng xử lý</h3>
      <div className="timeline">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div className="timelineItem" key={row.title}>
              <div className="timelineIcon">
                <Icon size={16} />
              </div>
              <div>
                <strong>{row.title}</strong>
                <p>{row.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
