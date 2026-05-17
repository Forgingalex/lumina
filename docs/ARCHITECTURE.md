# Lumina Protocol: Technical Architecture Specification

This document details the underlying mechanics, transaction pipelines, and reputation algorithms powering the Lumina cashflow orchestration protocol on Celo Mainnet.

---

## 1. The Orchestration Pipeline

Lumina operates a deterministic, event-driven treasury orchestration pipeline. Rather than forcing merchants to manually move stablecoin settlements across accounts, the Lumina client handles incoming cashflows through pre-defined operational routing rules.

```
       Inbound USDC Payment
               │
               ▼
   ┌───────────────────────┐
   │  MiniPay Wallet / App │
   └───────────┬───────────┘
               │
               ├─► [Split Rule A] ──► Operational Budget (60%)
               │
               ├─► [Split Rule B] ──► Partner / Vendor (20%)
               │
               └─► [Split Rule C] ──► LuminaVault (20%)
                                           │
                                           ▼
                                 [Time-Locked Savings]
                                 [Lumina Score Accrual]
```

### 1.1 Inbound Routing Mechanics
1. **Event Monitoring:** The protocol client tracks real-time ledger updates on the USDC ERC-20 contract for the active merchant address.
2. **Deterministic Splitting:** When a payout is confirmed, the client calculates the precise allocation of assets based on percentage configuration:
   $$\text{Split Amount} = \text{Inbound Amount} \times \left( \frac{\text{Rule BPS}}{10000} \right)$$
3. **Execution Execution:** The allocations are processed via atomic smart contract calls or targeted multi-transfers using optimized CIP-64 transactions.

---

## 2. Fee Abstraction Logic (CIP-64 Gasless Rails)

In emerging economies, acquiring native gas tokens (such as CELO) represents a major UX hurdle for non-technical merchants. Lumina solves this entirely by utilizing Celo’s native **CIP-64 (Fee Currency Abstraction)** specifications.

### 2.1 Technical Mechanism
Every transaction payload submitted from the Lumina client incorporates a target `feeCurrency` property indicating the official USDC adapter address:

```typescript
const txHash = await walletClient.sendTransaction({
  account: address,
  to: targetAddress,
  data: encodedFunctionData,
  feeCurrency: "0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B" // USDC Gas Adapter
})
```

- **Gas Fees in USDC:** When this property is set, the Celo protocol node routes gas fee validation to the target adapter, which processes the transaction fee in USDC at verified oracle rates.
- **Zero CELO Balance:** Merchants can interact with both the ERC-20 token and the `LuminaVault` contract with an absolute zero balance of native CELO.

---

## 3. Reputation Algorithm

The `Lumina Score` is a non-transferable reputation index representing a business's operational consistency and volume history on Celo. Rather than static credit checks, this rating is calculated dynamically within `LuminaVault.sol`.

### 3.1 Mathematical Formulation
The rating algorithm combines **tenure linear duration** with **non-linear volume scaling** to reward long-term stability and prevent sybil manipulation through single large transactions.

$$\text{Lumina Score} = w_1 \cdot \text{Tenure Score} + w_2 \cdot \text{Volume Score}$$

#### 1. Tenure Score (Linear)
Tenure measures the duration (in days) since the merchant's first activity within the Lumina vault.
$$\text{Tenure Score} = \min\left( \frac{\text{Current Block Timestamp} - \text{First Deposit Timestamp}}{\text{86400 Seconds}} \cdot \text{Growth Factor}, 500 \right)$$

#### 2. Volume Score (Square Root Scaling)
To reward transaction volume while dampening the impact of sudden massive whale deposits, Lumina applies a square-root scaling factor:
$$\text{Volume Score} = \min\left( \text{Scaling Factor} \cdot \sqrt{\text{Cumulative Deposited Balance}}, 500 \right)$$

---

## 4. Protocol Security & Bounds

*   **Non-Transferability:** Reputation scores are bound directly to the merchant address within the `LuminaVault` storage mapping and cannot be traded, transferred, or delegated.
*   **Time-Locked Security:** Withdrawals from business reserves within `LuminaVault` require standard cooldown delays to assure the integrity of the active reputation scoring.
