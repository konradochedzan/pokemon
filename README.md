# Decentralized Pokémon Trading Platform

This project implements a fully decentralized application (dApp) for trading Pokémon cards as NFTs using Ethereum smart contracts. It includes:

- Smart contracts for minting Pokémon and managing fixed-price/auction sales.
- A backend server for secure off-chain randomness and signature generation (EIP-712).
- A frontend React app that interacts with the contracts via MetaMask.

---

## Prerequisites

- [Node.js](https://nodejs.org/en/) (v16.x or later)
- [npm](https://www.npmjs.com/)
- [MetaMask](https://metamask.io/download/)
- [Git](https://git-scm.com/)

---

## MetaMask Setup

1. **Install MetaMask**: [https://metamask.io/download/](https://metamask.io/download/)
2. Create or import a wallet.
3. Switch to the **Localhost 8545** network:
   - Network Name: `Localhost 8545`
   - RPC URL: `http://127.0.0.1:8545`
   - Chain ID: `31337`
4. Import a Hardhat account:
   - When you run `npx hardhat node`, copy one of the private keys printed in the terminal and import it in MetaMask.

---

## Smart Contracts (Hardhat)

### 1. Install Hardhat & Dependencies

```bash
npm install --save-dev hardhat
npx hardhat
```

Choose "Create a basic sample project" and follow the prompts.

Then install:

```bash
npm install --save-dev @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts
```

### 2. Compile Contracts

```bash
npx hardhat compile
```

### 3. Start the Local Network

```bash
npx hardhat node
```

### 4. Deploy Contracts

In a new terminal:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Make sure your `deploy.js` file correctly deploys both `PokemonNFT.sol` and `TradingWithAuctions.sol`.

---

## Backend Signature Server (EIP-712)

### 1. Navigate to Backend

```bash
cd backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Server

```bash
node server.js
```

> Ensure you configure the trusted private key and the verifying contract address inside `server.js`.

Server runs on: `http://localhost:3001`

---

## Frontend (React + Vite + ethers.js)

### 1. Navigate to Frontend

```bash
cd frontend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## Development Workflow Summary

| Terminal | Task                             | Command                                                   |
|----------|----------------------------------|------------------------------------------------------------|
| 1        | Run local blockchain             | `npx hardhat node`                                         |
| 2        | Deploy contracts                 | `npx hardhat run scripts/deploy.js --network localhost`    |
| 3        | Start backend signature server   | `cd backend && node server.js`                             |
| 4        | Start frontend app               | `cd frontend && npm install && npm run dev`                |

---

## Security Features Implemented

- Role-based access control via OpenZeppelin's `Ownable`
- Signature-based minting verification via EIP-712
- Optional commit-reveal scheme to prevent front-running in auctions
- Emergency circuit breaker using OpenZeppelin’s `Pausable`
- Escrow-based custody of NFTs in the auction contract

