#!/bin/bash
# =============================================================================
# SLURM NODE DASHBOARD - UPDATE SCRIPT
# =============================================================================
# This script performs a clean update of the dashboard:
#   1. Pulls latest code from git
#   2. Removes build artifacts (.next, node_modules, package-lock.json)
#   3. Handles .env file setup (moves .env.production out of the way)
#   4. Reinstalls dependencies and rebuilds
#
# Usage: ./update.sh [--skip-pull]
# =============================================================================

set -e

# Resolve paths so the script works from any CWD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo ""
echo "=============================================="
echo "  SLURM NODE DASHBOARD - UPDATE SCRIPT"
echo "=============================================="
echo ""

# Check if --skip-pull flag is provided
SKIP_PULL=false
if [[ "$1" == "--skip-pull" ]]; then
    SKIP_PULL=true
fi

# Step 1: Git pull (unless skipped)
if [ "$SKIP_PULL" = false ]; then
    log_info "Pulling latest changes from git..."
    git pull
    log_success "Git pull complete"
else
    log_warn "Skipping git pull (--skip-pull flag provided)"
fi

echo ""

# Step 2: Remove build artifacts
log_info "Removing build artifacts..."

if [ -d ".next" ]; then
    rm -rf .next
    log_success "Removed .next directory"
else
    log_info ".next directory not found, skipping"
fi

if [ -d "node_modules" ]; then
    rm -rf node_modules
    log_success "Removed node_modules directory"
else
    log_info "node_modules directory not found, skipping"
fi

if [ -f "package-lock.json" ]; then
    rm -f package-lock.json
    log_success "Removed package-lock.json"
else
    log_info "package-lock.json not found, skipping"
fi

echo ""

# Step 3: Handle .env files
log_info "Checking environment files..."

ENV_FILE="${PROJECT_ROOT}/.env"
ENV_TEMPLATE="${SCRIPT_DIR}/.env.production"

if [ -f "${ENV_FILE}" ]; then
    log_success ".env file exists at project root (${ENV_FILE})"

    if [ -f "${ENV_TEMPLATE}" ]; then
        log_info "Template env file found at ${ENV_TEMPLATE} (no action needed)"
    fi
else
    log_warn ".env file not found at project root"

    if [ -f "${ENV_TEMPLATE}" ]; then
        log_info "Creating .env from infra/.env.production template..."
        cp "${ENV_TEMPLATE}" "${ENV_FILE}"
        log_success "Created .env from infra/.env.production"
        log_warn "⚠️  Please edit .env and configure your environment variables!"
    else
        log_error "No .env file at project root and no infra/.env.production template found!"
        log_error "Please create a .env file with your configuration."
        exit 1
    fi
fi

echo ""

# Step 4: Install dependencies
log_info "Installing dependencies..."
npm install
log_success "Dependencies installed"

echo ""

# Step 5: Build the application
log_info "Building the application..."
npm run build

if [ $? -eq 0 ]; then
    echo ""
    log_success "=============================================="
    log_success "  UPDATE COMPLETE!"
    log_success "=============================================="
    echo ""
    log_info "You can now start the application with:"
    echo "    npm run start"
    echo ""
else
    echo ""
    log_error "Build failed! Please check the errors above."
    exit 1
fi
