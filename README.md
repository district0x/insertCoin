# Insert Coin - Trivia Game Module

This trivia game is part of Insert Coin, the premier web3 competitive gaming platform built on Base (Coinbase's L2 network). Insert Coin revolutionizes how gamers compete and earn by seamlessly combining traditional competitive gaming with blockchain technology to create secure, transparent, and rewarding experiences across multiple game genres.

## About Insert Coin Platform

Insert Coin offers various competitive gaming formats:
- **1v1 Matches**: Direct player-vs-player competition
- **2v2 Matches**: Team-based duos competition  
- **5v5 Matches**: Full team competitive matches
- **Tournament System**: MLG-style tournaments with flexible brackets
- **Multiple Game Support**: Various games utilizing the same transparent payment system

All competitions feature:
- **Smart Contract Security**: All matches backed by secure smart contracts
- **Automated Prize Distribution**: Transparent winner payouts
- **Real-time Verification**: Live match tracking and result verification
- **Community Donations**: Support through transparent donation system

## Trivia Game Features

This trivia game module extends Insert Coin's competitive gaming ecosystem with:

- **Real-time Multiplayer Gameplay**: Socket.IO-powered live trivia matches
- **Web3 Tournament Integration**: Seamless entry fees and prize distribution using Insert Coin's smart contracts
- **Multiple Game Modes**: 
  - Standard scoring mode
  - Sudden death elimination mode
  - Customizable question counts and timer settings
- **Wallet Authentication**: Connect with MetaMask, Coinbase Wallet, or WalletConnect
- **Tournament Management**: Admin dashboard for managing tournaments and prize distribution
- **Live Competition**: Real-time question answering with immediate scoring updates

## Future Updates

1. **ERC20 Token Support**: The smart contract currently accepts ERC20 tokens for tournament entry fees, but this feature has not been implemented in the trivia game UI options yet. Currently only ETH tournaments are supported through the interface.

2. **Enhanced Admin Panel**: Full admin panel functionality is available but restricted to wallet addresses that have been granted admin privileges on the smart contract. Admin features include tournament fund management, prize distribution, and platform settings.

3. **Smart Contract**: Deployed on Base Sepolia testnet at: [`0x052E7926f7B0C892Ef953EcC709d3c6e3D17268b`](https://sepolia.basescan.org/address/0x052E7926f7B0C892Ef953EcC709d3c6e3D17268b#code)

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Real-time**: Socket.IO for live gameplay
- **Blockchain**: ThirdWeb SDK, Ethers.js
- **Network**: Base (Coinbase L2)
- **Database**: Supabase for game data persistence
- **Authentication**: Sign-In with Ethereum (SIWE)
- **Smart Contracts**: Insert Coin tournament and match contracts

## Getting Started

### Prerequisites

- Node.js 18+ 
- A Supabase account and project
- A ThirdWeb account for Web3 functionality
- Ethereum wallet for testing (MetaMask recommended)
- Base Sepolia testnet ETH for testing


## How to Play

### Regular Trivia Games
1. Enter your name and create or join a game room
2. Share the room code with friends
3. Choose question categories, difficulty, and timer settings
4. Start the game and answer questions in real-time
5. See live scoring and elimination (in sudden death mode)

### Tournament Mode (Web3)
1. Connect your Web3 wallet (MetaMask, Coinbase, etc.)
2. Create a tournament with entry fee and prize distribution settings
3. Players join by paying the entry fee through the smart contract
4. Winners receive cryptocurrency prizes automatically via Insert Coin's secure smart contracts
5. All transactions are transparent and verifiable on Base blockchain

### Admin Functions
- Access the admin dashboard at `/admin`
- Manage tournament funds and matching pools (admin wallets only)
- Distribute prizes to tournament winners
- Monitor platform performance and user activity

## Insert Coin Ecosystem Integration

This trivia game integrates with Insert Coin's core infrastructure:

- **Shared Smart Contracts**: Uses the same secure tournament contracts as other Insert Coin games
- **Unified Prize System**: Automatic and transparent payments consistent across all platform games
- **Admin Management**: Centralized admin controls for all games in the ecosystem
- **Matching Pool**: Contributes to and benefits from the platform-wide matching pool system
- **User Accounts**: Seamless experience across all Insert Coin gaming modules
