# Arquitectura de Directaurante Core V2

## 1. Principio de Separación por Capas (Clean Architecture)

Directaurante Core V2 separa de forma estricta sus responsabilidades en capas desacopladas:

```
                            Petición HTTP
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │   Express App Router  │  (server/app.ts)
                     └───────────┬───────────┘
                                 │
            ┌────────────────────┴────────────────────┐
            ▼                                         ▼
   ┌───────────────────┐                     ┌───────────────────┐
   │  authMiddleware   │                     │   errorHandler    │  (server/middleware/)
   │  (JWT + RBAC +    │                     └───────────────────┘
   │   Ownership)      │
   └────────┬──────────┘
            │
            ▼
   ┌───────────────────┐
   │   Routes Layer    │  (server/routes/ - /auth, /restaurants, /customer, /orders)
   └────────┬──────────┘
            │
            ▼
   ┌───────────────────┐
   │  Services Layer   │  (server/services/ - Reglas de negocio y cálculo soberano)
   └────────┬──────────┘
            │
            ▼
   ┌───────────────────┐
   │ Repositories Layer│  (server/repositories/ - Abstracción de acceso a datos)
   └────────┬──────────┘
            │
            ▼
   ┌───────────────────┐
   │  Database Client  │  (server/db/connection.ts - MongoDB Driver + Índices)
   └────────┬──────────┘
            │
            ▼
   ┌───────────────────┐
   │      MongoDB      │  (Colecciones con índices únicos y compuestos)
   └───────────────────┘
```

---

## 2. Abstracción de Repositorios

Los servicios (`OrderService`, `AuthService`, etc.) **no** interactúan directamente con el driver de MongoDB. Toda la persistencia pasa por repositorios especializados:
* `UserRepository` — Búsqueda por email, ID, creación y actualización de perfiles.
* `RestaurantRepository` — Búsqueda por ID, filtros de categoría y búsqueda textual.
* `CategoryRepository` — Listado de categorías ordenadas.
* `ProductRepository` — Catálogo por restaurante y validación de disponibilidad.
* `AddressRepository` — CRUD de direcciones con alternancia de dirección predeterminada.
* `OrderRepository` — Inserción atómica con control de colisión por `idempotency_key` (código 11000 de MongoDB), consultas por cliente y restaurante.
* `AuditLogRepository` — Inserción append-only de eventos de auditoría.

---

## 3. Modelo de Seguridad y RBAC

### Roles Definidos
1. `customer` — Comensal final.
2. `restaurant` — Dueño/operador de cocina.
3. `driver` — Repartidor asignado.
4. `master` — Administrador del sistema.

### Matriz de Ownership
* **Pedidos:**
  * `customer`: Solo puede consultar (`GET /api/orders/:id`) sus propios pedidos (`customer_id === user.id`). Solo puede cancelar si el estado es `pending`.
  * `restaurant`: Solo puede consultar y operar pedidos pertenecientes a su restaurante (`restaurant_id === restaurant.id`). Puede confirmar, preparar, marcar listo o cancelar.
  * `driver`: Solo puede operar pedidos que le han sido asignados (`driver_id === driver.id`).
  * `master`: Acceso administrativo auditado.
* **Direcciones:**
  * Los clientes solo pueden consultar, crear, modificar y eliminar direcciones asociadas a su `user_id`.

---

## 4. Idempotencia y Manejo de Concurrencia

Para evitar pedidos duplicados por latencia de red o clics simultáneos:
1. El cliente envía un `idempotency_key`.
2. MongoDB cuenta con un índice compuesto único `{ customer_id: 1, idempotency_key: 1 }`.
3. Al recibir dos solicitudes simultáneas con la misma clave, MongoDB acepta la primera e inmediatamente arroja un error `E11000 duplicate key` en la segunda.
4. `OrderRepository.insertOrderAtomic` captura el error 11000, consulta la orden ganadora y la retorna con status 200 y bandera `isDuplicate: true`.

---

## 5. Auditoría Inmutable

Cada cambio crítico genera un documento en `audit_logs` con:
* `event`: Identificador del evento (`order.created`, `order.confirmed`, `order.status_preparing`, `user.registered`).
* `entity_type`: Tipo de entidad (`order`, `user`, `address`).
* `entity_id`: ID de la entidad afectada.
* `actor_id` y `actor_role`: Quién ejecutó la acción.
* `details`: Snapshot de datos relevantes.
* `timestamp`: Fecha ISO de ocurrencia.
