function getEthereumProvider() {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("Không tìm thấy MetaMask trên trình duyệt này.");
  }

  return window.ethereum;
}

export const walletService = {
  async connect() {
    const ethereum = getEthereumProvider();
    const accounts = await ethereum.request({
      method: "eth_requestAccounts",
    });
    const address = accounts?.[0];

    if (!address) {
      throw new Error("MetaMask chưa trả về public key hợp lệ.");
    }

    return String(address);
  },
  async getActiveAccount() {
    const ethereum = getEthereumProvider();
    const accounts = await ethereum.request({
      method: "eth_accounts",
    });

    return accounts?.[0] ? String(accounts[0]) : "";
  },
  onAccountsChanged(handler) {
    const ethereum = getEthereumProvider();
    ethereum.on("accountsChanged", handler);

    return () => {
      ethereum.removeListener("accountsChanged", handler);
    };
  },
};
