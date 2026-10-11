# Especificación de Endpoints — Directaurante Core V2

Todos los endpoints tienen como prefijo `/api`. Todas las respuestas exitosas devuelven `{ success: true, ... }` y los errores devuelven `{ success: false, error: "mensaje" }`.

---

## 1. Autenticación (`/api/auth`)

### `POST /api/auth/register`
Registra un nuevo usuario en el Core.
* **Payload:**
  ```json
  {
    "email": "carlos@directaurante.com",
    "password": "passwordSeguro123",
    "name": "Carlos Pérez",
    "phone": "4621234567",
    "role": "customer"
  }
  ```
* **Respuesta (201 Created):**
  ```json
  {
    "success": true,
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "usr_123",
      "email": "carlos@directaurante.com",
      "name": "Carlos Pérez",
      "role": "customer",
      "phone": "4621234567",
      "profile_image": null,
      "birthday": null,
      "is_active": true
    }
  }
  ```

### `POST /api/auth/login`
Inicia sesión con credenciales.
* **Payload:** `{ "email": "...", "password": "..." }`
* **Respuesta (200 OK):** Retorna `token` JWT y objeto `user`.

### `GET /api/auth/me`
Obtiene el perfil del usuario autenticado (requiere `Authorization: Bearer <token>`).

### `PUT /api/users/me`
Actualiza nombre, teléfono, imagen o fecha de cumpleaños del usuario autenticado.

---

## 2. Restaurantes y Catálogo (`/api/restaurants`)

### `GET /api/restaurants`
Lista restaurantes activos. Soporta filtros `?category=Tacos` y `?query=smash`.

### `GET /api/restaurants/:id`
Detalle de restaurante con información logística y tarifas en centavos:
* `delivery_fee`: Tarifa de envío en centavos (ej: `2500` = $25.00 MXN).
* `min_order`: Monto mínimo en centavos (ej: `8000` = $80.00 MXN).
* `distance_km`, `delivery_time_min`, `delivery_time_max`.

### `GET /api/restaurants/:id/categories`
Lista de nombres de categorías que ofrece el restaurante.

### `GET /api/restaurants/:id/products`
Catálogo de platillos con variantes obligatorias/opcionales y toppings con precios en centavos.

### `GET /api/categories`
Catálogo global de categorías del sistema.

---

## 3. Clientes y Direcciones (`/api/customer`)

*(Requieren header `Authorization: Bearer <token>`)*

* `GET /api/customer/profile` — Perfil del cliente.
* `PUT /api/customer/profile` — Modificación de perfil.
* `GET /api/customer/addresses` — Lista de direcciones guardadas.
* `POST /api/customer/addresses` — Alta de dirección con calle, número, colonia, ciudad y referencias.
* `PUT /api/customer/addresses/:id` — Actualización de dirección.
* `DELETE /api/customer/addresses/:id` — Eliminación de dirección.

---

## 4. Pedidos (`/api/orders`)

### `GET /api/checkout/fees` (Público)
Retorna las tarifas oficiales del sistema:
```json
{
  "success": true,
  "data": {
    "service_fee": 500,
    "default_delivery_fee": 2500,
    "minimum_order": 0,
    "currency": "MXN"
  }
}
```

### `POST /api/orders`
Crea una orden con validación soberana del Core y protección contra duplicados.
* **Headers opcionales:** `x-idempotency-key: <uuid-o-timestamp>`
* **Payload:**
  ```json
  {
    "restaurant_id": "rest_tacos_guero",
    "order_type": "delivery",
    "address_id": "addr_123",
    "customer_phone": "4621234567",
    "items": [
      {
        "product_id": "prod_tacos_pastor",
        "quantity": 2,
        "variants": [{ "group_id": "var_tortilla", "option_id": "opt_maiz" }],
        "toppings": ["top_queso"],
        "notes": "Sin cebolla"
      }
    ],
    "payment_method": "cash",
    "tip_amount": 1500,
    "has_allergies": true,
    "allergies": "Cacahuate",
    "notes": "Tocar el timbre",
    "idempotency_key": "idemp_unico_123"
  }
  ```
* **Respuesta:**
  * Si es orden nueva: `201 Created` con desglose inmutable sellado por el Core.
  * Si la clave de idempotencia ya existía: `200 OK` con `{ is_duplicate: true }` y la orden original intacta.

### `GET /api/orders`
Lista pedidos del usuario (o del restaurante si el rol es restaurante).

### `GET /api/orders/:id`
Detalle histórico completo del pedido.

### `POST /api/orders/:id/status`
Avanza el estado del pedido validando la máquina de estados.

---

## 5. Portal Operativo del Restaurante (`/api/restaurant`)

* `GET /api/restaurant/orders?restaurant_id=:id` — Tablero KDS de pedidos entrantes.
* `POST /api/restaurant/orders/:id/accept` — Confirma el pedido (`confirmed`).
* `POST /api/restaurant/orders/:id/reject` — Rechaza y cancela el pedido (`cancelled`).
* `POST /api/restaurant/orders/:id/status` — Cambia estado a `preparing`, `ready`, `delivering`, `delivered`.
