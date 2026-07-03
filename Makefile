PY := .venv/bin/python
UVICORN := .venv/bin/uvicorn
PORT := 8877

.PHONY: demo dev test headless setup build clean

## One command, zero manual data setup: build everything and serve the app.
demo: setup build
	@echo ""
	@echo "  RuleLift → http://localhost:$(PORT)"
	@echo "  (LLM mode: live if OPENAI_API_KEY is set in env or .env, otherwise mock)"
	@echo ""
	@sh -c 'set -a; [ -f .env ] && . ./.env; set +a; exec $(UVICORN) backend.app:app --port $(PORT)'

setup: .venv/.stamp
.venv/.stamp: requirements.txt
	python3 -m venv .venv
	.venv/bin/pip install -q -r requirements.txt
	@touch .venv/.stamp

build: frontend/dist/index.html
frontend/dist/index.html:
	cd frontend && npm install && npm run build

## Backend on :$(PORT) + Vite dev server with hot reload on :5173.
dev: setup
	@sh -c 'set -a; [ -f .env ] && . ./.env; set +a; $(UVICORN) backend.app:app --port $(PORT) & cd frontend && npm install && npm run dev; kill %1'

## Unit tests for the deterministic core (no network, no LLM).
test: setup
	$(PY) -m pytest backend/tests -q

## Prove the fidelity/drift/impact math with no server and no UI.
headless: setup
	$(PY) -m scripts.headless_demo

clean:
	rm -rf workdir/* frontend/dist data/transactions.csv
