# Smart Table OS — Proyecto Final (Desarrollo Continuo)

**Autor:** Andrés Huerta (`@AndresHv007`)  
**Materia:** Desarrollo Continuo — ITESO  

Plataforma interactiva en tiempo real para mesas de juegos de mesa físicos (**pantalla TV central + controladores móviles con WebSockets/Socket.IO**), con arquitectura DevOps completa en **GitHub Actions, Docker Hub, Terraform, Microsoft Azure App Service y Sentry APM**.

## Repositorios del Ecosistema

| Repositorio | Contenido | URL |
|---|---|---|
| **Hub & Wiki** | Documentación completa (`wiki/`), diagramas y seguimiento | https://github.com/AndresHv007/smart-table-os |
| **Backend** | Node.js + Express + Socket.IO + SQLite + Sentry APM + Vitest (cobertura) + CI/CD Dev/Prod | https://github.com/AndresHv007/smart-table-os-backend |
| **Frontend** | React + Vite + Tailwind + Nginx runtime env (`env-config.js`) + CI/CD Dev/Prod | https://github.com/AndresHv007/smart-table-os-frontend |
| **Infraestructura (IaC)** | Terraform modular (`azurerm`) para Resource Group, App Service Plans B1 y Web Apps Dev/Prod | https://github.com/AndresHv007/smart-table-os-infra |

## Ambientes Publicados en Azure

- **Dev:**
  - Frontend: `https://smarttable-web-dev-andreshu.azurewebsites.net`
  - Backend: `https://smarttable-api-dev-andreshu.azurewebsites.net`
- **Prod (con aprobación manual en GitHub Environments):**
  - Frontend: `https://smarttable-web-prod-andreshu.azurewebsites.net`
  - Backend: `https://smarttable-api-prod-andreshu.azurewebsites.net`

## Documentación y Tablero
- **Tablero Kanban (GitHub Projects):** https://github.com/users/AndresHv007/projects/1
- **Wiki del Proyecto:** https://github.com/AndresHv007/smart-table-os/wiki
- Espejo local en Markdown: [Inicio](wiki/Home.md) · [Arquitectura](wiki/Arquitectura-y-Componentes.md) · [Infraestructura y Deployment](wiki/Infraestructura-y-Deployment.md) · [Ramas y Backlog](wiki/Estrategia-de-Ramas-y-Backlog.md)
