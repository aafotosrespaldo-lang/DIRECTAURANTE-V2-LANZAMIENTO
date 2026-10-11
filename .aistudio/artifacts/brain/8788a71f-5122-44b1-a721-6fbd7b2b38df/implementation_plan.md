# Migración e Integración de Directaurante Core V2 + Client V2

Migración completa e implementación del repositorio público `https://github.com/aaphgy-blip/Core` en Google AI Studio, desplegando una plataforma gastronómica integral con arquitectura Full-Stack (Express + TypeScript en backend, React 19 + Tailwind CSS en cliente) y soporte para persistencia soberana en MongoDB.

## Decisiones Críticas y Preferencias del Usuario

> [!IMPORTANT]
> A continuación se detallan las decisiones confirmadas por el usuario durante la fase interactiva de clarificación:

- **Modo de Ejecución**: **Full-Stack completo**. Se ejecutará el servidor Express con todas las rutas soberanas de Core V2 (`/api/auth`, `/api/restaurants`, `/api/orders`, `/api/customer`, `/api/users`), integrando Vite en modo middleware para servir la SPA en el mismo puerto 3000 bajo `0.0.0.0`.
- **Persistencia en MongoDB**: **MongoDB Atlas mediante variable de entorno**. La aplicación se conectará a MongoDB utilizando la variable `MONGODB_URI` en `.env.example`. Además, se mantendrá un fallback resiliente con `mongodb-memory-server` en caso de que la cadena remota no esté presente de forma inmediata durante el arranque inicial.
- **Datos Iniciales / Semillas**: **Activado**. Se sembrará el catálogo gastronómico completo (Tacos El Pastor, Pizzería Bella Napoli, Burger House, sushi, postres) y cuentas demo preconfiguradas con diferentes roles (`customer`, `restaurant`, `driver`, `master`).

---

## 1. Visión General y Concepto Central

- **Propósito**: Directaurante Core V2 es una plataforma gastronómica directa y desacoplada que elimina intermediarios comisionistas abusivos. Permite a comensales explorar restaurantes locales, personalizar platillos con opciones y extras obligatorios/opcionales, gestionar direcciones de entrega y realizar pedidos con cálculo soberano de precios en centavos enteros e idempotencia concurrente.
- **Público Objetivo**: 
  - *Clientes*: Exploran menús, configuran productos y rastrean órdenes en tiempo real.
  - *Restaurantes*: Gestionan su cocina, estados de pedidos (`confirmed`, `preparing`, `ready_for_pickup`, `delivered`) e inventario.
  - *Administradores*: Supervisan la auditoría inmutable de eventos.
- **Valor Principal**: Transacciones directas, cálculo financiero seguro en el backend (el frontend no puede manipular precios ni tarifas) y prevención estricta de órdenes duplicadas vía `idempotency_key`.

---

## 2. Experiencia de Usuario y Diseño Visual

### Flujos Clave de Usuario
1. **Exploración de Restaurantes**: Vista principal con carrusel de categorías (Tacos, Hamburguesas, Pizza, Sushi), buscador dinámico y tarjetas informativas con calificaciones, tiempos de entrega y costo de envío.
2. **Personalización de Producto**: Modal interactivo con validación en tiempo real de requerimientos mínimos/máximos, grupos de opciones y toppings adicionales.
3. **Carrito y Checkout**: Drawer deslizable con desglose de subtotal, tarifa de servicio, costo de envío ($0 en recolección en tienda) y selección de dirección o método de retiro.
4. **Seguimiento de Órdenes (`My Orders`)**: Historial con línea de tiempo visual del estado de la orden y actualización fluida.
5. **Portal de Restaurante**: Panel operativo para cambiar el estado de órdenes entrantes con transiciones de máquina de estados auditadas.

### Identidad Visual y Tema
- **Estética**: Moderna, limpia, de alto apetito y contraste funcional enfocada en usabilidad móvil y de escritorio.
- **Paleta de Color**:
  - Acento Primario: Naranja / Ámbar gastronómico cálido (`#f97316` / `#ea580c`).
  - Superficies y Fondo: Tonos oscuros y claros coordinados (`bg-slate-50` / `bg-white` con tarjetas elevadas `border-slate-200/80` y sombras suaves).
  - Estados: Verde esmeralda para completado/abierto (`#10b981`), azul para en preparación (`#3b82f6`), rojo suave para cancelado.
- **Tipografía**: Jerarquía sans-serif con legibilidad nítida para nombres de platillos, precios formateados en moneda local y badges de estado.

---

## 3. Decisiones Técnicas y Compromisos

- **Unificación de Proceso en AI Studio (Puerto 3000)**:
  - *Enfoque*: AI Studio permite un único puerto de entrada (3000 en host `0.0.0.0`). Utilizaremos la arquitectura nativa del repositorio donde `server.ts` orquesta el backend Express y monta el servidor de desarrollo de Vite como middleware (`createViteServer({ server: { middlewareMode: true } })`).
  - *Por qué*: Garantiza que las llamadas a `/api/*` y la navegación del frontend SPA convivan perfectamente sin problemas de CORS ni puertos cruzados.
- **Gestión de Base de Datos y Dependencias Nativas**:
  - *Enfoque*: Implementar el cliente MongoDB oficial (`mongodb`) con configuración para `MONGODB_URI`. Usar `bcryptjs` en lugar del binario nativo `bcrypt` para evitar fallos de compilación `node-gyp` en el entorno Linux.
  - *Resiliencia de Conexión*: Si `MONGODB_URI` aún no ha sido configurado en el entorno de desarrollo, el servidor inicializará automáticamente el motor embebido local para que la app sea 100% navegable y funcional de inmediato.

---

## 4. Arquitectura Técnica y Estrategia de Datos

### Diagrama del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                       Cliente Web React 19                  │
│  ┌───────────────┐ ┌────────────────┐ ┌──────────────────┐  │
│  │ ExploreView   │ │ RestaurantView │ │ ProductModal     │  │
│  └───────┬───────┘ └───────┬────────┘ └────────┬─────────┘  │
│          │                 │                   │            │
│  ┌───────┴─────────────────┴───────────────────┴─────────┐  │
│  │     AppContext (Auth, Cart, ActiveRestaurant, Orders) │  │
│  └───────────────────────────┬───────────────────────────┘  │
└──────────────────────────────┼──────────────────────────────┘
                               │ HTTPS / JSON (JWT Bearer)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│               Servidor Express (server.ts : 3000)           │
│  ├── Vite SPA Middleware (en desarrollo)                    │
│  └── API Routes (/api)                                      │
│       ├── /auth         (Login, Registro de Clientes)       │
│       ├── /restaurants  (Listado, Catálogo, Productos)      │
│       ├── /orders       (Creación con Idempotencia, RBAC)   │
│       ├── /customer     (Direcciones, Perfil de Usuario)    │
│       └── /restaurant   (Operaciones del Establecimiento)   │
│                               │                             │
│       ├── Services & Repositories (Cálculo soberano)        │
│       └── MongoDB Client con Índices Únicos                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 MongoDB (Atlas / Memory Fallback)           │
│  ├── users              ├── restaurants                     │
│  ├── products           ├── categories                      │
│  ├── orders             ├── addresses                       │
│  └── audit_logs                                             │
└─────────────────────────────────────────────────────────────┘
```

### Componentes y Mapeo de Flujos
- **`server/`**:
  - `server.ts`: Punto de entrada unificado que arranca la base de datos, monta `/api` y el middleware de Vite en el puerto 3000.
  - `server/db/connection.ts`: Conexión MongoDB con creación automática de índices únicos (`users.email`, `orders.customer_id + orders.idempotency_key`) y ejecución de seed.
  - `server/db/seed.ts`: Carga de datos iniciales multirrestaurante.
  - `server/services/`: Validación estricta de precios, variantes y verificación de estados.
- **`src/direct/`**:
  - `AppContext.tsx`: Proveedor global con sincronización de carrito persistido en `localStorage`, autenticación por token JWT y notificaciones tostadas.
  - `components/`:
    - `Header.tsx`: Barra superior con selector de dirección, buscador y acceso rápido al carrito y perfil.
    - `ExploreView.tsx` & `CategoryCarousel.tsx`: Catálogo visual filtrable.
    - `RestaurantDetail.tsx`: Menú organizado por categorías gastronómicas con soporte de fotos y descripciones.
    - `ProductCustomizeModal.tsx`: Personalización guiada paso a paso.
    - `CheckoutModal.tsx`: Envío seguro con clave de idempotencia única generada por pedido (`crypto.randomUUID()`).
    - `RestaurantPortalView.tsx`: Tablero de gestión de órdenes para el personal del restaurante.

---

## 5. Fases de Ejecución

1. **Fase 1: Descarga y Migración de Archivos**:
   - Transferir los archivos del repositorio clonado a la raíz del proyecto (`server/`, `src/`, `server.ts`, `tsconfig.json`, `index.html`, etc.).
   - Normalizar `metadata.json` sincronizando nombre y descripción.
2. **Fase 2: Normalización de Dependencias y Configuración**:
   - Actualizar `package.json` con dependencias requeridas (`bcryptjs`, `cors`, `jsonwebtoken`, `mongodb`, `mongodb-memory-server`).
   - Configurar scripts de ejecución (`dev`: `tsx server.ts`).
   - Generar `.env.example` documentando `MONGODB_URI`, `JWT_SECRET`, `ENABLE_SEED` y `PORT`.
3. **Fase 3: Verificación y Compilación**:
   - Instalar dependencias con `install_applet_dependencies`.
   - Ejecutar `compile_applet` para validar que TypeScript y el bundling de Vite/Express compilan sin errores.
   - Probar y verificar la disponibilidad de la aplicación en el puerto 3000.
