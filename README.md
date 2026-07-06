# OmniWallet · Generador de Propuestas Comerciales

Aplicación web multiusuario para generar propuestas económicas y de implementación personalizadas para leads de OmniWallet.

## Stack

- **Framework:** Next.js 14 (App Router) + TypeScript
- **UI:** React + Tailwind CSS
- **Base de datos:** PostgreSQL + Prisma ORM
- **Auth:** Auth.js (NextAuth v5) con sesiones JWT
- **Validación:** Zod
- **Tests:** Vitest

## Inicio rápido (Docker)

```bash
docker compose up
```

Abre [http://localhost:3000](http://localhost:3000)

## Desarrollo manual

### Prerrequisitos

- Node.js 20+
- PostgreSQL (o Docker para la BD)

### Pasos

```bash
# 1. Instalar dependencias
npm install --ignore-scripts

# 2. Variables de entorno
cp .env.example .env
# Edita .env con tu DATABASE_URL

# 3. Migraciones de base de datos
DATABASE_URL=... npx prisma migrate dev

# 4. Seed (datos de ejemplo + usuarios)
DATABASE_URL=... npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts

# 5. Servidor de desarrollo
npm run dev
```

### Credenciales de desarrollo

| Rol   | Email                    | Contraseña |
|-------|--------------------------|------------|
| Admin | admin@omniwallet.com     | admin123   |
| Sales | sales@omniwallet.com     | sales123   |

## Tests

```bash
npm run test:run
```

Todos los casos del motor de precios están testeados:
- Advanced (3.900 incluidas) + 4.300 actividades → **439 €/mes** ✅
- Starter (650 incluidas) + 1.650 actividades → **139 €/mes** ✅  
- 13.000 actividades adicionales por tramos → **840 €** ✅

## Fases del proyecto

| Fase | Estado | Descripción |
|------|--------|-------------|
| 0 | ✅ | Scaffold: Next.js + Prisma + auth + motor de precios |
| 1 | ✅ | Motor de cálculo (`lib/pricing.ts`) + tests |
| 2 | 🔜 | Auth + CRUD propuestas + configurador completo |
| 3 | 🔜 | Importación de marca (scraping server-side) |
| 4 | 🔜 | Plantilla propuesta + generación PDF con Playwright |
| 5 | 🔜 | Compartir: enlaces públicos de solo lectura |
| 6 | 🔜 | Admin: gestión usuarios y catálogos |
| 7 | 🔜 | Pulido, responsive, e2e |
| 8 | 🔜 | Módulo B: Prospección Apollo + Attio |

## Variables de entorno

Ver `.env.example` para la lista completa.

## Marca OmniWallet

Coloca los logos en `assets/brand/`:
- `logo-color.png` — fondo transparente (para fondos claros)
- `logo-blanco.png` — todo blanco (para fondos oscuros)
