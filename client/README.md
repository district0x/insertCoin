# OneVOne Client Application

This is the frontend application for the OneVOne gaming platform built with Next.js, Prisma, Tailwind CSS, and Web3 technologies. It enables users to create matches, join competitions, and interact with the OneVOne smart contracts.

## Prerequisites

Before setting up the client application, ensure you have the following installed:

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/installation) (v8 or higher)
- [Git](https://git-scm.com/downloads)
- A code editor like [VS Code](https://code.visualstudio.com/)

## Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/your-repo/onevone.git
cd onevone/client
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Configuration

Create a `.env` file in the client directory with the following variables (adjust values as needed):

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/onevone?pgbouncer=true"
DIRECT_URL="postgresql://username:password@localhost:5432/onevone"

# Web3
NEXT_PUBLIC_CONTRACT_ADDRESS="0x052E7926f7B0C892Ef953EcC709d3c6e3D17268b"
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID="your_wallet_connect_project_id"

# General
NEXT_PUBLIC_APP_URL="http://localhost:3000" 

# Base Sepolia RPC (Alchemy)
NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL="https://base-sepolia.g.alchemy.com/v2/your_alchemy_key"
```

To obtain the required keys:
- **WalletConnect Project ID**: Register at [WalletConnect Cloud](https://cloud.walletconnect.com/)
- **Alchemy API Key**: Sign up at [Alchemy](https://www.alchemy.com/) and create a new app with Base Sepolia network

### 4. Database Setup

This project uses Prisma ORM to connect to a PostgreSQL database.

```bash
# Generate Prisma client
pnpm prisma generate

# If you need to create a new database and apply migrations
pnpm prisma migrate dev
```

### 5. Start the Development Server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.

## Production Build

To create a production build:

```bash
pnpm build
pnpm start
```

## Project Structure

```
client/
├── prisma/               # Database schema and migrations
├── public/               # Static assets
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions and shared code
│   ├── providers/        # React context providers
│   └── types/            # TypeScript type definitions
├── .env                  # Environment variables
├── next.config.mjs       # Next.js configuration
├── package.json          # Project dependencies
└── tailwind.config.ts    # Tailwind CSS configuration
```

## Key Features

- **Web3 Integration**: Connect with cryptocurrency wallets via WalletConnect and interact with smart contracts
- **Match Creation**: Create 1v1, 2v2, or 5v5 matches with stakes
- **Responsive Design**: Mobile-friendly UI built with Tailwind CSS
- **Real-time Updates**: Track match status changes and notifications

## Available Scripts

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint to check code quality

## Troubleshooting

### Database Connection Issues

If you encounter database connection problems:

1. Check that your PostgreSQL server is running
2. Verify the `DATABASE_URL` and `DIRECT_URL` in your `.env` file
3. Run `pnpm prisma db push` to ensure schema is up to date

### Web3 Connection Issues

If wallet connection fails:

1. Verify your `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` is correct
2. Check that you're using a supported wallet and browser
3. Make sure you're connected to the Base Sepolia testnet

## Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add some amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## License

This project is licensed under the MIT License.
