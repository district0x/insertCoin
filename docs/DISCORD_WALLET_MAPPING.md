# Discord ID to Wallet Mapping System

This document describes the robust Discord ID to wallet address mapping system implemented in the OneVOne platform.

## Overview

The system enforces a **1:1 mapping** between Discord IDs and Ethereum wallet addresses to ensure:
- Fair play and prevent multi-accounting
- Accurate tracking of user statistics
- Secure and reliable user identity management
- Seamless integration between Discord and blockchain operations

## Database Schema

### User Table Structure

```sql
model User {
  id            String    @id @default(uuid())
  address       String?   @unique // Ethereum address
  discordId     String?   @unique // Discord user ID
  username      String?   @unique
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  // Stats and profile
  totalMatches  Int       @default(0)
  totalWins     Int       @default(0)
  totalLosses   Int       @default(0)
  
  // Relations
  matchesCreated    Match[]    @relation("Creator")
  participatedMatches Match[]  @relation("Participant")
  tournamentsJoined Tournament[] @relation("TournamentParticipant")
  teamMemberships   TeamMember[]
}
```

### Key Constraints

- `address` field has a unique constraint
- `discordId` field has a unique constraint
- This ensures one Discord account = one wallet address

## Discord Bot Commands

### `/link-wallet <wallet_address> [signature]`

Links a Discord account to an Ethereum wallet address with optional signature verification.

**Features:**
- Validates wallet address format (0x...)
- Optional signature verification for enhanced security
- Prevents duplicate mappings
- Handles existing users gracefully
- Provides clear feedback and next steps

**Usage:**
```
# Without signature (shows instructions)
/link-wallet 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6

# With signature (immediate linking)
/link-wallet 0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6 0x1234...
```

**Signature Verification:**
When no signature is provided, the bot will show instructions for generating one:
1. The message to sign: `Link Discord account {discord_id} to wallet {wallet_address}`
2. Instructions for signing with MetaMask or other wallets
3. The complete command to use with the signature

**Response:**
- ✅ Success: Wallet linked successfully
- ❌ Error: Invalid format, already linked, or conflicts
- 🔐 Instructions: How to generate and use signature

### `/unlink-wallet`

Unlinks a Discord account from its wallet address.

**Features:**
- Checks for active matches before unlinking
- Preserves user statistics and match history
- Allows re-linking to a different wallet later

**Usage:**
```
/unlink-wallet
```

### `/profile`

Displays user profile and match statistics.

**Features:**
- Shows linked wallet address
- Displays match statistics (wins, losses, win rate)
- Lists recent matches with status
- Provides quick access to other commands

**Usage:**
```
/profile
```

### `/wallet-info`

Shows detailed information about the linked wallet.

**Features:**
- Full wallet address display
- Link date and last update
- Available actions (unlink, profile, create match)

**Usage:**
```
/wallet-info
```

### `/help`

Displays comprehensive help information.

**Features:**
- Lists all available commands
- Provides usage tips
- Explains the 1:1 mapping concept

**Usage:**
```
/help
```

## Wallet Signature Helper

### Frontend Component

A React component is available to help users generate signatures:

**Location:** `client/src/components/WalletSignatureHelper.tsx`

**Features:**
- Connect wallet and generate signatures
- Copy message and signature to clipboard
- Generate complete Discord command
- Step-by-step instructions

**Usage:**
```tsx
import { WalletSignatureHelper } from "@/components/WalletSignatureHelper";

// Basic usage
<WalletSignatureHelper />

// With specific Discord ID
<WalletSignatureHelper discordId="123456789" />
```

### Signature Helper Page

A dedicated page is available at `/wallet-signature` that provides:
- Interactive signature generation
- Security explanations
- Step-by-step instructions
- Discord command examples

## Signature Verification Process

### Message Format

The message to sign follows this format:
```
Link Discord account {discord_id} to wallet {wallet_address}
```

### Verification Steps

1. **User generates signature** using their wallet
2. **Bot verifies signature** using Web3 recovery
3. **Address comparison** ensures the signer owns the wallet
4. **Linking proceeds** if verification passes

### Security Benefits

- **Prevents unauthorized linking**: Only wallet owners can link their address
- **Prevents impersonation**: Cannot link someone else's wallet
- **Maintains integrity**: Ensures 1:1 mapping is enforced
- **Audit trail**: All linking operations are logged

## Database Cleanup

### Cleanup Script

The `cleanup_duplicates.py` script ensures database integrity:

```bash
# Run dry run to check for issues
python bot/discord-bot/scripts/cleanup_duplicates.py

# Run actual cleanup (after reviewing dry run)
# Modify the script to set dry_run=False
```

**What it fixes:**
- Duplicate Discord IDs
- Duplicate wallet addresses
- Orphaned user records

### Manual Cleanup Commands

```sql
-- Find duplicate Discord IDs
SELECT discordId, COUNT(*) as count
FROM "User"
WHERE discordId IS NOT NULL
GROUP BY discordId
HAVING COUNT(*) > 1;

-- Find duplicate wallet addresses
SELECT address, COUNT(*) as count
FROM "User"
WHERE address IS NOT NULL
GROUP BY address
HAVING COUNT(*) > 1;

-- Find orphaned users (no Discord ID and no wallet)
SELECT * FROM "User"
WHERE discordId IS NULL AND address IS NULL;
```

## User Statistics Tracking

### Stats Fields

- `totalMatches`: Total number of matches participated in
- `totalWins`: Number of matches won
- `totalLosses`: Number of matches lost
- Win rate calculated as: `(totalWins / totalMatches) * 100`

### Stats Updates

Stats are automatically updated when:
- A match is completed
- Winner and loser are determined
- Match status changes to "COMPLETED"

### Stats Access

Stats can be accessed via:
- Discord bot `/profile` command
- Frontend user profile pages
- API endpoints for external integrations

## Integration Points

### Match Creation Flow

1. **Discord-initiated matches:**
   - User creates match via Discord bot
   - Match created with `creatorDiscordId`
   - User links wallet via frontend
   - `updateMatchWithWallet()` links Discord ID to wallet

2. **Frontend-initiated matches:**
   - User creates match via web interface
   - Match created with wallet address
   - User can link Discord ID later via bot

### User Identification

The system uses the following priority for user identification:
1. User ID (primary key)
2. Discord ID (if linked)
3. Wallet address (if linked)

## Security Considerations

### Wallet Verification

- Wallet addresses are validated for proper format
- **Signature verification** proves wallet ownership
- Users can prove ownership by signing specific messages
- Prevents unauthorized wallet linking

### Access Control

- Users can only unlink their own wallet
- Active matches prevent wallet unlinking
- All operations are logged for audit purposes

### Data Integrity

- Unique constraints prevent duplicate mappings
- Regular cleanup scripts maintain data quality
- Validation functions check mapping integrity

## Error Handling

### Common Error Scenarios

1. **Wallet already linked to another Discord account**
   - Error: "This wallet is already linked to another Discord account"
   - Solution: Use a different wallet or contact support

2. **Discord account already linked to another wallet**
   - Error: "Your Discord account is already linked to a different wallet"
   - Solution: Use `/unlink-wallet` first, then link new wallet

3. **Invalid wallet address format**
   - Error: "Invalid wallet address format"
   - Solution: Provide a valid Ethereum address (0x...)

4. **Invalid signature**
   - Error: "Invalid signature. Please sign the correct message with your wallet"
   - Solution: Use the signature helper or follow the provided instructions

5. **Active matches prevent unlinking**
   - Error: "Cannot unlink wallet while you have active matches"
   - Solution: Complete or cancel active matches first

### Error Recovery

- All errors are logged with full context
- Users receive clear error messages
- Support can manually fix mapping issues if needed

## Best Practices

### For Users

1. **Link wallet early:** Link your wallet before creating matches
2. **Use signature verification:** Always sign messages for security
3. **Use consistent wallet:** Use the same wallet for all matches
4. **Keep Discord active:** Maintain your Discord account for notifications
5. **Check profile regularly:** Monitor your stats and match history

### For Developers

1. **Always validate mappings:** Check for conflicts before creating links
2. **Handle edge cases:** Consider users with partial data
3. **Log operations:** Track all mapping changes for debugging
4. **Test cleanup scripts:** Run cleanup regularly in development
5. **Implement signature verification:** Use signatures for enhanced security

### For Administrators

1. **Monitor mapping integrity:** Run validation checks regularly
2. **Backup before cleanup:** Always backup before running cleanup scripts
3. **Review conflicts:** Manually review any mapping conflicts
4. **Update documentation:** Keep this guide updated with changes
5. **Monitor signature usage:** Track signature verification success rates

## Troubleshooting

### Common Issues

**Q: User can't link wallet**
A: Check if wallet is already linked to another Discord account

**Q: Invalid signature error**
A: Ensure the user signed the exact message shown by the bot

**Q: Stats not updating**
A: Verify match completion and winner/loser assignment

**Q: Duplicate users in database**
A: Run cleanup script to identify and fix duplicates

**Q: Discord bot commands not working**
A: Check bot permissions and command registration

### Support Commands

```sql
-- Check user mapping status
SELECT id, discordId, address, totalMatches, totalWins, totalLosses
FROM "User"
WHERE discordId = 'YOUR_DISCORD_ID' OR address = 'YOUR_WALLET_ADDRESS';

-- Check for mapping conflicts
SELECT discordId, COUNT(*) as count
FROM "User"
WHERE discordId IS NOT NULL
GROUP BY discordId
HAVING COUNT(*) > 1;
```

## Future Enhancements

### Planned Features

1. **Enhanced signature verification:** Add timestamp and nonce to messages
2. **Multi-wallet support:** Allow linking multiple wallets per Discord account
3. **Advanced statistics:** Add more detailed match and performance metrics
4. **API endpoints:** Provide REST API for external integrations
5. **Audit trail:** Track all mapping changes with timestamps
6. **Signature caching:** Cache verified signatures for faster linking

### Integration Opportunities

1. **Collab.Land integration:** Leverage existing Discord verification tools
2. **NFT verification:** Link wallets based on NFT ownership
3. **Social features:** Add friend lists and match history sharing
4. **Tournament integration:** Enhanced tournament participant management
5. **Mobile app:** Native mobile signature generation

## Conclusion

The Discord ID to wallet mapping system provides a robust foundation for user identity management in the OneVOne platform. By enforcing 1:1 mappings, implementing signature verification, and providing comprehensive tools for management, the system ensures fair play, accurate statistics, and seamless user experience across Discord and blockchain operations.

For questions or support, please refer to the troubleshooting section or contact the development team. 