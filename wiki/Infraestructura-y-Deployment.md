# Infraestructura en Azure y Diagrama de Deployment

## 1. Recursos creados con Terraform (`smart-table-os-infra`)

Todo el aprovisionamiento vive en el repositorio de infraestructura (`smart-table-os-infra`) usando un módulo reutilizable (`modules/environment`) instanciado para **Dev** y **Prod**:

- **Resource Group:** `rg-smarttable-os` (`eastus2`)
- **Ambiente Dev:**
  - App Service Plan Linux `B1`: `asp-smarttable-dev-andreshu`
  - Web App Backend: `https://smarttable-api-dev-andreshu.azurewebsites.net`
  - Web App Frontend: `https://smarttable-web-dev-andreshu.azurewebsites.net`
- **Ambiente Prod:**
  - App Service Plan Linux `B1`: `asp-smarttable-prod-andreshu`
  - Web App Backend: `https://smarttable-api-prod-andreshu.azurewebsites.net`
  - Web App Frontend: `https://smarttable-web-prod-andreshu.azurewebsites.net`

## 2. Diagrama de Infraestructura (Azure + Docker Hub + Sentry)

```mermaid
flowchart TB
    User["Jugador / Pantalla TV (Navegador / Movil)"]

    subgraph DockerHub["Docker Hub (andreshu07)"]
        ImgAPI["andreshu07/smarttable-api:sha-xxxxxxx"]
        ImgWeb["andreshu07/smarttable-web:sha-xxxxxxx"]
    end

    subgraph Azure["Microsoft Azure - Resource Group: rg-smarttable-os"]
        subgraph DevPlan["App Service Plan Dev (Linux B1)"]
            WebDev["Web App Frontend Dev\nsmarttable-web-dev-andreshu\n(Nginx :80)"]
            ApiDev["Web App Backend Dev\nsmarttable-api-dev-andreshu\n(Node + Socket.IO :3001)"]
        end

        subgraph ProdPlan["App Service Plan Prod (Linux B1)"]
            WebProd["Web App Frontend Prod\nsmarttable-web-prod-andreshu\n(Nginx :80)"]
            ApiProd["Web App Backend Prod\nsmarttable-api-prod-andreshu\n(Node + Socket.IO :3001)"]
        end

        AzMon["Azure Monitor\n(CPU, Memoria, Requests)"]
    end

    Sentry["Sentry APM\n(Trazas, Errores, Mensajes)"]

    User -->|"HTTPS"| WebDev
    User -->|"HTTPS"| WebProd
    WebDev -->|"WSS / HTTPS"| ApiDev
    WebProd -->|"WSS / HTTPS"| ApiProd

    ImgWeb -.->|"Pull imagen"| WebDev
    ImgWeb -.->|"Pull imagen"| WebProd
    ImgAPI -.->|"Pull imagen"| ApiDev
    ImgAPI -.->|"Pull imagen"| ApiProd

    ApiDev -->|"Traces / Errors / Logs"| Sentry
    ApiProd -->|"Traces / Errors / Logs"| Sentry
    DevPlan --> AzMon
    ProdPlan --> AzMon
```

## 3. Diagrama de Deployment (CI/CD con GitHub Actions)

```mermaid
flowchart LR
    Dev["Cambio en rama feature/*"] --> PR["Pull Request a develop / main"]
    PR --> CI["Job 1: Build + Unit Tests + Coverage\n(Vitest + v8 / Vite Build)"]
    CI -->|"Si falla"| Block["Bloquea Merge"]
    CI -->|"PR Aprobado y Merge"| Docker["Job 2: Docker Build & Push\n(andreshu07/*:sha-xxxxxxx)"]
    Docker --> DeployDev["Job 3: Deploy a Azure Dev\n(Service Principal + Health Check)"]
    DeployDev --> Gate{"Approval Gate\n(Environment: production)\nAprobacion manual"}
    Gate -->|"Aprobado"| DeployProd["Job 4: Deploy a Azure Prod\n(Misma imagen verificada + Health Check)"]
    Gate -->|"Rechazado"| Stop["Detenido antes de Prod"]
```

## 4. Monitoreo y Observabilidad

- **APM (Sentry — `andres-huerta.sentry.io`):**
  - **Trazas:** `GET /api/apm/trace` y `POST /api/dice/roll` registran transacciones y sub-spans (`db.sqlite`, `game.engine`).
  - **Mensajes/Logs:** `GET/POST /api/apm/message` registra mensajes de auditoría con `Sentry.captureMessage`.
  - **Errores:** `GET /api/apm/error` y `POST /api/apm/exception` reportan excepciones reales a Sentry Issues.
- **Métricas de Infraestructura (Azure Portal):**
  - En `asp-smarttable-dev-andreshu` y `asp-smarttable-prod-andreshu` -> **Monitoring -> Metrics**:
    - `CPU Percentage`
    - `Memory Percentage`
    - `Requests` (en cada Web App)
