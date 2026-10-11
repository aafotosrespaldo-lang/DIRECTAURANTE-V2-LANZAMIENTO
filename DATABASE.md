# Base de Datos MongoDB — Directaurante Core V2

Persistencia basada en colecciones de MongoDB mediante el driver oficial de Node.js (`mongodb`).

---

## 1. Índices Verificados y Creados en el Arranque

| Colección | Campos del Índice | Tipo | Propósito |
| :--- | :--- | :--- | :--- |
| `users` | `{ email: 1 }` | **UNIQUE** | Impide registros duplicados con el mismo correo. |
| `orders` | `{ customer_id: 1, idempotency_key: 1 }` | **UNIQUE** | Garantiza la idempotencia a nivel base de datos ante solicitudes concurrentes. |
| `orders` | `{ customer_id: 1 }` | Secundario | Búsquedas rápidas del historial de pedidos del cliente. |
| `orders` | `{ restaurant_id: 1 }` | Secundario | Consultas del tablero KDS del restaurante. |
| `orders` | `{ status: 1 }` | Secundario | Filtrado por estado operativo del pedido. |
| `orders` | `{ createdAt: 1 }` | Secundario | Ordenamiento cronológico de pedidos. |
| `addresses` | `{ user_id: 1 }` | Secundario | Consultas de direcciones guardadas por usuario. |
| `audit_logs` | `{ entity_id: 1 }` | Secundario | Búsqueda del historial de auditoría por entidad (pedido, usuario). |
| `audit_logs` | `{ timestamp: 1 }` | Secundario | Consultas de auditoría por rango de fechas. |

---

## 2. Esquema de Documentos

### `users`
```json
{
  "_id": "67040... (ObjectId)",
  "id": "usr_carlos_01",
  "email": "carlos@directaurante.com",
  "passwordHash": "$2a$10$...",
  "name": "Carlos Pérez",
  "role": "customer",
  "phone": "4621234567",
  "profile_image": null,
  "birthday": null,
  "is_active": true,
  "createdAt": "2026-10-07T...",
  "updatedAt": "2026-10-07T..."
}
```

### `restaurants`
```json
{
  "_id": "67040...",
  "id": "rest_tacos_guero",
  "owner_id": "usr_rest_owner_01",
  "name": "Taquería El Güero",
  "description": "Auténticos tacos al pastor...",
  "address": "Av. Morelos #142, Col. Centro, Pénjamo, GTO",
  "phone": "4621122334",
  "logo_url": "https://...",
  "banner_url": "https://...",
  "rating": 4.8,
  "is_active": true,
  "delivery_fee": 2500,
  "delivery_time_min": 25,
  "delivery_time_max": 40,
  "distance_km": 1.8,
  "min_order": 8000,
  "category_tags": ["Tacos", "Mexicana"],
  "schedule": {
    "monday": "17:00 - 00:00",
    "sunday": "16:00 - 23:30"
  },
  "createdAt": "2026-10-07T..."
}
```

### `products`
```json
{
  "_id": "67040...",
  "id": "prod_tacos_pastor",
  "restaurant_id": "rest_tacos_guero",
  "name": "Orden de Tacos al Pastor (5 pzas)",
  "description": "Carne marinada con piña asada...",
  "price": 8500,
  "category": "Tacos",
  "image_url": "https://...",
  "is_available": true,
  "variants": [
    {
      "id": "var_tortilla",
      "name": "Tipo de Tortilla",
      "required": true,
      "min_selections": 1,
      "max_selections": 1,
      "options": [
        { "id": "opt_maiz", "name": "Tortilla de Maíz", "price_delta": 0 },
        { "id": "opt_harina", "name": "Tortilla de Harina", "price_delta": 1500 }
      ]
    }
  ],
  "toppings": [
    { "id": "top_queso", "name": "Gratinado con Queso", "price": 2500, "is_available": true }
  ],
  "createdAt": "2026-10-07T..."
}
```

### `addresses`
```json
{
  "_id": "67040...",
  "id": "addr_carlos_home",
  "user_id": "usr_carlos_01",
  "label": "Casa",
  "street": "Av. Morelos",
  "number": "64",
  "colony": "Centro",
  "city": "Pénjamo",
  "state": "Guanajuato",
  "postal_code": "36900",
  "references": "Portón café",
  "is_default": true,
  "createdAt": "2026-10-07T..."
}
```

### `orders`
```json
{
  "_id": "67040...",
  "id": "ord_1791366281222_dflf",
  "idempotency_key": "idemp_test_1791366281221",
  "restaurant_id": "rest_tacos_guero",
  "restaurant_name": "Taquería El Güero",
  "customer_id": "usr_carlos_01",
  "customer_name": "Carlos Pérez",
  "customer_phone": "4621234567",
  "order_type": "delivery",
  "address_id": "addr_carlos_home",
  "delivery_address": "Av. Morelos #64, Centro, Pénjamo",
  "items": [
    {
      "product_id": "prod_tacos_pastor",
      "product_name": "Orden de Tacos al Pastor (5 pzas)",
      "unit_price": 8500,
      "quantity": 2,
      "variants": [
        { "group_id": "var_tortilla", "group_name": "Tipo de Tortilla", "option_id": "opt_maiz", "option_name": "Tortilla de Maíz", "price_delta": 0 }
      ],
      "toppings": [
        { "id": "top_queso", "name": "Gratinado con Queso", "price": 2500 }
      ],
      "subtotal": 22000
    }
  ],
  "subtotal": 22000,
  "extras_total": 5000,
  "delivery_fee": 2500,
  "service_fee": 500,
  "tip_amount": 1500,
  "discount_amount": 0,
  "total": 26500,
  "currency": "MXN",
  "payment_method": "cash",
  "payment_status": "pending",
  "status": "pending",
  "has_allergies": true,
  "allergies": "Cacahuate",
  "status_history": [
    {
      "status": "pending",
      "timestamp": "2026-10-07T...",
      "actor_id": "usr_carlos_01",
      "actor_role": "customer",
      "notes": "Pedido recibido por Directaurante Core V2"
    }
  ],
  "createdAt": "2026-10-07T...",
  "updatedAt": "2026-10-07T..."
}
```

### `audit_logs`
```json
{
  "_id": "67040...",
  "id": "audit_1791366281223_5ha2",
  "event": "order.created",
  "entity_type": "order",
  "entity_id": "ord_1791366281222_dflf",
  "actor_id": "usr_carlos_01",
  "actor_role": "customer",
  "details": { "total": 26500, "restaurant_id": "rest_tacos_guero" },
  "timestamp": "2026-10-07T..."
}
```
