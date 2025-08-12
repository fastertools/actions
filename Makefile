.PHONY: build test test-setup test-server test-deploy test-auth clean help

# Build all actions
build:
	cd /Users/coreyryan/data/mashh/actions/src/ftl-server-up  && pnpm run bundle 
	cd /Users/coreyryan/data/mashh/actions/src/ftl-setup && pnpm run bundle

# Run TypeScript type checking
typecheck:
	pnpm run typecheck

# Test all actions locally
test: test-setup test-server test-deploy test-auth

# Test setup-ftl action
test-setup:
	@echo "🧪 Testing setup-ftl action..."
	env INPUT_VERSION=latest INPUT_USE-CACHE=false RUNNER_TEMP=/tmp RUNNER_TOOL_CACHE=/tmp/tool-cache node packages/setup-ftl/dist/index.js

# Test ftl-server-up action
test-server:
	@echo "🧪 Testing ftl-server-up action..."
	env INPUT_PORT=8080 INPUT_TIMEOUT=5 node packages/ftl-server-up/dist/index.js

# Test ftl-eng-deploy action
test-deploy:
	@echo "🧪 Testing ftl-eng-deploy action..."
	env INPUT_PROJECT=test-project INPUT_ENVIRONMENT=staging INPUT_CLIENT-ID=test-id INPUT_CLIENT-SECRET=test-secret INPUT_WAIT-FOR-COMPLETION=true node packages/ftl-eng-deploy/dist/index.js

# Test authenticate-ftl action
test-auth:
	@echo "🧪 Testing authenticate-ftl action..."
	env INPUT_METHOD=auto INPUT_CLIENT-ID=test-id INPUT_CLIENT-SECRET=test-secret INPUT_SET-OUTPUT=false node packages/authenticate-ftl/dist/index.js

# Build and test everything
build-and-test: build test

# Clean build artifacts
clean:
	rm -rf packages/*/dist
	rm -rf packages/shared/dist

# Install dependencies
install:
	pnpm install

# Set up project from scratch
setup: install build

# Help target
help:
	@echo "Available targets:"
	@echo "  build         - Build all TypeScript actions"
	@echo "  typecheck     - Run TypeScript type checking"
	@echo "  test          - Test all actions locally"
	@echo "  test-setup    - Test setup-ftl action only"
	@echo "  test-server   - Test ftl-server-up action only"
	@echo "  test-deploy   - Test ftl-eng-deploy action only"
	@echo "  test-auth     - Test authenticate-ftl action only"
	@echo "  clean         - Remove build artifacts"
	@echo "  install       - Install dependencies"
	@echo "  setup         - Full setup (install + build)"
	@echo "  help          - Show this help message"