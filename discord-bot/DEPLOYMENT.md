# Discord Bot Server Deployment Guide

## Prerequisites

1. **Server/VPS**: Ubuntu 20.04+ recommended (DigitalOcean, AWS, etc.)
2. **Domain Name**: For SSL certificates (optional but recommended)
3. **Discord Bot Token**: Already configured
4. **Environment Variables**: All required variables ready

## Server Setup

### 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3.9+
sudo apt install python3.9 python3.9-venv python3.9-dev -y

# Install Node.js (for Prisma)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Git
sudo apt install git -y
```

### 2. Clone Repository

```bash
# Clone your repository
git clone https://github.com/your-username/your-repo.git
cd your-repo/bot/discord-bot

# Install Python dependencies
python3.9 -m venv venv
source venv/bin/activate
pip install poetry
poetry install

# Install Node.js dependencies for Prisma
npm install
```

### 3. Environment Configuration

Create a `.env` file:

```bash
# Discord Bot
DISCORD_TOKEN=your_discord_token
DISCORD_GUILD_ID=your_guild_id

# Database
DATABASE_URL=your_supabase_database_url
DIRECT_URL=your_supabase_direct_url

# Web3
PRIVATE_KEY=your_private_key
CONTRACT_ADDRESS=your_contract_address
RPC_URL=your_rpc_url

# Frontend URL (Vercel deployment)
FRONTEND_URL=https://your-project.vercel.app

# API Configuration
API_BASE_URL=http://localhost:3000
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (if needed)
npx prisma db push
```

### 5. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'insertcoin-bot',
    script: 'poetry',
    args: 'run python -m src.bot.main',
    cwd: '/path/to/your/bot/discord-bot',
    env: {
      NODE_ENV: 'production',
      PYTHONPATH: '/path/to/your/bot/discord-bot'
    },
    env_file: '.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

### 6. Start the Bot

```bash
# Create logs directory
mkdir logs

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Monitoring & Maintenance

### PM2 Commands

```bash
# Check status
pm2 status

# View logs
pm2 logs insertcoin-bot

# Restart bot
pm2 restart insertcoin-bot

# Stop bot
pm2 stop insertcoin-bot

# Monitor resources
pm2 monit
```

### Log Management

```bash
# View recent logs
tail -f logs/combined.log

# View error logs
tail -f logs/error.log
```

## Security Considerations

### 1. Firewall Setup

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. SSL Certificate (Optional)

```bash
# Install Certbot
sudo apt install certbot -y

# Get SSL certificate
sudo certbot certonly --standalone -d your-domain.com
```

### 3. Environment Security

- Store `.env` file securely
- Use strong passwords
- Regularly rotate API keys
- Monitor for unauthorized access

## Backup Strategy

### 1. Database Backups

```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql
gzip backup_$DATE.sql
# Upload to cloud storage (AWS S3, etc.)
EOF

chmod +x backup.sh

# Add to crontab for daily backups
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

### 2. Configuration Backups

```bash
# Backup important files
tar -czf config_backup_$(date +%Y%m%d).tar.gz .env ecosystem.config.js
```

## Troubleshooting

### Common Issues

1. **Bot not starting**
   - Check logs: `pm2 logs insertcoin-bot`
   - Verify environment variables
   - Check Discord token validity

2. **Database connection issues**
   - Verify DATABASE_URL
   - Check network connectivity
   - Ensure Prisma client is generated

3. **Memory issues**
   - Monitor with `pm2 monit`
   - Increase max_memory_restart if needed
   - Check for memory leaks

### Performance Optimization

1. **Resource monitoring**
   ```bash
   # Monitor CPU/Memory
   htop
   
   # Monitor disk usage
   df -h
   ```

2. **Log rotation**
   ```bash
   # Install logrotate
   sudo apt install logrotate
   
   # Configure log rotation for PM2 logs
   ```

## Updates & Maintenance

### 1. Update Bot

```bash
# Pull latest changes
git pull origin main

# Update dependencies
poetry install
npm install

# Restart bot
pm2 restart insertcoin-bot
```

### 2. System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Node.js if needed
sudo npm update -g pm2
```

## Support

- Check PM2 logs for errors
- Monitor Discord bot status
- Keep backups of configuration
- Document any custom changes 