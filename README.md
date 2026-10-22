# Astro Launchpad (Minimal MVP)

Launchpad + AMM sobre Stellar/Soroban, minimalista y escalable.

Ver `PLAN.md` para arquitectura y roadmap.

## Dev rápido
```bash
dev-up            # Postgres + Redis
# (cuando Stellar CLI esté listo)
stellar scaffold init . --template react
```

## Servicios locales
- Postgres: localhost:5432 (db `astro_launchpad`, user `astro`)
- Redis: localhost:6379
EOF
cat > /data/data/com.termux/files/home/projects/astro-launchpad/.env.example <<'EOF'
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

SOROSWAP_FACTORY=CDP3HMUH6SMS3S7NPGNDJLULCOXXEPSHY4JKUKMBNQMATHDHWXRRJTBY
SOROSWAP_ROUTER=CCJUD55AG6W5HAI5LRVNKAE5WDP5XGZBUDS5WNTIVDU7O264UZZE7BRD
XLM_SAC=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC

DATABASE_URL=postgresql://astro:astro@localhost:5432/astro_launchpad
REDIS_URL=redis://localhost:6379

API_PORT=4000
EOF
echo "done"