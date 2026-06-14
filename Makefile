# Docker Compose
DC := docker compose
DC_DEV := $(DC) -f docker-compose.yml -f docker-compose.override.yml
DC_PROD := $(DC) -f docker-compose.yml

# Colors (ANSI) — embed a real ESC char so we don't rely on printf escape parsing
ESC := $(shell printf '\033')
BLUE := $(ESC)[34m
YELLOW := $(ESC)[33m$(ESC)[1m
GREEN := $(ESC)[32m
CYAN := $(ESC)[36m$(ESC)[1m
RED := $(ESC)[31m$(ESC)[1m
MAGENTA := $(ESC)[35m$(ESC)[1m
RESET := $(ESC)[0m

.PHONY: help start start-dev stop restart build logs logs-app logs-pb shell lint check clean ci db-reset

help: ## Show this help message
	@echo '$(BLUE)=========================================$(RESET)'
	@echo '$(YELLOW)         KIMPAY MAKEFILE COMMANDS      $(RESET)'
	@echo '$(BLUE)=========================================$(RESET)'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9_-]+:.*?## / {printf "$(GREEN)%-20s$(RESET) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# =============================================================================
# Development
# =============================================================================

start: ## Start in Production mode (detached, no override)
	@echo '$(CYAN)[PROD] Starting in PRODUCTION mode...$(RESET)'
	@$(DC_PROD) down -v --remove-orphans 2>/dev/null || true
	@$(DC_PROD) up -d --build
	@echo '$(GREEN)[OK] Production containers are up!$(RESET)'

start-dev: ## Start in Development mode (with override, attached logs)
	@echo '$(YELLOW)[DEV] Starting in DEVELOPMENT mode...$(RESET)'
	@$(DC_DEV) up --build

start-dev-d: ## Start in Development mode (detached)
	@echo '$(YELLOW)[DEV] Starting in DEVELOPMENT mode (detached)...$(RESET)'
	@$(DC_DEV) up -d --build

stop: ## Stop all containers
	@echo '$(RED)[STOP] Stopping containers...$(RESET)'
	@$(DC) down
	@echo '$(GREEN)[OK] Stopped.$(RESET)'

restart: stop start-dev ## Restart the development environment

build: ## Rebuild images without starting
	@echo '$(BLUE)[BUILD] Building images...$(RESET)'
	@$(DC) build

logs: ## Follow logs for all containers
	@$(DC) logs -f

logs-app: ## Follow logs for the app container only
	@$(DC) logs -f app

logs-pb: ## Follow logs for the PocketBase container only
	@$(DC) logs -f pocketbase

shell: ## Open a shell inside the 'app' container
	@echo '$(CYAN)[SHELL] Opening shell in app...$(RESET)'
	@$(DC) exec app sh

# =============================================================================
# Code Quality
# =============================================================================

lint: ## Run ESLint inside a temporary container
	@echo '$(BLUE)[LINT] Running ESLint...$(RESET)'
	@$(DC) -f docker-compose.ci.yml run --rm ci npm run lint || (echo '$(RED)[ERROR] ESLint failed!$(RESET)' && exit 1)

lint-fix: ## Run ESLint with --fix inside a temporary container
	@echo '$(BLUE)[LINT] Running ESLint Fix...$(RESET)'
	@$(DC) -f docker-compose.ci.yml run --rm ci npm run lint -- --fix || (echo '$(RED)[ERROR] ESLint fix failed!$(RESET)' && exit 1)

check: ## Run Svelte Check inside a temporary container
	@echo '$(BLUE)[CHECK] Running Svelte Check...$(RESET)'
	@$(DC) -f docker-compose.ci.yml run --rm ci npm run check || (echo '$(RED)[ERROR] Svelte Check failed!$(RESET)' && exit 1)

# =============================================================================
# Testing
# =============================================================================

test-e2e: ## Run Playwright E2E tests (via Docker)
	@echo '$(CYAN)[TEST] Running E2E Tests in Isolated Stack...$(RESET)'
	@$(DC) -f docker-compose.test.yml down -v --remove-orphans 2>/dev/null || true
	@$(DC) -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests tests pocketbase-test || (echo '$(RED)[ERROR] E2E tests failed!$(RESET)' && exit 1)

test-unit: ## Run Vitest unit tests (via Docker)
	@echo '$(CYAN)[TEST] Running Unit Tests...$(RESET)'
	@$(DC) -f docker-compose.test.yml run --rm unit-tests || (echo '$(RED)[ERROR] Unit tests failed!$(RESET)' && exit 1)

test: test-unit test-e2e ## Run all tests (unit + e2e)

# =============================================================================
# CI (all checks in one command)
# =============================================================================

ci: ## Run all CI checks (lint + check + unit tests)
	@echo '$(MAGENTA)[CI] Running all CI checks...$(RESET)'
	@$(MAKE) --no-print-directory lint
	@$(MAKE) --no-print-directory check
	@$(MAKE) --no-print-directory test-unit
	@echo '$(GREEN)[OK] All CI checks passed!$(RESET)'

# =============================================================================
# Database
# =============================================================================

db-reset: ## Reset PocketBase database (delete all data)
	@echo '$(RED)[DB] Resetting PocketBase database...$(RESET)'
	@$(DC) stop pocketbase 2>/dev/null || true
	@$(DC) rm -f pocketbase 2>/dev/null || true
	@rm -rf pocketbase/pb_data 2>/dev/null || true
	@echo '$(GREEN)[OK] Database reset complete. Run make start to recreate.$(RESET)'

# =============================================================================
# Utilities
# =============================================================================

clean: ## Remove containers, networks, and volumes
	@echo '$(RED)[CLEAN] Cleaning up...$(RESET)'
	@$(DC) down -v --remove-orphans
	@echo '$(GREEN)[OK] Clean complete.$(RESET)'

install-dev: ## Install dependencies locally for IDE support
	@echo '$(YELLOW)[INSTALL] Installing local dependencies for IDE...$(RESET)'
	@cd app && npm install

