# Lumina Protocol: Developer & Integration Guide

Welcome to the Lumina developer center. This guide outlines how to configure, run, and test the cashflow orchestration system.

---

## 1. Local Development Quickstart

### 1.1 Prerequisites
Ensure you have the following installed:
- **Node.js:** `v18.x` or higher
- **Package Manager:** `pnpm` (recommended), `npm`, or `yarn`

### 1.2 Installation
1. Clone the repository and navigate to the project directory:
   ```bash
   cd lumina
   ```
2. Install the necessary dependencies:
   ```bash
   pnpm install
   ```

### 1.3 Environment Setup
Configure your environment using the local file:
1. Open `.env.local` in the root directory.
2. Toggle the active target network (e.g. `mainnet` or `sepolia`):
   ```env
   NEXT_PUBLIC_NETWORK_ENV="mainnet"
   ```

### 1.4 Run the Server
Launch the local Next.js server:
```bash
pnpm dev
```
The client dashboard will be available at `http://localhost:3000`.

---

## 2. MiniPay Site Tester Configuration

To experience the native MiniPay environment, you must test the dashboard through the official Opera MiniPay Site Tester:

1. Install **Opera Mini** with MiniPay integration on a supported Android or iOS device.
2. Connect your testing device to the same local network as your development machine.
3. Open the **MiniPay Developer tools** / **Site Tester** application.
4. Input your local development address: `http://<your-local-ip>:3000`.
5. The application will detect the mock `window.ethereum` wrapper provided by MiniPay and automatically trigger autoconnect.

---

## 3. On-Chain Contracts & Verification

The core Lumina smart contracts are verified and public on the Celo block explorer:

### 3.1 Celo Mainnet Deployment
*   **LuminaVault Contract:**
    - Address: `0x962fc12bfA3D64e4Ea8c2F7CE92Ab9fCc064CCEF`
    - CeloScan Link: [CeloScan LuminaVault](https://celoscan.io/address/0x962fc12bfA3D64e4Ea8c2F7CE92Ab9fCc064CCEF)
*   **Target Token (USDC):**
    - Address: `0xcebA9300f2b948710d2653dD7B07f33A8B32118C`
    - CeloScan Link: [CeloScan USDC](https://celoscan.io/address/0xcebA9300f2b948710d2653dD7B07f33A8B32118C)
*   **Gas Adapter (CIP-64 USDC):**
    - Address: `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B`
    - CeloScan Link: [CeloScan Gas Adapter](https://celoscan.io/address/0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B)

---

## 4. Testing Contract Methods Directly

Developers can interact directly with the deployed contracts using standard CLI toolkits:

### Read Merchant Profile
To query a merchant’s balance and reputation score:
```bash
cast call 0x962fc12bfA3D64e4Ea8c2F7CE92Ab9fCc064CCEF "getMerchantProfile(address)" <MERCHANT_ADDRESS> --rpc-url https://forno.celo.org
```

### Validate ERC-20 Allowance
To check the vault's spending approval limits:
```bash
cast call 0xcebA9300f2b948710d2653dD7B07f33A8B32118C "allowance(address,address)" <MERCHANT_ADDRESS> 0x962fc12bfA3D64e4Ea8c2F7CE92Ab9fCc064CCEF --rpc-url https://forno.celo.org
```
