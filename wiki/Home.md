# Smart Table OS — Wiki del Proyecto Final

**Materia:** Desarrollo Continuo (ITESO)  
**Autor:** Andrés Huerta (`@AndresHv007`)  
**Modalidad:** Individual  

## Descripción del Proyecto

**Smart Table OS** es una plataforma web en tiempo real para digitalizar y acompañar partidas de juegos de mesa físicos (como Catán, Monopoly, Dixit o juegos de roles ocultos). Conecta una **pantalla central (TV/Tablet)** con los **teléfonos móviles de los jugadores** mediante WebSockets (`Socket.IO`), sincronizando turnos, lanzador de dados con *Golden Rolls*, cronómetros, marcadores de puntos, votaciones ciegas, reparto secreto de roles y estadísticas históricas en SQLite.

## Repositorios del Proyecto

| Repositorio | Rol | URL |
|---|---|---|
| **Hub + Wiki + Backlog** | Documentación, arquitectura y tablero de seguimiento | https://github.com/AndresHv007/smart-table-os |
| **Backend API + Socket.IO** | Servidor Node.js, motor de juego, Sentry APM, pruebas unitarias + cobertura y CI/CD Dev/Prod | https://github.com/AndresHv007/smart-table-os-backend |
| **Frontend Web (TV + Móvil)** | Interfaz React/Vite/Tailwind en Nginx con inyección de entorno y CI/CD Dev/Prod | https://github.com/AndresHv007/smart-table-os-frontend |
| **Infraestructura (Terraform)** | Código IaC modular en Terraform para aprovisionar Dev y Prod en Microsoft Azure | https://github.com/AndresHv007/smart-table-os-infra |

## Navegación de la Wiki

1. [[Arquitectura y Componentes|Arquitectura-y-Componentes]] — Componentes, métodos, diagrama de clases y stack tecnológico.
2. [[Infraestructura y Deployment|Infraestructura-y-Deployment]] — Recursos en Azure, diagrama de infraestructura, Docker Hub, diagrama de pipeline CI/CD y monitoreo (APM + Métricas).
3. [[Estrategia de Ramas y Plan de Trabajo|Estrategia-de-Ramas-y-Backlog]] — GitFlow, políticas de PRs y relación entre Issues y Commits.
