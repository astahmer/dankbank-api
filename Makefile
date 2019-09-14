#
# Env
#
-include .env

EXECUTOR = docker exec -i $(PROJECT_NAME)-koa /bin/bash -c
EXECUTOR-WWW = ""

#
##@ HELP
#

.PHONY: help
help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
.DEFAULT_GOAL := help

#
##@ DOCKER MASTER COMMANDS
#

install: ## Fully install the project with docker, then run a container
install:
	@${MAKE} checkenv; \
	 ${MAKE} vhosts; \
	 ${MAKE} docker-build; \
	 ${MAKE} start-install;

start: ## Start container
start: stop docker-compose-up

start-install: ## Install vendors and then start
start-install: stop vendors docker-compose-up

stop: ## Stop container
stop: docker-compose-down

#
##@ DOCKER UNIT COMMANDS
#

docker-compose-up: # Start a container
	@echo "Starting container...";
	@if [ "$(shell docker ps | grep $(PROJECT_NAME))" != "" ]; then \
		echo "Container already up. Skipping."; \
	else \
		docker-compose up -d --force-recreate koa; \
	fi;

docker-compose-down: # Stop a container
	@echo "Stopping container...";
	@if [ "$(shell docker ps | grep $(PROJECT_NAME))" != "" ]; then \
		docker-compose down --remove-orphans --volumes; \
	else \
		echo "No container up. Skipping."; \
	fi;

vendors: # Install vendors
	@echo "Installing vendors...";
	@if [ -d node_modules ]; then \
		echo "Vendors already installed. Skipping."; \
	else \
		docker-compose up vendors; \
	fi; \

docker-build: # Build docker image
	@echo "Building docker image..."
	docker-compose build

logs: ## Show & follow koa container logs
	docker logs -f $(PROJECT_NAME)-koa

logsw: ## Show & follow koa container logs
	docker logs -f $(PROJECT_NAME)-webpack

term-user: ## Enter in container terminal
	docker-compose exec -u www-data koa /bin/sh

term: ## Enter in container terminal as root
	docker-compose exec -u root koa /bin/sh
termw: ## Enter in container terminal as root
	docker-compose exec -u root webpack /bin/sh

#
##@ ENVIRONMENT
#

checkenv: ## Check if .env file exists and create it if not
	@if [ ! -f .env ]; then \
		echo "Copying .env.dist to .env"; \
		cp .env.dist .env; \
	fi;
	source .env

#
##@ VIRTUAL HOSTS
#

LINE1='\\\# Added by ${PROJECT_NAME}'
HOST_LINE='127.0.0.1 api.${PROJECT_NAME}.lol phpmyadmin.${PROJECT_NAME}.lol'
LINE3='\\\# End of section'

vhosts: ## Add required lines to /etc/hosts file if missing
	@if [ $(shell cat /etc/hosts | grep ${PROJECT_NAME}.lol -c) -ne 0 ]; then \
		echo "Hosts already set."; \
	else \
		echo "Updating hosts file..."; \
		sudo -- sh -c -e "echo '$(LINE1)\n$(HOST_LINE)\n$(LINE3)' >> /etc/hosts"; \
	fi;

#
##@ DATABASE
#

stress-test:
	ab -n 100 -c 1 http://api.$(PROJECT_NAME).lol/
