# Wallet Signature Helper

A React component that helps users generate wallet signatures for linking their Discord accounts to their Ethereum wallets.

## Features

- 🔗 **Wallet Connection**: Automatically connects to user's Web3 wallet
- ✍️ **Signature Generation**: One-click signature generation
- 📋 **Copy to Clipboard**: Easy copying of messages, signatures, and commands
- 🎯 **Discord Integration**: Generates complete Discord commands
- 📱 **Responsive Design**: Works on desktop and mobile
- 🛡️ **Security**: Validates wallet ownership through signatures

## Usage

### Basic Usage

```tsx
import { WalletSignatureHelper } from "@/components/WalletSignatureHelper";

function MyPage() {
  return (
    <div>
      <h1>Link Your Wallet to Discord</h1>
      <WalletSignatureHelper />
    </div>
  );
}
```

### With Specific Discord ID

```tsx
import { WalletSignatureHelper } from "@/components/WalletSignatureHelper";

function MyPage() {
  return (
    <div>
      <h1>Link Your Wallet to Discord</h1>
      <WalletSignatureHelper discordId="123456789" />
    </div>
  );
}
```

## How It Works

1. **Connect Wallet**: User connects their Web3 wallet (MetaMask, etc.)
2. **Generate Message**: Component creates a message to sign: `Link Discord account {discord_id} to wallet {wallet_address}`
3. **Sign Message**: User clicks "Sign Message" to generate a signature
4. **Copy Command**: Component generates the complete Discord command
5. **Use in Discord**: User copies and pastes the command in Discord

## Message Format

The message that gets signed follows this format:
```
Link Discord account {discord_id} to wallet {wallet_address}
```

## Discord Command Format

The generated Discord command:
```
/link-wallet {wallet_address} {signature}
```

## Security

- **Wallet Ownership**: Only the wallet owner can generate valid signatures
- **Message Specificity**: Each message includes the specific Discord ID and wallet address
- **No Storage**: Signatures are not stored, only generated for immediate use
- **Client-Side**: All signature generation happens in the user's browser

## Error Handling

- **Wallet Not Connected**: Shows instructions to connect wallet
- **Wallet Not Available**: Shows instructions to install MetaMask
- **Signature Failed**: Shows error message and retry option
- **Copy Failed**: Shows fallback instructions

## Dependencies

- `@/lib/hooks/useWalletConnection` - Wallet connection hook
- `@/components/ui/button` - UI button component
- `@/components/ui/card` - UI card component
- `@/components/ui/input` - UI input component
- `@/components/ui/label` - UI label component
- `@/hooks/use-toast` - Toast notification hook
- `lucide-react` - Icons

## Browser Support

- Requires Web3 wallet (MetaMask, WalletConnect, etc.)
- Requires `window.ethereum` object
- Modern browsers with clipboard API support

## Integration Points

- **Navigation**: Added to navbar as "Link Wallet"
- **Home Page**: Featured in welcome section
- **Matches Page**: Banner encouraging wallet linking
- **Footer**: Link in platform section
- **Dedicated Page**: `/wallet-signature` route

## Customization

The component can be customized by:

- Passing a specific `discordId` prop
- Styling with CSS classes
- Modifying the message format
- Adding additional validation

## Example Output

When a user completes the process, they get:

1. **Wallet Address**: `0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6`
2. **Message to Sign**: `Link Discord account 123456789 to wallet 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6`
3. **Generated Signature**: `0x1234567890abcdef...`
4. **Discord Command**: `/link-wallet 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6 0x1234567890abcdef...`

## Troubleshooting

### Common Issues

1. **"Wallet Not Connected"**
   - Ensure user has connected their wallet
   - Check if wallet extension is installed

2. **"Signature Failed"**
   - User may have rejected the signature request
   - Check wallet permissions

3. **"Copy Failed"**
   - Browser may not support clipboard API
   - User can manually copy the text

### Support

For issues with the component, check:
- Browser console for errors
- Wallet extension status
- Network connectivity
- Component props and dependencies 