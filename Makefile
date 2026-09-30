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

# compose.prod.yml usa imágenes de GHCR etiquetadas por SHA (no construye) y
# recibe TLS de Nginx Proxy Manager/Cloudflare, no de certificados locales:
# gen-certs.sh y config/nginx/ eran restos de una arquitectura anterior.
up-prod:
	@bash scripts/gen-secrets.sh
	@$(COMPOSE) $(COMPOSE_PROD) up --detach
	@printf "$(GREEN)Containers started successfully.$(NC)\n"

down-prod:
	@$(COMPOSE) $(COMPOSE_PROD) down

build:
	@$(COMPOSE) $(COMPOSE_DEV) build

# -----------------------------------------------------------------------------
# CI y despliegues SIN GitHub Actions (guía DevOps del equipo, apartado
# «CI y despliegues en local»).
#
# Mismos pasos que los workflows, ejecutados en esta máquina. Node y npm salen
# de un contenedor con las versiones de .nvmrc y devEngines, así que no hace
# falta tenerlas instaladas en el host.
# -----------------------------------------------------------------------------
ci: ## CI completo en local. Un job suelto: make ci JOBS="quality unit"
	@bash scripts/ci/run-local.sh $(JOBS)

deploy-staging: ## Construir y desplegar staging desde este host
	@bash scripts/deploy/deploy-local.sh staging $(ARGS)

deploy-prod: ## Construir y desplegar producción desde este host (pide confirmación escrita)
	@bash scripts/deploy/deploy-local.sh prod $(ARGS)

# -----------------------------------------------------------------------------
# Propuestas del frontend (ramas proposal/*): CI y vista previa.
#   make propuesta P=estilos-base           -> qué cambia y qué mirar
#   make propuesta P=estilos-base A=ci      -> CI local sobre esa rama
#   make propuesta P=estilos-base A=demo    -> abre /demo.html (sin backend)
#   make propuesta P=pantalla-referencia A=app  -> pila completa con la API
# -----------------------------------------------------------------------------
propuesta: ## Propuestas del frontend: make propuesta P=<propuesta> A=<ci|demo|app|down|info>
	@bash scripts/dev/propuesta.sh $(P) $(or $(A),info)

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
	@$(DOCKER) ps

images:
	@$(DOCKER) images

re: fclean up-dev


.PHONY: all up-dev down-dev up-prod down-prod build ci deploy-staging deploy-prod propuesta it clean fclean prune-global logs ps images re
