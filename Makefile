# Makefile for Agentic Dynamic Pricing Platform
# Usage:
#   make up      - Start the application
#   make down    - Stop the application
#   make restart - Restart the application
#   make logs    - Show application logs
#   make db-push - Push database schema changes
#   make clean   - Clean build artifacts

.PHONY: up down restart logs db-push clean install dev

# Default target
all: up

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm install

# Push database schema
db-push:
	@echo "Pushing database schema..."
	npm run db:push

# Start the application (development mode)
up: install
	@echo "Starting Agentic Dynamic Pricing Platform..."
	@echo "Application will be available at http://localhost:5000"
	npm run dev

# Alternative: just run without install
dev:
	@echo "Starting in development mode..."
	npm run dev

# Stop the application
down:
	@echo "Stopping application..."
	@pkill -f "npm run dev" 2>/dev/null || true
	@pkill -f "tsx" 2>/dev/null || true
	@pkill -f "vite" 2>/dev/null || true
	@echo "Application stopped."

# Restart the application
restart: down up

# Show logs (tail the console output)
logs:
	@echo "Showing application logs..."
	@tail -f /tmp/app.log 2>/dev/null || echo "No log file found. Run 'make up' first."

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf node_modules/.cache
	rm -rf dist
	@echo "Clean complete."

# Database reset (drops and recreates tables)
db-reset:
	@echo "Resetting database..."
	npm run db:push -- --force
	@echo "Database reset complete."

# Help
help:
	@echo "Agentic Dynamic Pricing Platform - Makefile Commands"
	@echo ""
	@echo "  make up        - Install deps and start the application"
	@echo "  make down      - Stop the application"
	@echo "  make restart   - Restart the application"
	@echo "  make dev       - Start without reinstalling deps"
	@echo "  make install   - Install dependencies only"
	@echo "  make db-push   - Push database schema changes"
	@echo "  make db-reset  - Reset database (force push schema)"
	@echo "  make clean     - Clean build artifacts"
	@echo "  make help      - Show this help message"
