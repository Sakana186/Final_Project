import { useState } from "react";
import ActionNotice from "../common/ActionNotice";
import { profiles } from "../../data/profiles";
import { walletService } from "../../services/walletService";

export default function PublicKeyGate({ role, onLogin }) {
  const profile = profiles[role];
  const [walletAddress, setWalletAddress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const address = await walletService.connect();
      setWalletAddress(address);
      const response = await onLogin({
        address,
        role,
      });
      setMessage(response.message);
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="authGate">
      <div className="card authCard">
        <span className={`pill authPill ${profile.color}`}>{profile.role}</span>
        <h2>Đăng nhập {profile.label.toLowerCase()} bằng MetaMask</h2>
        <p className="muted">
          Hệ thống sẽ lấy public key từ ví MetaMask và chỉ cho phép đăng nhập nếu public key đó đã được admin đăng ký trên blockchain.
        </p>

        {message ? <ActionNotice tone="success">{message}</ActionNotice> : null}
        {error ? <ActionNotice tone="error">{error}</ActionNotice> : null}

        <label>Ví MetaMask</label>
        <input value={walletAddress} readOnly placeholder="Chưa kết nối ví" />

        <button className="primaryBtn wide" onClick={submit} disabled={submitting}>
          {submitting ? "Đang kết nối..." : `Kết nối MetaMask và đăng nhập ${profile.label.toLowerCase()}`}
        </button>
      </div>
    </section>
  );
}
