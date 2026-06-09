# MedChain

## 1. Yêu cầu

- Docker Desktop hoặc Docker Engine kèm Docker Compose
- MetaMask trên trình duyệt
- Ví Sepolia có test ETH nếu bạn muốn tự deploy contract

## 2. Cấu hình môi trường

Tạo file `.env` từ mẫu:

```bash
cp .env.example .env
```

Điền tối thiểu các biến sau:

```env
MEDCHAIN_NETWORK=sepolia
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
ADMIN_ADDRESS=0x...
ADMIN_PRIVATE_KEY=0x...
```

Biến tuỳ chọn:

- `PINATA_JWT=`: dùng khi muốn upload IPFS thật
- `CONTRACT_ADDRESS=`: dùng khi đã có sẵn địa chỉ contract

Nếu để trống `PINATA_JWT`, hệ thống sẽ dùng lưu trữ cục bộ để chạy demo.

## 3. Deploy contract lên Sepolia

Nếu bạn đã có `CONTRACT_ADDRESS` hợp lệ, có thể bỏ qua bước này.

Chạy bằng Docker:

```bash
docker compose build blockchain-service
docker compose run --rm blockchain-service npm run blockchain:deploy:testnet
```

Hoặc chạy bằng Node.js trên máy:

```bash
npm install
npm run blockchain:compile
npm run blockchain:deploy:testnet
```

Sau khi deploy xong, kiểm tra file `services/blockchain-service/deployments/sepolia.json` đã có `contractAddress`.

Muốn dùng đầy đủ quyền `ADMIN`, bạn nên deploy bằng chính ví Sepolia mà bạn sẽ dùng để quản trị hệ thống.

## 4. Khởi động hệ thống

Chạy toàn bộ stack:

```bash
npm run docker:up
```

Hoặc:

```bash
docker compose up --build
```

## 5. Truy cập hệ thống

- Frontend: `http://localhost:5173`
- API Gateway: `http://localhost:4001/api`
- Blockchain Service health: `http://localhost:4100/health`
- Storage Service health: `http://localhost:4200/health`
