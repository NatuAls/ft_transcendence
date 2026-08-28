DOCKER = docker
COMPOSE = $(DOCKER) compose
COMPOSE_FILE = -f docker-compose.yml

#COLORS

RED=\033[0;31m
CYAN=\033[0;36m
GREEN=\033[0;32m
YELLOW=\033[0;33m
WHITE=\033[0;97m
BLUE=\033[0;34m
NC=\033[0m # NO COLOR

all: up

up:
	@bash scripts/gen-secrets.sh
	@$(COMPOSE) $(COMPOSE_FILE) up --build --detach
	@printf "$(GREEN)Contenedores iniciados correctamente.$(NC)\n"

down:
	@$(COMPOSE) $(COMPOSE_FILE) down

build:
	@$(COMPOSE) $(COMPOSE_FILE) build

it: # usage make it ID=wordpress
	@$(DOCKER) exec -it $(ID) sh || true
clean:
	@$(COMPOSE) $(COMPOSE_FILE) down --remove-orphans
	@printf "$(GREEN)Contenedores detenidos y eliminados.$(NC)\n"

fclean:
	@$(COMPOSE) $(COMPOSE_FILE) down --volumes --remove-orphans
	@printf "$(GREEN)Contenedores y volumen de PostgreSQL eliminados.$(NC)\n"
	docker system prune -af

secrets: ## Create .env with fresh random secrets if missing
	@bash scripts/gen-secrets.sh

logs:
	@$(COMPOSE) $(COMPOSE_FILE) logs --follow $(ID) || true

ps:
	@$(COMPOSE) $(COMPOSE_FILE) ps

images:
	@$(DOCKER) images

re: fclean up


.PHONY: all up down build it clean fclean logs ps images re
