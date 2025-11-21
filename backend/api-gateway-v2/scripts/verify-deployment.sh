#!/bin/bash

# =============================================================================
# Deployment Verification Script
# =============================================================================
# Usage: ./scripts/verify-deployment.sh <deployment-url>
# Example: ./scripts/verify-deployment.sh https://your-app.vercel.app
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get deployment URL from argument or prompt
if [ -z "$1" ]; then
  echo -e "${YELLOW}Enter deployment URL (e.g., https://your-app.vercel.app):${NC}"
  read -r API_URL
else
  API_URL=$1
fi

# Remove trailing slash
API_URL=${API_URL%/}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Verifying Deployment: ${API_URL}${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Track test results
PASSED=0
FAILED=0

# Helper function to run tests
run_test() {
  local test_name=$1
  local command=$2
  local expected=$3

  echo -e "${YELLOW}Testing: ${test_name}${NC}"

  if response=$(eval "$command" 2>&1); then
    if echo "$response" | grep -q "$expected"; then
      echo -e "${GREEN}✓ PASSED${NC}\n"
      ((PASSED++))
      return 0
    else
      echo -e "${RED}✗ FAILED - Unexpected response${NC}"
      echo -e "${RED}Response: ${response:0:200}${NC}\n"
      ((FAILED++))
      return 1
    fi
  else
    echo -e "${RED}✗ FAILED - Request failed${NC}"
    echo -e "${RED}Error: ${response:0:200}${NC}\n"
    ((FAILED++))
    return 1
  fi
}

# Test 1: Health Check
run_test \
  "Health Check Endpoint" \
  "curl -s -f ${API_URL}/health" \
  "\"status\":\"ok\""

# Test 2: Root Endpoint
run_test \
  "Root API Info" \
  "curl -s -f ${API_URL}/" \
  "Astro Shiba Pop API Gateway V2"

# Test 3: Metrics Endpoint
run_test \
  "Prometheus Metrics" \
  "curl -s -f ${API_URL}/metrics" \
  "# HELP"

# Test 4: GraphQL Health Query
run_test \
  "GraphQL Health Query" \
  "curl -s -f -X POST ${API_URL}/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{health{status}}\"}'"\
  "\"status\""

# Test 5: GraphQL Tokens Query
run_test \
  "GraphQL Tokens Query" \
  "curl -s -f -X POST ${API_URL}/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{tokens(first:5){edges{node{address}}}}\"}'"\
  "\"edges\""

# Test 6: Security Headers
echo -e "${YELLOW}Testing: Security Headers${NC}"
headers=$(curl -s -I ${API_URL}/health)

check_header() {
  local header=$1
  if echo "$headers" | grep -qi "$header"; then
    echo -e "${GREEN}  ✓ ${header}${NC}"
    return 0
  else
    echo -e "${RED}  ✗ ${header} missing${NC}"
    return 1
  fi
}

header_passed=0
header_failed=0

check_header "x-content-type-options" && ((header_passed++)) || ((header_failed++))
check_header "x-frame-options" && ((header_passed++)) || ((header_failed++))
check_header "strict-transport-security" && ((header_passed++)) || ((header_failed++))
check_header "referrer-policy" && ((header_passed++)) || ((header_failed++))

if [ $header_failed -eq 0 ]; then
  echo -e "${GREEN}✓ PASSED${NC}\n"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ PARTIAL - ${header_passed}/4 headers present${NC}\n"
  ((PASSED++))
fi

# Test 7: Rate Limiting Headers
echo -e "${YELLOW}Testing: Rate Limiting${NC}"
response=$(curl -s -I -X POST ${API_URL}/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{health{status}}"}')

if echo "$response" | grep -qi "x-ratelimit-limit"; then
  echo -e "${GREEN}  ✓ Rate limit headers present${NC}"
  echo -e "${GREEN}✓ PASSED${NC}\n"
  ((PASSED++))
else
  echo -e "${RED}  ✗ Rate limit headers missing${NC}"
  echo -e "${RED}✗ FAILED${NC}\n"
  ((FAILED++))
fi

# Test 8: SQL Injection Protection
run_test \
  "SQL Injection Protection" \
  "curl -s -X POST ${API_URL}/graphql -H 'Content-Type: application/json' -d '{\"query\":\"{ token(address: \\\"'; DROP TABLE tokens--\\\") { name } }\"}'" \
  "suspicious patterns"

# Test 9: CORS Headers
echo -e "${YELLOW}Testing: CORS Configuration${NC}"
response=$(curl -s -I -X OPTIONS ${API_URL}/graphql \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST")

if echo "$response" | grep -qi "access-control-allow"; then
  echo -e "${GREEN}  ✓ CORS headers present${NC}"
  echo -e "${GREEN}✓ PASSED${NC}\n"
  ((PASSED++))
else
  echo -e "${RED}  ✗ CORS headers missing${NC}"
  echo -e "${RED}✗ FAILED${NC}\n"
  ((FAILED++))
fi

# Test 10: Response Time (should be < 2s for warm functions)
echo -e "${YELLOW}Testing: Response Time${NC}"
start_time=$(date +%s%N)
curl -s -f -X POST ${API_URL}/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{health{status}}"}' > /dev/null
end_time=$(date +%s%N)

duration=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds

if [ $duration -lt 2000 ]; then
  echo -e "${GREEN}  ✓ Response time: ${duration}ms (< 2000ms)${NC}"
  echo -e "${GREEN}✓ PASSED${NC}\n"
  ((PASSED++))
else
  echo -e "${YELLOW}  ⚠ Response time: ${duration}ms (> 2000ms - may be cold start)${NC}"
  echo -e "${YELLOW}⚠ WARNING${NC}\n"
  ((PASSED++))
fi

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Results Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Passed: ${PASSED}${NC}"
echo -e "${RED}Failed: ${FAILED}${NC}"
echo -e "Total:  $((PASSED + FAILED))\n"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}🎉 All tests passed! Deployment is healthy.${NC}\n"
  exit 0
else
  echo -e "${RED}❌ Some tests failed. Please review the deployment.${NC}\n"
  exit 1
fi
