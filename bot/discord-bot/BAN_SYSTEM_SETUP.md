# Ban System Setup Guide

## Overview
The ban system provides comprehensive player moderation with Discord role restrictions and audit logging.

## Features
- **Database Ban**: Prevents banned players from creating matches
- **Discord Role**: Automatically restricts banned users from all channels
- **Audit Logging**: Tracks all admin actions in a private channel
- **Auto-Expiry**: Time-based bans automatically expire

## Setup Steps

### 1. Database Migration
Run the SQL migration to add ban fields:
```sql
-- Execute the contents of client/prisma/migrations/add_ban_system.sql
```

### 2. Discord Bot Permissions
Ensure your bot has these permissions:
- ✅ **Manage Roles** - To create and manage the Banned role
- ✅ **Manage Channels** - To create the audit-log channel
- ✅ **Administrator** - To access admin commands

### 3. Initial Setup Commands
After syncing commands, run these setup commands:

#### Setup Banned Role
```
/setup-banned-role
```
This will:
- Create a "Banned" role with dark red color
- Apply restrictive permissions to all existing channels
- Set up automatic permissions for new channels

#### Create Audit Channel
The audit-log channel is created automatically when you first use any admin command.

## Admin Commands

### Player Management
- `/ban <user> <reason> <duration>` - Ban a player
- `/unban <user>` - Unban a player
- `/player-info <user>` - View player details and ban status
- `/banned-players` - List all banned players

### System Setup
- `/setup-banned-role` - Configure Banned role permissions

## How It Works

### When a Player is Banned:
1. **Database**: User marked as banned with reason and expiry
2. **Discord Role**: "Banned" role applied to user
3. **Channel Access**: User loses access to all channels
4. **Match Creation**: Blocked from creating new matches
5. **Audit Log**: Action logged to audit-log channel

### When a Player is Unbanned:
1. **Database**: Ban status cleared
2. **Discord Role**: "Banned" role removed
3. **Channel Access**: Normal access restored
4. **Match Creation**: Can create matches again
5. **Audit Log**: Action logged to audit-log channel

### Automatic Features:
- **New Channels**: Banned role permissions automatically applied
- **Ban Expiry**: Time-based bans automatically expire
- **Audit Logging**: All admin actions automatically logged

## Ban Durations
- `24h` - 24 hours
- `7d` - 7 days  
- `30d` - 30 days
- `permanent` - No expiry (manual unban required)

## Security Features
- **Role-Based Access**: Only users with Administrator permission can use admin commands
- **Audit Trail**: Complete log of all moderation actions
- **Automatic Restrictions**: Banned users can't access any channels or create matches
- **Persistent Storage**: Ban history stored in database

## Troubleshooting

### Bot Can't Create Roles
- Check bot has "Manage Roles" permission
- Ensure bot role is above the Banned role in hierarchy

### Bot Can't Create Channels
- Check bot has "Manage Channels" permission
- Verify bot has permission in the target category

### Banned Users Still See Channels
- Run `/setup-banned-role` to apply permissions to all channels
- Check that the Banned role exists and has correct permissions

### Audit Log Not Working
- Check if audit-log channel exists
- Verify bot has permission to send messages in the channel
- Check bot logs for permission errors 