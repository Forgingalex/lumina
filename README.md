# Lumina: On-Chain Cashflow Orchestration Protocol

Lumina is a production-grade, decentralized cashflow orchestration and treasury management protocol engineered specifically for micro-SMEs and global freelancers in the Global South. By leveraging the Celo network and the native MiniPay ecosystem, Lumina transforms standard stablecoin transactions into an automated, gasless, and reputation-building financial operating system.

---

## 🌌 The Vision

Micro-SMEs and independent contractors in emerging markets face steep financial friction: high local inflation, complex international client settlement, and lack of access to formal credit due to missing cashflow documentation. 

**Lumina** bridges this gap. By utilizing robust stablecoin infrastructure on Celo via the MiniPay wallet, Lumina allows businesses to accept digital USD settlements and instantly execute pre-configured rules for payout distribution, tax reserves, and savings. At the same time, every on-chain interaction dynamically updates their time-weighted reputation index (**Lumina Score**), establishing a credit-worthy history directly on the blockchain.

---

## ⚡ Key Features

*   **Autonomous Revenue Splitting:** 
    Configure deterministic, smart-contract-guided capital flows. Incoming revenue triggers automated split rules—routing precise percentages to designated operational budgets, partnership payouts, or locked savings reserves without manual intervention.
    
*   **CIP-64 Gasless USDC:** 
    Merchants never need to buy or hold native gas tokens like CELO. Utilizing Celo's native **CIP-64 fee currency abstraction**, every transaction fee is settled directly in the underlying asset (USDC) using the verified Mainnet Gas Adapter.
    
*   **Reputation Anchoring:** 
    Continuous activity and deposits build a verifiable financial footprint. The non-transferable **Lumina Score** (ranging from 0 to 1000) dynamically recalculates based on time-weighted tenure and cumulative volume metrics, providing an objective score for potential credit access.

---

## ⛓️ Protocol Deployment

The Lumina core engine is officially deployed and verified on Celo Mainnet:

| Contract | Address |
| :--- | :--- |
| **LuminaVault (Anchor)** | `0x92F849B5542656353efb979F3e1872187Cc7dC8E` |
| **Operational Asset (USDC)** | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| **Gas Adapter (CIP-64 USDC)** | `0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B` |

---

## 🛠️ Tech Stack

*   **Layer 1 Network:** [Celo Mainnet](https://celo.org/) (Chain ID: `42220`)
*   **Mobile Interface:** [MiniPay](https://www.minipay.org/) (Native Web3 Mobile Browser Env)
*   **Application Framework:** Next.js 15 (App Router with full Server/Client hydration)
*   **Smart Contract Client:** [Viem](https://viem.sh/) (Engineered with strict types and manual provider/client instances)
*   **Price Feeds & Swaps:** Mento Oracle SDK (Parity conversions and local-currency rates)
