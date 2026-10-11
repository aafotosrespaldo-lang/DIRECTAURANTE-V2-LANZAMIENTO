# Guía de Despliegue — Directaurante Core V2

Directaurante Core V2 fue diseñado para ser **100% portable y desacoplado**. Puede ejecutarse en cualquier entorno que soporte Node.js y MongoDB (Railway, Render, AWS, Google Cloud Run, o cualquier VPS con Docker).

---

## Opción 1: Despliegue con Docker y Docker Compose

### 1. Iniciar todo el stack (Backend + Frontend + MongoDB)
```bash
docker-compose up -d
```
Esto levantará:
* `mongodb`: Contenedor oficial de MongoDB en el puerto `27017` con volumen persistente `mongodb_data`.
* `directaurante-core`: Contenedor Node.js corriendo Core V2 en el puerto `3000`.

### 2. Verificar logs
```bash
docker-compose logs -f directaurante-core
```

---

## Opción 2: Despliegue en Railway

1. Crea un nuevo proyecto en [Railway.app](https://railway.app).
2. Añade un servicio de **Database: MongoDB**.
3. Añade un servicio de **GitHub Repo** apuntando a tu repositorio de Directaurante Core V2.
4. En las variables de entorno de tu servicio:
   * `MONGODB_URI`: Enlaza la variable `${{MongoDB.MONGO_URL}}`.
   * `JWT_SECRET`: Una clave segura aleatoria (ej: `openssl rand -hex 32`).
   * `PORT`: `3000` (o Railway lo proveerá automáticamente en `$PORT`).
5. Comando de inicio (Build & Start):
   * Build Command: `npm run build`
   * Start Command: `npm start`

---

## Opción 3: Despliegue en Render / VPS Linux

1. Instala Node.js 22 y MongoDB en el servidor.
2. Clona el repositorio:
   ```bash
   git clone https://github.com/directaurante/core-v2.git
   cd core-v2
   npm install
   ```
3. Construye el cliente web:
   ```bash
   npm run build
   ```
4. Configura el servicio con PM2:
   ```bash
   pm2 start server.ts --name "directaurante-core-v2" --interpreter ./node_modules/.bin/tsx
   pm2 save
   pm2 startup
   ```
