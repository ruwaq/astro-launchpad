#!/bin/bash
# Stop all running fuzz targets
#
# Usage: ./stop_fuzzing.sh [results_directory]

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

RESULTS_DIR=${1:-}

echo -e "${YELLOW}==================================================${NC}"
echo -e "${YELLOW}Stopping Fuzzing Processes${NC}"
echo -e "${YELLOW}==================================================${NC}"
echo ""

if [ -n "$RESULTS_DIR" ] && [ -d "$RESULTS_DIR" ]; then
    echo -e "Stopping processes from: ${GREEN}${RESULTS_DIR}${NC}"
    echo ""

    # Stop processes by PID files
    for pid_file in "${RESULTS_DIR}"/*.pid; do
        if [ -f "$pid_file" ]; then
            pid=$(cat "$pid_file")
            target=$(basename "$pid_file" .pid)

            if ps -p "$pid" > /dev/null 2>&1; then
                echo -e "Stopping ${GREEN}${target}${NC} (PID: $pid)"
                kill "$pid" 2>/dev/null || true
            else
                echo -e "${YELLOW}${target}${NC} (PID: $pid) - already stopped"
            fi
        fi
    done
else
    # Stop all fuzz processes
    echo "Stopping all cargo fuzz processes..."
    pkill -f "cargo.*fuzz" || echo "No fuzzing processes found"
fi

echo ""
echo -e "${GREEN}All fuzzing processes stopped${NC}"
echo ""

# Show final summary if results directory provided
if [ -n "$RESULTS_DIR" ] && [ -f "${RESULTS_DIR}/summary.sh" ]; then
    echo -e "${GREEN}Final Summary:${NC}"
    echo ""
    bash "${RESULTS_DIR}/summary.sh"
fi
