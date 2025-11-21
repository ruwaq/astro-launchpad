# SAC Factory - Quickstart Guide (Testnet)

Guía rápida para probar el SAC Factory en Stellar Testnet.

---

## 🚀 Información del Contrato Deployado

**Contract ID**: `CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM`

**Explorer**: https://stellar.expert/explorer/testnet/contract/CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM

---

## 📋 Setup Rápido (5 minutos)

### 1. Instalar Stellar CLI

```bash
cargo install --locked stellar-cli
```

### 2. Generar Identidad

```bash
# Generar tu propia identidad
stellar keys generate mi_identidad --network testnet

# Ver tu dirección
stellar keys address mi_identidad

# Copiar la dirección (empieza con G...)
```

### 3. Obtener XLM de Testnet

```bash
# Reemplaza TU_DIRECCION con la que copiaste arriba
curl "https://friendbot.stellar.org?addr=TU_DIRECCION"
```

---

## 🎯 Usar el SAC Factory

### Lanzar Tu Propio Token

```bash
stellar contract invoke \
  --id CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM \
  --source mi_identidad \
  --network testnet \
  -- launch_token \
  --creator TU_DIRECCION \
  --name "Mi Token Increible" \
  --symbol "MTI" \
  --image_url "ipfs://QmYourImageHash" \
  --description "El mejor meme token del mundo!"
```

**Resultado**: Recibirás una dirección de token (empieza con C...)

### Comprar Tokens

```bash
# Comprar con 100 XLM (100 * 10^7 stroops = 1000000000)
stellar contract invoke \
  --id CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM \
  --source mi_identidad \
  --network testnet \
  -- buy \
  --buyer TU_DIRECCION \
  --token TOKEN_ADDRESS \
  --xlm_amount "1000000000" \
  --min_tokens "0"
```

### Ver Precio Actual

```bash
stellar contract invoke \
  --id CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM \
  --source mi_identidad \
  --network testnet \
  -- get_price \
  --token TOKEN_ADDRESS
```

### Ver Progreso de Graduación

```bash
stellar contract invoke \
  --id CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM \
  --source mi_identidad \
  --network testnet \
  -- get_graduation_progress \
  --token TOKEN_ADDRESS
```

**Resultado**: Un número de 0 a 10000
- 0 = 0%
- 5000 = 50%
- 10000 = 100% (graduado)

### Ver Información del Token

```bash
stellar contract invoke \
  --id CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM \
  --source mi_identidad \
  --network testnet \
  -- get_token_info \
  --token TOKEN_ADDRESS
```

### Vender Tokens

```bash
# Vender 1000 tokens (1000 * 10^7 = 10000000000)
stellar contract invoke \
  --id CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM \
  --source mi_identidad \
  --network testnet \
  -- sell \
  --seller TU_DIRECCION \
  --token TOKEN_ADDRESS \
  --token_amount "10000000000" \
  --min_xlm "0"
```

---

## 📊 Entendiendo los Números

### Stroops
Stellar usa "stroops" como la unidad más pequeña:
- 1 XLM = 10,000,000 stroops
- 100 XLM = 1,000,000,000 stroops

### Tokens
Los tokens usan 7 decimales:
- 1 token = 10,000,000 unidades
- 1,000 tokens = 10,000,000,000 unidades

### Conversiones Rápidas

| XLM | Stroops |
|-----|---------|
| 0.01 | 100,000 |
| 0.1 | 1,000,000 |
| 1 | 10,000,000 |
| 10 | 100,000,000 |
| 100 | 1,000,000,000 |
| 1000 | 10,000,000,000 |

---

## 🎓 Conceptos Clave

### Bonding Curve
- El precio sube automáticamente cuando compras
- El precio baja automáticamente cuando vendes
- Fórmula: x * y = k (constant product)

### Graduación
- Ocurre automáticamente a 10,000 XLM raised
- El token se mueve a un AMM (próximamente)
- La liquidez se bloquea permanentemente

### Fair Launch
- No hay presale
- El creador compra como todos
- Todos tienen la misma oportunidad

---

## 🔍 Verificar Transacciones

Todas las transacciones se pueden ver en:

https://stellar.expert/explorer/testnet

Busca por:
- Tu dirección
- El contract ID
- El token address

---

## ⚡ Tips y Trucos

### 1. Siempre usa `--network testnet`
Si no lo especificas, puede fallar.

### 2. Guarda las direcciones
Cada token tiene una dirección única que necesitarás para interactuar.

### 3. Prueba con pequeñas cantidades primero
Empieza con 10-100 XLM para probar.

### 4. Revisa los eventos
Cada transacción emite eventos que puedes ver en el output.

### 5. Slippage protection
Usa `min_tokens` al comprar y `min_xlm` al vender para protegerte.

---

## 🐛 Troubleshooting

### Error: "Account not found"
**Solución**: Tu cuenta necesita fondos
```bash
curl "https://friendbot.stellar.org?addr=TU_DIRECCION"
```

### Error: "Invalid argument"
**Solución**: Verifica que estés usando las comillas correctas para los argumentos

### Error: "Slippage exceeded"
**Solución**: Baja tu `min_tokens_out` o espera a que el precio se estabilice

### Error: "Token not found"
**Solución**: Verifica que la dirección del token sea correcta

---

## 📞 Soporte

Si encuentras problemas:

1. Verifica que estés en testnet
2. Verifica que tu cuenta tenga fondos
3. Verifica los argumentos (direcciones, cantidades)
4. Revisa el explorer para ver el estado de la transacción

---

## 🎉 Ejemplo Completo

Aquí un flujo completo de principio a fin:

```bash
# 1. Generar identidad
stellar keys generate test_user --network testnet

# 2. Obtener dirección
MY_ADDRESS=$(stellar keys address test_user)
echo "Mi dirección: $MY_ADDRESS"

# 3. Obtener fondos
curl "https://friendbot.stellar.org?addr=$MY_ADDRESS"

# 4. Lanzar token
TOKEN=$(stellar contract invoke \
  --id CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM \
  --source test_user \
  --network testnet \
  -- launch_token \
  --creator $MY_ADDRESS \
  --name "Shiba Moon" \
  --symbol "SHMOON" \
  --image_url "ipfs://QmTest" \
  --description "To the moon!")

echo "Token creado: $TOKEN"

# 5. Ver precio
stellar contract invoke \
  --id CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM \
  --source test_user \
  --network testnet \
  -- get_price \
  --token $TOKEN

# 6. Comprar tokens (100 XLM)
stellar contract invoke \
  --id CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM \
  --source test_user \
  --network testnet \
  -- buy \
  --buyer $MY_ADDRESS \
  --token $TOKEN \
  --xlm_amount "1000000000" \
  --min_tokens "0"

# 7. Ver progreso
stellar contract invoke \
  --id CC2QB7WZQLNJXTRS6X7MQMUCAXM5FEN3J5IJAS5SBNFPXQIOG7BYEFFM \
  --source test_user \
  --network testnet \
  -- get_graduation_progress \
  --token $TOKEN
```

---

**¡Diviértete creando meme tokens en Stellar!** 🚀🐕
