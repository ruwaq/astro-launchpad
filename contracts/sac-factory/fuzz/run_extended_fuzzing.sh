#!/bin/bash
# Extended Fuzzing Runner - 24+ Hours
# Soroban Best Practice 2026: Run fuzzing for extended periods before mainnet
#
# Usage: ./run_extended_fuzzing.sh [duration_seconds]
# Example: ./run_extended_fuzzing.sh 86400  # 24 hours

set -e

# Default duration: 24 hours (86400 seconds)
DURATION=${1:-86400}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}Extended Fuzzing Suite - SAC Factory${NC}"
echo -e "${GREEN}==================================================${NC}"
echo ""
echo -e "Duration: ${YELLOW}${DURATION}s${NC} (~$((DURATION / 3600)) hours)"
echo -e "Start time: ${YELLOW}$(date)${NC}"
echo ""

# Check if running with nightly
if ! rustup toolchain list | grep -q nightly; then
    echo -e "${RED}Error: Nightly toolchain not installed${NC}"
    echo "Install with: rustup install nightly"
    exit 1
fi

# Create output directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_DIR="fuzz/fuzzing_results_${TIMESTAMP}"
mkdir -p "$OUTPUT_DIR"

echo -e "${GREEN}Output directory: ${YELLOW}${OUTPUT_DIR}${NC}"
echo ""

# Function to run a single fuzz target
run_fuzz_target() {
    local target=$1
    local duration=$2
    local output_file="${OUTPUT_DIR}/${target}.log"

    echo -e "${GREEN}Starting: ${YELLOW}${target}${NC}"
    echo "  Log: ${output_file}"
    echo "  Duration: ${duration}s"
    echo ""

    # Run fuzzing in background, redirect output
    cargo +nightly fuzz run "$target" -- \
        -max_total_time="$duration" \
        -print_final_stats=1 \
        -timeout=30 \
        > "$output_file" 2>&1 &

    local pid=$!
    echo "$pid" > "${OUTPUT_DIR}/${target}.pid"
    echo "  PID: $pid"
    echo ""
}

# Run all three fuzz targets in parallel
echo -e "${GREEN}Launching fuzz targets...${NC}"
echo ""

run_fuzz_target "fuzz_bonding_curve" "$DURATION"
run_fuzz_target "fuzz_buy_function" "$DURATION"
run_fuzz_target "fuzz_sell_function" "$DURATION"

# Wait for all to complete
echo -e "${GREEN}All fuzz targets launched!${NC}"
echo ""
echo "Monitor progress with:"
echo "  tail -f ${OUTPUT_DIR}/fuzz_bonding_curve.log"
echo "  tail -f ${OUTPUT_DIR}/fuzz_buy_function.log"
echo "  tail -f ${OUTPUT_DIR}/fuzz_sell_function.log"
echo ""
echo "Check running processes:"
echo "  ps aux | grep 'cargo.*fuzz'"
echo ""
echo "Stop all fuzzing:"
echo "  ./fuzz/stop_fuzzing.sh ${OUTPUT_DIR}"
echo ""

# Create summary script
cat > "${OUTPUT_DIR}/summary.sh" << 'EOF'
#!/bin/bash
echo "==================================================="
echo "Fuzzing Results Summary"
echo "==================================================="
echo ""

for log in *.log; do
    target=$(basename "$log" .log)
    echo "[$target]"

    # Extract key metrics
    if grep -q "DONE" "$log"; then
        echo "  Status: COMPLETED"
    elif grep -q "ERROR" "$log"; then
        echo "  Status: ERROR"
    else
        echo "  Status: RUNNING"
    fi

    # Extract stats
    execs=$(grep -oP 'total_execs: \K\d+' "$log" | tail -1)
    crashes=$(grep -oP 'crash-\w+' "$log" | wc -l)

    echo "  Executions: ${execs:-0}"
    echo "  Crashes found: ${crashes:-0}"
    echo ""
done

echo "View detailed logs:"
echo "  cat *.log"
echo ""
EOF
chmod +x "${OUTPUT_DIR}/summary.sh"

echo -e "${GREEN}Created summary script: ${YELLOW}${OUTPUT_DIR}/summary.sh${NC}"
echo ""
echo -e "${YELLOW}Fuzzing will run for ~$((DURATION / 3600)) hours${NC}"
echo -e "${YELLOW}Estimated completion: $(date -v+${DURATION}S 2>/dev/null || date -d "+${DURATION} seconds" 2>/dev/null)${NC}"
echo ""
echo -e "${GREEN}==================================================${NC}"
echo -e "${GREEN}Fuzzing started successfully!${NC}"
echo -e "${GREEN}==================================================${NC}"
