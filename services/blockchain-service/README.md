# Blockchain Service

`blockchain-service` là HTTP service chịu trách nhiệm đọc trạng thái contract và user directory trên `Sepolia`, đồng thời hỗ trợ một số thao tác admin khi cần.

## Vai trò của service này

- trả health/status cho UI và gateway
- đọc danh sách user on-chain
- xác thực đăng nhập theo ví + role
- kiểm tra quyền truy cập trên contract
- hỗ trợ `registerUser` và `setUserStatus` nếu bạn chủ động bật backend signer

Runtime chuẩn không dùng Hardhat local node. Hardhat chỉ còn dùng để compile/deploy contract lên `Sepolia`.

## Env

File mẫu:

- `services/blockchain-service/.env.example`

Các biến quan trọng:

```env
MEDCHAIN_BLOCKCHAIN_SERVICE_HOST=0.0.0.0
MEDCHAIN_BLOCKCHAIN_SERVICE_PORT=4100
MEDCHAIN_NETWORK=sepolia
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CONTRACT_ADDRESS=
ADMIN_ADDRESS=
ADMIN_PRIVATE_KEY=
```

Ghi chú:

- `CONTRACT_ADDRESS` là optional override
- nếu bỏ trống `CONTRACT_ADDRESS`, service sẽ đọc `services/blockchain-service/deployments/sepolia.json`
- `ADMIN_PRIVATE_KEY` chỉ cần nếu bạn muốn backend tự ký thao tác admin; luồng UI mặc định ký bằng MetaMask ở frontend

## Deploy contract

Khuyến nghị từ root repo:

```bash
docker compose build blockchain-service
docker compose run --rm blockchain-service npm run blockchain:deploy:testnet
```

Hoặc:

```bash
npm install
npm run blockchain:compile
npm run blockchain:deploy:testnet
```

## Chạy service

```bash
npm run blockchain-service
```

## Shared runtime asset

ABI dùng chung không nằm trong thư mục riêng của service nữa, mà ở:

- `shared/abi/EHRAccessControl.json`

Điều này giúp frontend và blockchain-service dùng chung contract interface mà không phụ thuộc mã nguồn của nhau.

## Endpoint

- `GET /health`
- `GET /status`
- `GET /users`
- `GET /users/:address`
- `POST /auth/login`
- `POST /users`
- `PATCH /users/:address/status`
- `POST /access/check`
