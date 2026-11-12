SHELL := /usr/bin/env bash
PYTHON ?= python
BACKEND := backend
FRONTEND := frontend

.PHONY: help env install backend-install frontend-install migrate trainer backend frontend dev \
	test backend-test frontend-test lint check build docker-build docker-up docker-down docker-logs

help:
	@printf '%s\n' \
		'Nattyrex commands:' \
		'  make env               Copy .env.example to .env if missing' \
		'  make install           Install backend and frontend dependencies' \
		'  make migrate           Apply database migrations' \
		'  make trainer           Provision the private trainer account' \
		'  make dev               Run Django and Vite together' \
		'  make backend           Run the Django API on :8000' \
		'  make frontend          Run the Vite app on :5173' \
		'  make test              Run backend and frontend tests' \
		'  make check             Django system checks and frontend typecheck' \
		'  make build             Production frontend build' \
		'  make docker-up         Build and start the Docker stack'

env:
	@test -f .env || (cp .env.example .env && echo "Created .env — edit SECRET_KEY and database settings.")

install: backend-install frontend-install

backend-install:
	$(PYTHON) -m pip install -r $(BACKEND)/requirements.txt -r $(BACKEND)/requirements-dev.txt

frontend-install:
	cd $(FRONTEND) && npm ci

migrate:
	cd $(BACKEND) && $(PYTHON) manage.py migrate

trainer:
	cd $(BACKEND) && $(PYTHON) manage.py create_trainer

backend:
	cd $(BACKEND) && $(PYTHON) manage.py runserver 0.0.0.0:8000

frontend:
	cd $(FRONTEND) && npm run dev -- --host

dev:
	./scripts/dev.sh

test: backend-test frontend-test

backend-test:
	cd $(BACKEND) && $(PYTHON) manage.py test

frontend-test:
	cd $(FRONTEND) && npm test

lint:
	cd $(FRONTEND) && npm run lint

check:
	cd $(BACKEND) && $(PYTHON) manage.py check
	cd $(FRONTEND) && npm run lint

build:
	cd $(FRONTEND) && npm run build

docker-build:
	docker compose build

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f --tail=100
