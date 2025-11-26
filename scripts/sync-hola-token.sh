#!/bin/bash
# Sync HOLA token to database

curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -H "apollo-require-preflight: true" \
  -d '{"query":"mutation SyncToken($tokenAddress: String!) { syncToken(tokenAddress: $tokenAddress) { id address name symbol } }","variables":{"tokenAddress":"CBITJZL7TC25WJKALVVPPMZUBHBOET6WLDUX3GWBNHZEIALQOYI7AB5F"}}' | jq .
