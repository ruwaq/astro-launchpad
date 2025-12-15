# Deploy Indexer on Oracle Cloud (Always Free)

## Prerequisites

- Oracle Cloud account (free)
- SSH key pair

## Step 1: Create VM Instance

1. Go to [Oracle Cloud Console](https://cloud.oracle.com)
2. Navigate to **Compute** → **Instances** → **Create Instance**

### Configuration:

| Setting | Value |
|---------|-------|
| Name | `astro-indexer` |
| Compartment | Your compartment |
| Placement | AD-1 (any availability domain) |
| Image | Ubuntu 22.04 |
| Shape | `VM.Standard.A1.Flex` (Always Free ARM) |
| OCPUs | 1-2 |
| Memory | 6-12 GB |
| VCN | Create new or use existing |
| Subnet | Public subnet |
| Public IP | Assign |
| SSH Key | Upload your public key |

3. Click **Create**
4. Wait for instance to be **Running**

## Step 2: Configure Firewall (Optional)

If you want to access metrics endpoint (port 9090):

1. Go to **Networking** → **Virtual Cloud Networks**
2. Select your VCN → **Security Lists**
3. Add Ingress Rule:
   - Source: `0.0.0.0/0`
   - Protocol: TCP
   - Port: 9090

## Step 3: Connect to VM

```bash
ssh -i ~/.ssh/your_private_key ubuntu@<PUBLIC_IP>
```

## Step 4: Run Setup Script

```bash
# Download and run setup script
curl -fsSL https://raw.githubusercontent.com/nunalabs/astro-launchpad/main/backend/indexer/deploy/oracle-cloud-setup.sh | bash
```

Or manually:

```bash
# Update system
sudo apt-get update && sudo apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs git build-essential

# Install pnpm
sudo npm install -g pnpm

# Clone repo
sudo mkdir -p /opt/astro-indexer
sudo chown $USER:$USER /opt/astro-indexer
cd /opt/astro-indexer
git clone https://github.com/nunalabs/astro-launchpad.git .

# Install and build
pnpm install --filter @astroshibapop/indexer --filter @astroshibapop/shared
cd backend/indexer
pnpm build
```

## Step 5: Configure Environment

```bash
nano /opt/astro-indexer/backend/indexer/.env
```

Add your environment variables:

```env
# Database - Supabase
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres

# Redis - Upstash
REDIS_URL=https://YOUR_REDIS.upstash.io
REDIS_TOKEN=YOUR_REDIS_TOKEN

# Stellar Network
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_PASSPHRASE=Test SDF Network ; September 2015

# Contracts
SAC_FACTORY_CONTRACT_ID=CAETFO74SF5GSPA2SCUIR6P5XET6ASEMQPESLRWNWRDC37UX32HBKEMK
TOKEN_FACTORY_CONTRACT_ID=CAETFO74SF5GSPA2SCUIR6P5XET6ASEMQPESLRWNWRDC37UX32HBKEMK
XLM_SAC_ADDRESS=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

# Indexer Config
INDEXER_START_LEDGER=latest
INDEXER_POLL_INTERVAL=5000
INDEXER_BATCH_SIZE=100

# Logging
LOG_LEVEL=info
NODE_ENV=production

# Metrics
ENABLE_METRICS=true
METRICS_PORT=9090
```

## Step 6: Test Manually

```bash
cd /opt/astro-indexer/backend/indexer
pnpm start
```

You should see:
```
🚀 Starting AstroShibaPop Indexer v2.0...
✓ Database connected
📦 Running bootstrap sync...
✓ Bootstrap complete: X created, Y updated
✓ Optimized indexer running
✓ Metrics server listening on port 9090
```

Press `Ctrl+C` to stop.

## Step 7: Setup Systemd Service (Auto-start)

```bash
# Copy service file
sudo cp /opt/astro-indexer/backend/indexer/deploy/astro-indexer.service /etc/systemd/system/

# Copy env file for systemd
sudo cp /opt/astro-indexer/backend/indexer/.env /etc/astro-indexer.env
sudo chmod 600 /etc/astro-indexer.env

# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable astro-indexer

# Start the service
sudo systemctl start astro-indexer

# Check status
sudo systemctl status astro-indexer
```

## Step 8: View Logs

```bash
# Follow logs in real-time
sudo journalctl -u astro-indexer -f

# View last 100 lines
sudo journalctl -u astro-indexer -n 100
```

## Useful Commands

```bash
# Restart indexer
sudo systemctl restart astro-indexer

# Stop indexer
sudo systemctl stop astro-indexer

# Check health
curl http://localhost:9090/health

# Check metrics
curl http://localhost:9090/metrics

# Update code
cd /opt/astro-indexer
git pull
cd backend/indexer
pnpm build
sudo systemctl restart astro-indexer
```

## Troubleshooting

### "Out of capacity" error when creating VM
ARM instances are popular. Try:
1. Different availability domain (AD-2, AD-3)
2. Different region
3. Try again later (capacity changes)

### Database connection error
- Verify DATABASE_URL is correct
- Check Supabase allows connections from Oracle Cloud IP
- Add IP to Supabase allowlist if needed

### Indexer crashes
```bash
# Check logs for errors
sudo journalctl -u astro-indexer -n 200 --no-pager
```

## Cost: $0

This setup uses:
- VM.Standard.A1.Flex (Always Free)
- Supabase PostgreSQL (your existing)
- Upstash Redis (your existing)

**Total monthly cost: $0**
