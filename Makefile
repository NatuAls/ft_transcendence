DOCKER = docker
COMPOSE = $(DOCKER) compose
COMPOSE_DEV = -f compose.dev.yml
COMPOSE_PROD = -f compose.prod.yml

#COLORS

RED=\033[0;31m
CYAN=\033[0;36m
GREEN=\033[0;32m
YELLOW=\033[0;33m
WHITE=\033[0;97m
BLUE=\033[0;34m
NC=\033[0m # NO COLOR

all: up-dev

up-dev:
	@bash scripts/gen-secrets.sh
	@$(COMPOSE) $(COMPOSE_DEV) up --build --detach
	@printf "$(GREEN)Containers started successfully.$(NC)\n"

down-dev:
	@$(COMPOSE) $(COMPOSE_DEV) down

up-prod:
	@bash scripts/gen-secrets.sh
	@bash scripts/gen-certs.sh
	@$(COMPOSE) $(COMPOSE_PROD) up --build --detach
	@printf "$(GREEN)Containers started successfully.$(NC)\n"

down-prod:
	@$(COMPOSE) $(COMPOSE_PROD) down

build:
	@$(COMPOSE) $(COMPOSE_DEV) build

it: # usage make it ID=wordpress
	@$(DOCKER) exec -it $(ID) sh || true

clean:
	@$(COMPOSE) $(COMPOSE_DEV) down --remove-orphans
	@$(COMPOSE) $(COMPOSE_PROD) down --remove-orphans
	@printf "$(GREEN)Containers detained and disposed of.$(NC)\n"

fclean:
	@printf "$(RED)WARNING! This will delete the database and all uploaded files.$(NC)\n"
	@read -p "Are you sure you want to delete the volumes? [y/N]: " ans; \
	if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then \
		$(COMPOSE) $(COMPOSE_DEV) down --volumes --remove-orphans; \
		$(COMPOSE) $(COMPOSE_PROD) down --volumes --remove-orphans; \
		printf "$(GREEN)Containers and volumes removed.$(NC)\n"; \
	else \
		printf "$(YELLOW)Deep clean cancelled.$(NC)\n"; \
	fi

prune-global:
	@printf "$(RED)WARNING! This will delete ALL images and empty containers from YOUR COMPUTER.$(NC)\n"
	@read -p "Should the global purge continue? [y/N]: " ans; \
	if [ "$$ans" = "y" ] || [ "$$ans" = "Y" ]; then \
		docker system prune -af; \
		printf "$(GREEN)Comprehensive Docker clean-up completed.$(NC)\n"; \
	else \
		printf "$(YELLOW)Global purge cancelled.$(NC)\n"; \
	fi

secrets: ## Create .env with fresh random secrets if missing
	@bash scripts/gen-secrets.sh

logs:
	@$(DOCKER) compose ls -q | xargs -I {} $(DOCKER) compose -p {} logs --follow $(ID) || true

ps:
	@$(COMPOSE) ps

images:
	@$(DOCKER) images

re: fclean up


.PHONY: all up-dev down-dev up-prod down-prod build it clean fclean prune-global logs ps images re
