export default function Stepper({ step }) {
  const steps = ["Nhập thông tin", "Mã hoá dữ liệu", "Lưu trữ IPFS", "Ghi Blockchain", "Hoàn tất"];

  return (
    <div className="stepper">
      {steps.map((label, index) => (
        <div className={`step ${index <= step ? "done" : ""}`} key={label}>
          <span>{index + 1}</span>
          <p>{label}</p>
        </div>
      ))}
    </div>
  );
}
