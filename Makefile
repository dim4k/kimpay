# 🐳 Docker Compose
DC := docker compose
DC_DEV := $(DC) -f docker-compose.yml -f docker-compose.override.yml
DC_PROD := $(DC) -f docker-compose.yml

.PHONY: help start start-dev stop restart build logs shell lint check clean

help: ## Show this help message
	@node -e "const fs = require('fs'); const content = fs.readFileSync('Makefile', 'utf8'); console.log('\x1b[34m=========================================\x1b[0m'); console.log('\x1b[33m\x1b[1m         KIMPAY MAKEFILE COMMANDS      \x1b[0m'); console.log('\x1b[34m=========================================\x1b[0m'); content.split(/\r?\n/).forEach(line => { const match = line.match(/^([a-zA-Z0-9_-]+):.*?## (.*)$$/); if (match) console.log('\x1b[32m' + match[1].padEnd(20) + '\x1b[0m ' + match[2]); });"

start: ## Start in Production mode (detached, no override)
	@echo Starting in PRODUCTION mode...
	$(DC_PROD) down -v --remove-orphans || true
	$(DC_PROD) up -d --build
	@echo Production containers are up!

start-dev: ## Start in Development mode (with override, attached logs)
	@echo Starting in DEVELOPMENT mode...
	$(DC_DEV) up --build

start-dev-d: ## Start in Development mode (detached)
	@echo Starting in DEVELOPMENT mode (detached)...
	$(DC_DEV) up -d --build

stop: ## Stop all containers
	@echo Stopping containers...
	$(DC) down
	@echo Stopped.

restart: stop start-dev ## Restart the development environment

build: ## Rebuild images without starting
	@echo Building images...
	$(DC) build

logs: ## Follow logs for all containers
	$(DC) logs -f

shell: ## Open a shell inside the 'app' container
	@echo Opening shell in app...
	$(DC) exec app sh

lint: ## Run ESLint inside a temporary container
	@echo Running ESLint...
	$(DC) -f docker-compose.ci.yml run --rm ci npm run lint

lint-fix: ## Run ESLint with --fix inside a temporary container
	@echo Running ESLint Fix...
	$(DC) -f docker-compose.ci.yml run --rm ci npm run lint -- --fix

check: ## Run Svelte Check inside a temporary container
	@echo Running Svelte Check...
	$(DC) -f docker-compose.ci.yml run --rm ci npm run check

clean: ## Remove containers, networks, and volumes
	@echo Cleaning up...
	$(DC) down -v --remove-orphans
	@echo Clean complete.

test-e2e: ## Run Playwright E2E tests (via Docker)
	@echo Running E2E Tests in Isolated Stack...
	$(DC) -f docker-compose.test.yml down -v --remove-orphans || true
	$(DC) -f docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from tests

install-dev: ## Install dependencies locally for IDE support
	@echo Installing local dependencies for IDE...
	cd app && npm install

