# 🏛️ Sistema de Gestión de Columbario

API RESTful para administración completa de nichos, clientes, ventas y pagos con crédito a 18 meses.

## 🚀 Características

- **Gestión de Nichos**: 357 nichos organizados por módulos/secciones
- **Gestión de Clientes**: Registro con contactos de emergencia
- **Sistema de Ventas**: Crédito a 18 meses sin intereses
- **Transacciones Atómicas**: Integridad en operaciones financieras
- **Tablas de Amortización**: Generación automática de pagos mensuales

## 🛠️ Tecnologías

- Node.js + Express.js
- MongoDB Atlas + Mongoose
- Transacciones ACID
- Validaciones completas

## 📦 Instalación

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/church-columbarium-management-system.git
cd church-columbarium-management-system

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de MongoDB Atlas

# Poblar base de datos
npm run seed:niches
npm run seed:customers

# Iniciar servidor
npm run dev
```

## 🔧 Configuración de Variables de Entorno

Crear un archivo `.env` en la raíz del proyecto:

```env
# MongoDB
MONGODB_URI=mongodb+srv://usuario:password@cluster.mongodb.net/columbarium?retryWrites=true&w=majority

# Servidor
PORT=3000
NODE_ENV=development

# Opcionales
LOG_LEVEL=info
```

## 📡 Endpoints de la API

**Base URL:** `http://localhost:3000/api`

### 🗄️ Nichos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/niches` | Lista nichos con filtros |
| `GET` | `/niches/code/:code` | Busca nicho por código |
| `PATCH` | `/niches/:id` | Actualiza estado de nicho |

**Ejemplo de filtros:**
```bash
GET /api/niches?status=disponible
GET /api/niches?module=A&section=1
```

### 👥 Clientes

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/customers` | Crea nuevo cliente |
| `GET` | `/customers?search=texto` | Busca clientes por nombre/RFC |

**Ejemplo de creación:**
```json
POST /api/customers
{
  "nombre": "Juan Pérez",
  "rfc": "PEJX850101XXX",
  "telefono": "6181234567",
  "email": "juan@example.com",
  "direccion": "Calle Principal #123",
  "contactoEmergencia": {
    "nombre": "María Pérez",
    "telefono": "6189876543",
    "relacion": "Hermana"
  }
}
```

### 💰 Ventas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/sales` | Crea venta con transacción |

**Ejemplo de venta:**
```json
POST /api/sales
{
  "customerId": "507f1f77bcf86cd799439011",
  "nicheId": "507f1f77bcf86cd799439012",
  "precioTotal": 50000,
  "enganche": 10000,
  "plazoMeses": 18
}
```

## 📊 Scripts Disponibles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Inicia el servidor en modo desarrollo con nodemon |
| `npm start` | Inicia el servidor en modo producción |
| `npm run seed:niches` | Crea 357 nichos en la base de datos |
| `npm run seed:customers` | Crea clientes de prueba |
| `npm run test:sale` | Ejecuta prueba del flujo de venta completo |
| `npm run check:data` | Verifica integridad de datos |

**Ejemplo de uso:**
```bash
# Desarrollo con recarga automática
npm run dev

# Poblar datos iniciales
npm run seed:niches
npm run seed:customers

# Probar funcionalidad de ventas
npm run test:sale
```

## 🔐 Validaciones Clave

### Transacciones Atómicas
- Todas las ventas se ejecutan dentro de transacciones MongoDB
- Rollback automático en caso de error
- Garantiza consistencia de datos

### Integridad de Datos
- Códigos únicos para nichos (Ej: `A-1-001`)
- Folios únicos para ventas con formato `COL-YYYYMMDD-XXXX`
- RFC validado con formato oficial mexicano
- Estados de nicho controlados: `disponible`, `vendido`, `reservado`

### Tabla de Amortización
```javascript
// Generación automática al crear venta
{
  "numeroMes": 1,
  "fechaVencimiento": "2025-02-01",
  "montoPagar": 2222.22,
  "saldoPendiente": 37777.78,
  "estado": "pendiente"
}
```

## 🧪 Pruebas

### Probar Endpoints con cURL

```bash
# Listar nichos disponibles
curl http://localhost:3000/api/niches?status=disponible

# Buscar nicho por código
curl http://localhost:3000/api/niches/code/A-1-001

# Crear cliente
curl -X POST http://localhost:3000/api/customers \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Juan Pérez","rfc":"PEJX850101XXX","telefono":"6181234567"}'

# Crear venta
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -d '{"customerId":"...","nicheId":"...","precioTotal":50000,"enganche":10000,"plazoMeses":18}'
```

## 🐛 Manejo de Errores

El sistema incluye middleware centralizado de errores que responde con formato estándar:

```json
{
  "error": true,
  "message": "Descripción del error",
  "details": "Información adicional (solo en desarrollo)"
}
```

### Códigos de Estado HTTP

| Código | Descripción |
|--------|-------------|
| `200` | Operación exitosa |
| `201` | Recurso creado exitosamente |
| `400` | Error de validación |
| `404` | Recurso no encontrado |
| `409` | Conflicto (nicho no disponible, etc.) |
| `500` | Error interno del servidor |

## 📝 Modelos de Datos

### Nicho
```javascript
{
  codigo: "A-1-001",
  modulo: "A",
  seccion: 1,
  numero: 1,
  precio: 50000,
  estado: "disponible", // disponible | vendido | reservado
  createdAt: Date,
  updatedAt: Date
}
```

### Cliente
```javascript
{
  nombre: "Juan Pérez",
  rfc: "PEJX850101XXX",
  telefono: "6181234567",
  email: "juan@example.com",
  direccion: "Calle Principal #123",
  contactoEmergencia: {
    nombre: "María Pérez",
    telefono: "6189876543",
    relacion: "Hermana"
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Venta
```javascript
{
  folio: "COL-20250101-0001",
  cliente: ObjectId,
  nicho: ObjectId,
  precioTotal: 50000,
  enganche: 10000,
  saldoPendiente: 40000,
  plazoMeses: 18,
  pagoMensual: 2222.22,
  tablaAmortizacion: [
    {
      numeroMes: 1,
      fechaVencimiento: Date,
      montoPagar: 2222.22,
      saldoPendiente: 37777.78,
      estado: "pendiente",
      fechaPago: null,
      montoPagado: null
    }
  ],
  estado: "activo", // activo | completado | cancelado
  createdAt: Date,
  updatedAt: Date
}
```

## 🚦 Estado del Proyecto

- [x] Modelos de datos definidos
- [x] Endpoints CRUD básicos
- [x] Sistema de transacciones
- [x] Generación de tabla de amortización
- [x] Scripts de seed y testing
- [ ] Sistema de pagos/abonos
- [ ] Reportes y estadísticas
- [ ] Dashboard administrativo
- [ ] Sistema de notificaciones

## 🤝 Contribución

1. Fork el proyecto
2. Crea tu rama de feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request


⭐ Si este proyecto te fue útil, considera darle una estrella en GitHub