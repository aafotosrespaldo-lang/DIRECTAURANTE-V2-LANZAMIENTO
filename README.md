# Directaurante Core V2 + Client V2

Plataforma gastronómica directa y desacoplada con backend soberano en **Node.js / Express + TypeScript**, persistencia en **MongoDB**, control de acceso basado en roles (**RBAC**), máquina de estados estricta, validación de catálogo, prevención de pedidos duplicados por **idempotencia concurrente** y cliente web en **React 19 + Tailwind CSS**.

---

## 🏗️ Arquitectura del Sistema

```
Client V2 (React 19 / SPA)
               │
               ▼  REST API / HTTPS (JWT Bearer)
Directaurante Core V2 (Express / TypeScript)
  ├── Middleware (Auth, RBAC, Ownership, ErrorHandler)
  ├── Routes (/auth, /users, /restaurants, /customer, /orders, /restaurant)
  ├── Services (AuthService, OrderService, CustomerService, RestaurantService, AuditService)
  ├── Repositories (UserRepository, OrderRepository, RestaurantRepository, etc.)
  └── Database Client (MongoDB Driver)
               │
               ▼
MongoDB (users, restaurants, products, categories, addresses, orders, audit_logs)
```

---

## 🔒 Reglas Soberanas del Core V2

1. **Persistencia Real en MongoDB:** Cero almacenamiento operativo en arrays/Maps. Todos los datos persisten en MongoDB con índices únicos y de consulta.
2. **Registro Público Seguro:** `POST /api/auth/register` crea **únicamente** cuentas con rol `customer`. La creación de roles privilegiados (`restaurant`, `driver`, `master`) requiere autorización administrativa o seed.
3. **RBAC y Ownership Estricto:**
   * Un `customer` solo puede consultar y operar sus propios pedidos y direcciones (retorna 403 Forbidden ante accesos ajenos).
   * Un `restaurant` solo puede operar pedidos pertenecientes a su establecimiento.
   * Un `driver` solo puede operar pedidos asignados a él.
   * `master` cuenta con permisos administrativos autorizados.
4. **Idempotencia Concurrente Real:** Índice único en MongoDB `{ customer_id: 1, idempotency_key: 1 }`. Si dos solicitudes idénticas llegan simultáneamente, MongoDB captura la colisión (error 11000) y el Core retorna la orden original sin duplicar documentos.
5. **Validación Estricta de Catálogo:** Se validan variantes obligatorias, opciones válidas, límites mínimos/máximos y disponibilidad de toppings. Opciones incompatibles son rechazadas con error 400.
6. **Precios y Finanzas Soberanas:** El frontend solo envía IDs y cantidades. El Core consulta MongoDB, calcula subtotales, variantes, toppings, tarifa de entrega ($0 en pickup), tarifa de servicio y total en **centavos enteros (`integer`)**.
7. **Auditoría Persistente:** Cada orden registra eventos inmutables (`order.created`, `order.confirmed`, `order.cancelled`, etc.) en la colección `audit_logs` de MongoDB.

---

## 🚀 Instalación y Puesta en Marcha

### Requisitos previos
* Node.js v20+ o v22+
* npm o bun
* MongoDB v6+ o v7+ (local o MongoDB Atlas)

### 1. Clonar e instalar dependencias
```bash
git clone https://github.com/directaurante/core-v2.git
cd core-v2
npm install
```

### 2. Variables de entorno
Crea tu archivo `.env`:
```env
MONGODB_URI="mongodb://localhost:27017/directaurante_v2"
# JWT_SECRET es estrictamente obligatorio en producción (el servidor se detiene si falta)
JWT_SECRET="clave-secreta-directaurante-produccion-2026"
CORS_ORIGIN="http://localhost:3000,http://127.0.0.1:3000"
ENABLE_SEED="false"
PORT=3000
NODE_ENV="development"
```

### 3. Ejecutar la suite de pruebas consolidada (30/30 pruebas)
```bash
npm test
```
*Las pruebas se ejecutan contra una instancia MongoDB real verificando persistencia, índices, RBAC, ownership estricto en GET /orders/:id, seguridad JWT en producción, CORS configurado, seed condicional, concurrencia y auditoría.*

### 4. Iniciar en modo desarrollo
```bash
npm run dev
```
Servidor y cliente unificados disponibles en `http://localhost:3000`.

### 5. Compilar y ejecutar para producción
Compila el frontend a `dist/` y empaqueta el backend TypeScript con esbuild a `dist/server.js`:
```bash
npm run build
npm start
```
*El comando `npm start` corre nativamente con Node (`node dist/server.js`) sin requerir runtime `tsx` en producción.*

---

## 🐳 Despliegue con Docker

El proyecto incluye `Dockerfile` y `docker-compose.yml` para levantar Core V2 y MongoDB con un solo comando:
```bash
docker-compose up --build
```

---

## 📋 Cuentas Preconfiguradas (Seed Inicial)

* **Cliente:** `carlos@directaurante.com` / `cliente123`
* **Restaurante (Taquería El Güero):** `donpepe@tacoselguero.com` / `tacos123`
