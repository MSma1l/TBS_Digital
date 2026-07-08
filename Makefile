# TBS Digital — developer & deployment convenience targets.
# Run `make` or `make help` to list everything.

# Prefer the modern `docker compose` plugin; override with `make COMPOSE="docker-compose" ...`.
COMPOSE ?= docker compose

.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Docker (full stack)
# ---------------------------------------------------------------------------

.PHONY: up
up: ## Build (if needed) and start the whole stack in the background
	$(COMPOSE) up -d --build

.PHONY: down
down: ## Stop and remove containers (keeps volumes/data)
	$(COMPOSE) down

.PHONY: build
build: ## Build all images without starting
	$(COMPOSE) build

.PHONY: logs
logs: ## Tail logs from all services (Ctrl-C to stop)
	$(COMPOSE) logs -f --tail=100

.PHONY: ps
ps: ## Show container status
	$(COMPOSE) ps

.PHONY: restart
restart: ## Restart all services
	$(COMPOSE) restart

.PHONY: clean
clean: ## Stop the stack AND delete volumes (DESTROYS db + data)
	$(COMPOSE) down -v

# ---------------------------------------------------------------------------
# Shells
# ---------------------------------------------------------------------------

.PHONY: db-shell
db-shell: ## Open a psql shell in the db container
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

.PHONY: backend-shell
backend-shell: ## Open a shell in the backend container
	$(COMPOSE) exec backend sh

.PHONY: frontend-shell
frontend-shell: ## Open a shell in the frontend container
	$(COMPOSE) exec frontend sh

# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

.PHONY: test
test: ## Run backend pytest inside the backend container
	$(COMPOSE) exec backend python -m pytest

.PHONY: test-local
test-local: ## Run backend pytest in the local venv (no Docker)
	cd backend && . .venv/bin/activate && python -m pytest

# ---------------------------------------------------------------------------
# Local dev (no Docker) — needs Node + Python venv installed
# ---------------------------------------------------------------------------

.PHONY: dev-frontend
dev-frontend: ## Run the Next.js dev server locally (http://localhost:3000)
	npm run dev

.PHONY: dev-backend
dev-backend: ## Run FastAPI with --reload locally (http://localhost:8000)
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------

.PHONY: telegram-check
telegram-check: ## Verify TELEGRAM_BOT_TOKEN (from .env) via Telegram getMe
	@if [ ! -f ./.env ]; then echo "No .env file — copy .env.example to .env first."; exit 1; fi; \
	TELEGRAM_BOT_TOKEN=$$(grep -E '^TELEGRAM_BOT_TOKEN=' ./.env | tail -n1 | cut -d= -f2- | sed 's/[[:space:]]*#.*$$//' | xargs); \
	if [ -z "$$TELEGRAM_BOT_TOKEN" ]; then \
		echo "TELEGRAM_BOT_TOKEN is not set in .env"; exit 1; \
	fi; \
	echo "Calling Telegram getMe..."; \
	curl -fsS "https://api.telegram.org/bot$$TELEGRAM_BOT_TOKEN/getMe"; \
	echo

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@echo "TBS Digital — make targets:"
	@echo ""
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'
	@echo ""
	@echo "Quick start:  cp .env.example .env  &&  edit .env  &&  make up"
