# Docker Compose
DC := COMPOSE_IGNORE_ORPHANS=true docker compose
DC_DEV := $(DC) -f docker-compose.yml -f docker-compose.override.yml
DC_PROD := $(DC) -f docker-compose.yml

.PHONY: help start start-dev stop restart build logs logs-app logs-pb shell lint check clean ci db-reset

help: ## Show this help message
	@node -e "const fs = require('fs'); const content = fs.readFileSync('Makefile', 'utf8'); console.log('\x1b[34m=========================================\x1b[0m'); console.log('\x1b[33m\x1b[1m         KIMPAY MAKEFILE COMMANDS      \x1b[0m'); console.log('\x1b[34m=========================================\x1b[0m'); content.split(/\r?\n/).forEach(line => { const match = line.match(/^([a-zA-Z0-9_-]+):.*?## (.*)$$/); if (match) console.log('\x1b[32m' + match[1].padEnd(20) + '\x1b[0m ' + match[2]); });"

# =============================================================================
# Development
# =============================================================================

start: ## Start in Production mode (detached, no override)
	@node -e "console.log('\x1b[36m\x1b[1m[PROD] Starting in PRODUCTION mode...\x1b[0m')"
	@$(DC_PROD) down -v --remove-orphans 2>/dev/null || true
	@$(DC_PROD) up -d --build
	@node -e "console.log('\x1b[32m\x1b[1m[OK] Production containers are up!\x1b[0m')"

start-dev: ## Start in Development mode (with override, attached logs)
	@node -e "console.log('\x1b[33m\x1b[1m[DEV] Starting in DEVELOPMENT mode...\x1b[0m')"
	@$(DC_DEV) up --build

start-dev-d: ## Start in Development mode (detached)
	@node -e "console.log('\x1b[33m\x1b[1m[DEV] Starting in DEVELOPMENT mode (detached)...\x1b[0m')"
	@$(DC_DEV) up -d --build

stop: ## Stop all containers
	@node -e "console.log('\x1b[31m\x1b[1m[STOP] Stopping containers...\x1b[0m')"
	@$(DC) down
	@node -e "console.log('\x1b[32m[OK] Stopped.\x1b[0m')"

restart: stop start-dev ## Restart the development environment

build: ## Rebuild images without starting
	@node -e "console.log('\x1b[34m\x1b[1m[BUILD] Building images...\x1b[0m')"
	@$(DC) build

logs: ## Follow logs for all containers
	@$(DC) logs -f

logs-app: ## Follow logs for the app container only
	@$(DC) logs -f app

logs-pb: ## Follow logs for the PocketBase container only
	@$(DC) logs -f pocketbase

shell: ## Open a shell inside the 'app' container
	@node -e "console.log('\x1b[36m[SHELL] Opening shell in app...\x1b[0m')"
	@$(DC) exec app sh

# =============================================================================
# Code Quality
# =============================================================================

lint: ## Run ESLint inside a temporary container
	@node -e "console.log('\x1b[34m\x1b[1m[LINT] Running ESLint...\x1b[0m')"
	@$(DC) -f docker-compose.ci.yml run --rm ci npm run lint || (node -e "console.log('\x1b[31m\x1b[1m[ERROR] ESLint failed!\x1b[0m')" && exit 1)

lint-fix: ## Run ESLint with --fix inside a temporary container
	@node -e "console.log('\x1b[34m\x1b[1m[LINT] Running ESLint Fix...\x1b[0m')"
	@$(DC) -f docker-compose.ci.yml run --rm ci npm run lint -- --fix || (node -e "console.log('\x1b[31m\x1b[1m[ERROR] ESLint fix failed!\x1b[0m')" && exit 1)

check: ## Run Svelte Check inside a temporary container
	@node -e "console.log('\x1b[34m\x1b[1m[CHECK] Running Svelte Check...\x1b[0m')"
	@$(DC) -f docker-compose.ci.yml run --rm ci npm run check || (node -e "console.log('\x1b[31m\x1b[1m[ERROR] Svelte Check failed!\x1b[0m')" && exit 1)

# =============================================================================
# Testing
# =============================================================================

test-e2e: ## Run Playwright E2E tests (via Docker)
	@node -e "console.log('\x1b[36m\x1b[1m[TEST] Running E2E Tests in Isolated Stack...\x1b[0m')"
	@$(DC) -f docker-compose.test.yml down -v --remove-orphans 2>/dev/null || true
	@$(DC) -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests tests pocketbase-test || (node -e "console.log('\x1b[31m\x1b[1m[ERROR] E2E tests failed!\x1b[0m')" && exit 1)

test-unit: ## Run Vitest unit tests (via Docker)
	@node -e "console.log('\x1b[36m\x1b[1m[TEST] Running Unit Tests...\x1b[0m')"
	@$(DC) -f docker-compose.test.yml run --rm unit-tests || (node -e "console.log('\x1b[31m\x1b[1m[ERROR] Unit tests failed!\x1b[0m')" && exit 1)

test: test-unit test-e2e ## Run all tests (unit + e2e)

# =============================================================================
# CI (all checks in one command)
# =============================================================================

ci: ## Run all CI checks (lint + check + unit tests)
	@node -e "console.log('\x1b[35m\x1b[1m[CI] Running all CI checks...\x1b[0m')"
	@$(MAKE) --no-print-directory lint
	@$(MAKE) --no-print-directory check
	@$(MAKE) --no-print-directory test-unit
	@node -e "console.log('\x1b[32m\x1b[1m[OK] All CI checks passed!\x1b[0m')"

# =============================================================================
# Database
# =============================================================================

db-reset: ## Reset PocketBase database (delete all data)
	@node -e "console.log('\x1b[31m\x1b[1m[DB] Resetting PocketBase database...\x1b[0m')"
	@$(DC) stop pocketbase 2>/dev/null || true
	@$(DC) rm -f pocketbase 2>/dev/null || true
	@rm -rf pocketbase/pb_data 2>/dev/null || true
	@node -e "console.log('\x1b[32m[OK] Database reset complete. Run make start to recreate.\x1b[0m')"

# =============================================================================
# Utilities
# =============================================================================

clean: ## Remove containers, networks, and volumes
	@node -e "console.log('\x1b[31m\x1b[1m[CLEAN] Cleaning up...\x1b[0m')"
	@$(DC) down -v --remove-orphans
	@node -e "console.log('\x1b[32m[OK] Clean complete.\x1b[0m')"

install-dev: ## Install dependencies locally for IDE support
	@node -e "console.log('\x1b[33m[INSTALL] Installing local dependencies for IDE...\x1b[0m')"
	@cd app && npm install

