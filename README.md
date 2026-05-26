# Smart Table OS 🎲

**Smart Table OS** es una plataforma interactiva y en tiempo real diseñada para mejorar la experiencia de los juegos de mesa físicos. Convierte tu sala en un entorno de juego inmersivo conectando los dispositivos móviles de los jugadores con una pantalla central (TV/Tablet) utilizando Socket.IO. 

El sistema actúa como un "Sistema Operativo" modular para juegos de mesa, ofreciendo herramientas como tirar dados, gestionar turnos, llevar puntuaciones, cronometrar rondas, votaciones ciegas y repartir roles ocultos. Todo gestionado por un "Host" desde su dispositivo móvil, sin interrumpir la fluidez del juego.

---

## ✨ Características Principales

* **Pantalla Central (TV):** Muestra el estado global de la partida, resultados de dados, cronómetros, puntuaciones y códigos QR para que los jugadores se unan fácilmente.
* **Paneles de Jugador (Móvil):** Cada jugador se une a un asiento virtual (Norte, Sur, Este, Oeste) y elige un color. Desde ahí pueden interactuar con los módulos activos (tirar dados, votar, etc.).
* **Panel de Host (Móvil):** El anfitrión tiene controles maestros para modificar la configuración de los módulos en tiempo real (Hot-Swapping), pausar el tiempo, administrar puntos y configurar presets.
* **Modo Moderador:** Permite a una persona administrar la partida completa sin ocupar un turno ni recibir puntuaciones.
* **Módulos Independientes:**
  * 🔄 **Turnos:** Gestión del orden de jugadores, sentido horario/antihorario, orden personalizado y contador de rondas.
  * ⏱️ **Tiempo:** Cronómetro y temporizador regresivo configurable con alertas en la pantalla central.
  * 🎲 **Dados:** Lanzador de dados físicos, modificadores numéricos y "Golden Rolls" (dados con valores especiales como x2, +3, Mitad, etc.).
  * 🏆 **Puntos:** Tabla de puntuación en vivo con opciones de ganar por puntaje límite y agrupar jugadores en equipos.
  * ✋ **Votación:** Votaciones ciegas en vivo con opciones fijas (ej. Sí/No) o configurables dinámicamente en plena partida.
  * 🛡️ **Roles Ocultos:** Reparto secreto de roles, facciones o identidades a los teléfonos de los jugadores (ideal para juegos como *Hombre Lobo* o *Secret Hitler*).
* **Presets:** Perfiles de juego pre-guardados. Carga automáticamente configuraciones para *Catán*, *Monopoly* o juegos personalizados con un solo clic.

---

## 🛠️ Tecnologías Utilizadas

* **Frontend:** React, Vite, TailwindCSS, React Router, Lucide React (Íconos), QRCode.react.
* **Backend:** Node.js, Express, Socket.IO.
* **Comunicación:** WebSockets bidireccionales en tiempo real vía Socket.IO.

---

## 🏗️ Arquitectura y Flujo de Datos

El proyecto está diseñado bajo un modelo de estado centralizado (Single Source of Truth) alojado en el servidor Node.js. 

1. **`gameState`:** El servidor mantiene un único objeto masivo de estado (`gameState`) que contiene la configuración de los módulos, las posiciones de los jugadores, los turnos y las puntuaciones.
2. **Emisiones:** Cada vez que el Host o un jugador realizan una acción, emiten un evento al servidor (ej. `socket.emit('rollDice')`).
3. **Sincronización:** El servidor procesa la lógica, actualiza el `gameState` y lo transmite (`io.emit('gameState', gameState)`) inmediatamente a todos los clientes conectados.
4. **Reactividad:** El Frontend en React está suscrito a estos eventos y re-renderiza la interfaz al instante, asegurando que la TV y los móviles estén perfectamente sincronizados con una latencia de milisegundos.

---

## 🚀 Instalación y Uso Local

Asegúrate de tener [Node.js](https://nodejs.org/) instalado en tu computadora.

### 1. Clonar el repositorio
```bash
git clone https://github.com/tu-usuario/smart-table-os.git
cd smart-table-os
```

### 2. Iniciar el Servidor (Backend)
Abre una terminal, navega a la carpeta del backend y ejecuta:
```bash
cd backend
npm install
npm run dev
```
El servidor de Socket.IO se ejecutará en el puerto `3001` y expondrá tu IP local para que otros dispositivos en tu misma red Wi-Fi puedan conectarse.

### 3. Iniciar la Interfaz (Frontend)
Abre **otra** terminal, navega a la carpeta del frontend y ejecuta:
```bash
cd frontend
npm install
npm run dev
```
La aplicación web se ejecutará usando Vite (generalmente en el puerto `5173`). Vite se configurará automáticamente para redirigir las conexiones a la IP de tu computadora, permitiendo probar en teléfonos reales escaneando el código QR en la pantalla de la TV.

---

## 📱 Cómo probar

1. Abre `http://localhost:5173/` en el monitor principal (la pantalla de la mesa).
2. Escanea el código QR que aparece en la TV con la cámara de tu celular.
3. El primer teléfono en unirse será designado como el **Host**.
4. ¡Explora el "Panel de Control" o elige un color para comenzar a probar!

---

## 🤝 Contribuir

¡Las contribuciones son bienvenidas! Ya sea agregando nuevos módulos para juegos específicos (ej. Módulo de Cartas, Módulo de Subastas) o mejorando las interfaces.

1. Haz un *Fork* del proyecto.
2. Crea una rama para tu feature (`git checkout -b feature/NuevoModulo`).
3. Haz *Commit* a tus cambios (`git commit -m 'Agrega nuevo módulo de subastas'`).
4. Haz *Push* a tu rama (`git push origin feature/NuevoModulo`).
5. Abre un *Pull Request*.

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más detalles.
