# Blockchain Service Setup


## 1. Yeu cau

- Node.js 22+
- npm
- Vi Sepolia co test ETH neu ban muon tu deploy contract

Tat ca lenh ben duoi duoc chay tu thu muc goc repo `Medchain`.

## 2. Cai dependency

```bash
npm install
```

## 3. Cau hinh env

Tao hoac cap nhat 2 file sau:

- `.env`
- `services/blockchain-service/.env`

Ban co the tham khao:

- `.env.example`
- `services/blockchain-service/.env.example`

Cac bien quan trong:

```env
MEDCHAIN_BLOCKCHAIN_SERVICE_HOST=0.0.0.0
MEDCHAIN_BLOCKCHAIN_SERVICE_PORT=4100
MEDCHAIN_NETWORK=sepolia
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CONTRACT_ADDRESS=
ADMIN_ADDRESS=
ADMIN_PRIVATE_KEY=
```

Luu y:

- `SEPOLIA_RPC_URL` la bat buoc de service doc blockchain.
- `CONTRACT_ADDRESS` la tuy chon. Neu de trong, service se doc tu `services/blockchain-service/deployments/sepolia.json`.
- `ADMIN_PRIVATE_KEY` chi can khi ban muon deploy contract hoac de backend tu ky thao tac quan tri.

## 4. Compile contract

```bash
npm run blockchain:compile
```

## 5. Deploy contract len Sepolia

Bo qua buoc nay neu ban da co `CONTRACT_ADDRESS` hop le.

```bash
npm run blockchain:deploy:testnet
```

Sau khi deploy, kiem tra file:

- `services/blockchain-service/deployments/sepolia.json`

## 6. Chay service

```bash
npm run blockchain-service
```

Service mac dinh chay tai:

- `http://localhost:4100`

## 7. Kiem tra nhanh

```bash
curl http://localhost:4100/health
```

Neu ban chay bang Docker tu repo goc:

```bash
docker compose build blockchain-service
docker compose up blockchain-service
```
