#!/bin/bash

# =============================================================================
# Pre-Deployment Checklist Script
# =============================================================================
# Verifies that the project is ready for deployment
# Usage: ./scripts/pre-deploy-check.sh
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Pre-Deployment Checklist${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Track results
PASSED=0
FAILED=0
WARNINGS=0

# Helper function to run checks
check_test() {
  local test_name=$1
  local command=$2

  echo -e "${YELLOW}Checking: ${test_name}${NC}"

  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}\n"
    ((PASSED++))
    return 0
  else
    echo -e "${RED}✗ FAILED${NC}\n"
    ((FAILED++))
    return 1
  fi
}

check_warning() {
  local test_name=$1
  local command=$2

  echo -e "${YELLOW}Checking: ${test_name}${NC}"

  if eval "$command" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASSED${NC}\n"
    ((PASSED++))
    return 0
  else
    echo -e "${YELLOW}⚠ WARNING${NC}\n"
    ((WARNINGS++))
    return 1
  fi
}

# Check 1: Node.js version
echo -e "${YELLOW}Checking: Node.js Version${NC}"
node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -ge 20 ]; then
  echo -e "${GREEN}✓ Node.js ${node_version}.x (>= 20)${NC}\n"
  ((PASSED++))
else
  echo -e "${RED}✗ Node.js ${node_version}.x (< 20)${NC}"
  echo -e "${RED}  Please upgrade to Node.js 20 or higher${NC}\n"
  ((FAILED++))
fi

# Check 2: Dependencies installed
check_test \
  "Dependencies Installed" \
  "[ -d node_modules ] && [ -n \"\$(ls -A node_modules 2>/dev/null)\" ]"

# Check 3: TypeScript compilation
check_test \
  "TypeScript Type Checking" \
  "pnpm typecheck"

# Check 4: Build succeeds
check_test \
  "Build Success" \
  "pnpm build"

# Check 5: Tests passing
echo -e "${YELLOW}Checking: Tests${NC}"
if pnpm test 2>&1 | grep -q "PASS"; then
  test_output=$(pnpm test 2>&1 | grep -E "Tests|tests")
  echo -e "${GREEN}✓ Tests passing${NC}"
  echo -e "${GREEN}  ${test_output}${NC}\n"
  ((PASSED++))
else
  echo -e "${RED}✗ Tests failing${NC}"
  echo -e "${RED}  Run 'pnpm test' to see details${NC}\n"
  ((FAILED++))
fi

# Check 6: Required environment variables documented
echo -e "${YELLOW}Checking: Environment Variables Documentation${NC}"
required_vars=(
  "DATABASE_URL"
  "DIRECT_DATABASE_URL"
  "KV_REST_API_URL"
  "KV_REST_API_TOKEN"
  "TOKEN_FACTORY_CONTRACT_ID"
  "STELLAR_RPC_URL"
)

missing_vars=()
for var in "${required_vars[@]}"; do
  if ! grep -q "$var" .env.example 2>/dev/null; then
    missing_vars+=("$var")
  fi
done

if [ ${#missing_vars[@]} -eq 0 ]; then
  echo -e "${GREEN}✓ All required vars in .env.example${NC}\n"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ Missing from .env.example: ${missing_vars[*]}${NC}\n"
  ((WARNINGS++))
fi

# Check 7: vercel.json exists and valid
echo -e "${YELLOW}Checking: Vercel Configuration${NC}"
if [ -f vercel.json ]; then
  if command -v jq >/dev/null 2>&1; then
    if jq empty vercel.json 2>/dev/null; then
      echo -e "${GREEN}✓ vercel.json is valid JSON${NC}\n"
      ((PASSED++))
    else
      echo -e "${RED}✗ vercel.json has invalid JSON${NC}\n"
      ((FAILED++))
    fi
  else
    echo -e "${GREEN}✓ vercel.json exists${NC}"
    echo -e "${YELLOW}  (install jq to validate JSON)${NC}\n"
    ((PASSED++))
  fi
else
  echo -e "${RED}✗ vercel.json missing${NC}\n"
  ((FAILED++))
fi

# Check 8: API handler exists
check_test \
  "Vercel API Handler" \
  "[ -f api/graphql.ts ]"

# Check 9: No console.log in src
echo -e "${YELLOW}Checking: Console Logs in Source${NC}"
console_logs=$(grep -r "console\.log" src/ 2>/dev/null | wc -l | tr -d ' ')
if [ "$console_logs" -eq 0 ]; then
  echo -e "${GREEN}✓ No console.log found${NC}\n"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ Found ${console_logs} console.log statements${NC}"
  echo -e "${YELLOW}  Consider removing or using logger instead${NC}\n"
  ((WARNINGS++))
fi

# Check 10: Security checks
echo -e "${YELLOW}Checking: Security Configuration${NC}"
security_passed=0
security_failed=0

# Check CORS configuration
if grep -q "origin:" src/app.ts 2>/dev/null; then
  echo -e "${GREEN}  ✓ CORS configured${NC}"
  ((security_passed++))
else
  echo -e "${RED}  ✗ CORS not configured${NC}"
  ((security_failed++))
fi

# Check Helmet
if grep -q "helmet" src/app.ts 2>/dev/null; then
  echo -e "${GREEN}  ✓ Helmet security headers${NC}"
  ((security_passed++))
else
  echo -e "${RED}  ✗ Helmet not found${NC}"
  ((security_failed++))
fi

# Check rate limiting
if grep -q "rate-limit" src/app.ts 2>/dev/null; then
  echo -e "${GREEN}  ✓ Rate limiting enabled${NC}"
  ((security_passed++))
else
  echo -e "${RED}  ✗ Rate limiting not found${NC}"
  ((security_failed++))
fi

if [ $security_failed -eq 0 ]; then
  echo -e "${GREEN}✓ Security checks passed (${security_passed}/3)${NC}\n"
  ((PASSED++))
else
  echo -e "${RED}✗ Security checks failed (${security_passed}/3)${NC}\n"
  ((FAILED++))
fi

# Check 11: Documentation exists
echo -e "${YELLOW}Checking: Documentation${NC}"
docs_count=0
required_docs=(
  "README.md"
  "DEPLOYMENT_GUIDE.md"
  "TESTING_GUIDE.md"
)

for doc in "${required_docs[@]}"; do
  if [ -f "$doc" ]; then
    ((docs_count++))
  fi
done

if [ $docs_count -eq ${#required_docs[@]} ]; then
  echo -e "${GREEN}✓ All documentation present (${docs_count}/${#required_docs[@]})${NC}\n"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ Missing documentation: $((${#required_docs[@]} - docs_count)) files${NC}\n"
  ((WARNINGS++))
fi

# Check 12: Git status
check_warning \
  "Git - No uncommitted changes" \
  "[ -z \"\$(git status --porcelain 2>/dev/null)\" ]"

# Check 13: Git - On main branch
check_warning \
  "Git - On main/master branch" \
  "git branch --show-current 2>/dev/null | grep -E '^(main|master)$'"

# Check 14: Package.json scripts
echo -e "${YELLOW}Checking: Package.json Scripts${NC}"
required_scripts=("dev" "build" "start" "test")
scripts_found=0

for script in "${required_scripts[@]}"; do
  if grep -q "\"$script\":" package.json 2>/dev/null; then
    ((scripts_found++))
  fi
done

if [ $scripts_found -eq ${#required_scripts[@]} ]; then
  echo -e "${GREEN}✓ All required scripts present${NC}\n"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠ Missing scripts: $((${#required_scripts[@]} - scripts_found))${NC}\n"
  ((WARNINGS++))
fi

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Checklist Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}✓ Passed:   ${PASSED}${NC}"
echo -e "${YELLOW}⚠ Warnings: ${WARNINGS}${NC}"
echo -e "${RED}✗ Failed:   ${FAILED}${NC}"
echo -e "Total:      $((PASSED + WARNINGS + FAILED))\n"

# Final verdict
if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}🎉 Perfect! Ready to deploy!${NC}"
  echo -e "${GREEN}Run: vercel --prod${NC}\n"
  exit 0
elif [ $FAILED -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Ready to deploy with warnings${NC}"
  echo -e "${YELLOW}Review warnings above, then run: vercel --prod${NC}\n"
  exit 0
else
  echo -e "${RED}❌ Not ready for deployment${NC}"
  echo -e "${RED}Fix the failed checks before deploying${NC}\n"
  exit 1
fi
