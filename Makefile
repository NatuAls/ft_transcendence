DOCKER = docker
COMPOSE = $(DOCKER) compose

# Proyecto de Compose de la pila de desarrollo, por la MISMA razón que el de
# producción (ver abajo): los nombres de contenedor de compose.dev.yml son
# fijos (dev_api, dev_web, dev_database...), así que dos clones del repositorio
# en la misma máquina no pueden levantarla a la vez — pero SÍ pueden intentar
# pararla cada uno por su lado, y ahí está la trampa: sin `-p`, el proyecto
# sale del nombre de la carpeta, de modo que `make down-dev` desde un clon
# distinto del que la levantó **no para nada y no dice nada**. Parece que el
# comando no funciona; lo que ocurre es que está mirando otro proyecto.
#
# Se puede fijar otro con: make up-dev DEV_PROJECT=loquesea
DEV_PROJECT ?= helpdesk-dev
COMPOSE_DEV = -p $(DEV_PROJECT) -f compose.dev.yml

# Proyecto de Compose de la pila de producción. Tiene que ser el MISMO que usa
# scripts/deploy/remote-deploy.sh (el nombre del entorno), porque los nombres de
# contenedor de compose.prod.yml son fijos (helpdesk-api-prod...). Sin esto, el
# proyecto sale del nombre de la carpeta: dos clones del repositorio en la misma
# máquina producen dos proyectos para el mismo entorno y el segundo arranque
# muere con «container name is already in use», dejando sirviendo al primero.
ENV_NAME := $(shell sed -n 's/^ENV_NAME=//p' .env 2>/dev/null | head -1)
PROD_PROJECT := $(if $(ENV_NAME),$(ENV_NAME),prod)
COMPOSE_PROD = -p $(PROD_PROJECT) -f compose.prod.yml

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

down-dev-all: ## Para la pila de desarrollo venga del proyecto que venga
	@$(COMPOSE) $(COMPOSE_DEV) down 2> /dev/null || true
	@# Y los que levantó otro clon, que `down` no ve porque pertenecen a otro
	@# proyecto de Compose. Se buscan por nombre, que en compose.dev.yml es
	@# fijo, y se paran y eliminan: los VOLÚMENES no se tocan, así que la base
	@# de datos de desarrollo sigue donde estaba.
	@huerfanos="$$($(DOCKER) ps -a --filter 'name=^dev_' --format '{{.Names}}')"; \
	if [ -n "$$huerfanos" ]; then \
		printf "$(YELLOW)Parando contenedores de desarrollo de otro proyecto:$(NC)\n"; \
		$(DOCKER) ps -a --filter 'name=^dev_' \
			--format '  {{.Names}}  ({{.Status}})  proyecto: {{.Label "com.docker.compose.project"}}'; \
		$(DOCKER) rm -f $$huerfanos > /dev/null; \
	fi
	@printf "$(GREEN)Pila de desarrollo detenida por completo.$(NC)\n"

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
#test
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
