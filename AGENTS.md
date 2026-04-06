# AGENTS.md - Resto Restaurant Management System

## Project Overview

A full-stack restaurant management system with a customer-facing storefront and admin dashboard.

**Tech Stack:** Node.js (CommonJS), Express.js 5, EJS + express-ejs-layouts, Prisma ORM (SQLite), Firebase Admin SDK (auth), Sharp (AVIF image compression), Multer (uploads), express-session + connect-sqlite3, Server-Sent Events (real-time).

## Build / Run Commands

```bash
npm run dev        # Start with nodemon (auto-reload)
npm start          # Production start: node app.js
```

## Database Commands

```bash
npx prisma generate         # Regenerate Prisma client
npx prisma migrate dev      # Run migrations (dev)
npx prisma migrate deploy   # Run migrations (prod)
npx prisma studio           # Open Prisma Studio GUI
node prisma/seed.js         # Seed the database
```

## Scripts

```bash
node scripts/create-admin.js   # Create admin user
node scripts/update-menu.js    # Bulk update menu items
```

## Testing

No test framework is currently configured. `npm test` exits with an error placeholder.

## Project Structure

```
app.js                      # Express app entry point, middleware, route mounting
prisma/
  schema.prisma             # Database schema (User, Category, MenuItem, Order, etc.)
  seed.js                   # Database seeder
src/
  config/
    db.js                   # Prisma client singleton
    firebase-admin.js       # Firebase Admin SDK init
  controllers/              # Route handlers (one file per feature)
    admin/                  # Admin controllers (menu, orders, categories, etc.)
    authController.js, cartController.js, checkoutController.js, etc.
  middleware/
    adminAuth.js            # requireAdmin guard
    auth.js                 # requireAuth guard
    imageUpload.js          # Multer + Sharp AVIF compression factory
  routes/                   # Express routers (mirror controllers)
    admin/
    auth.js, cart.js, checkout.js, index.js, orders.js
  services/
    realtime.js             # SSE connection manager
  views/                    # EJS templates
    admin/                  # Admin dashboard views
    auth/                   # Login/register
    layouts/                # main.ejs, admin.ejs
    partials/               # Shared partials
    storefront/             # Customer-facing views
public/                     # Static assets (CSS, JS, uploads/)
scripts/                    # Utility scripts
```

## Code Style Guidelines

### Module System
- Use CommonJS (`require` / `module.exports`), no ES modules.

### Imports
- Node built-ins first (`path`, `fs`), then third-party packages, then local modules.
- Use relative paths from the current file.

### Naming Conventions
- **Files:** camelCase (`authController.js`, `menuController.js`)
- **Functions:** camelCase (`showLogin`, `addItem`, `generateUniqueUid`)
- **Variables:** camelCase (`menuItems`, `whereClause`, `userId`)
- **Constants:** UPPER_SNAKE_CASE for module-level config (`UPLOAD_DIR`)
- **DB Models:** PascalCase in Prisma schema (`MenuItem`, `OrderItem`)

### Controller Pattern
- Export named functions, not classes.
- Each controller function takes `(req, res)` (and `next` if needed).
- Use `async` for database operations; wrap in try/catch.
- Redirect for form submissions, return JSON for API endpoints.

### Route Pattern
- Create `express.Router()`, import controller, export router.

### Error Handling
- Use try/catch in async controller functions.
- Log errors with `console.error(err)` (or `console.error('Description', err)`).
- Return appropriate HTTP status codes: 400 (bad request), 401 (unauth), 403 (forbidden), 404 (not found), 500 (server error).
- JSON endpoints: `res.status(XXX).json({ error: 'message' })`.
- Page endpoints: `res.status(XXX).send('message')` or render an error view.

### Database Access
- Use the Prisma client singleton from `src/config/db.js`.
- Use `findMany`, `findUnique`, `create`, `update`, `upsert`, `delete` methods.
- Include relations with `include: { category: true }`.
- Use `orderBy` for consistent sorting.

### Session Handling
- User data stored in `req.session.user` (id, firebaseUid, email, role, etc.).
- Cart stored in `req.session.cart` (array of items).
- Always check `req.session.user` before protected operations.

### Image Uploads
- Use the `imageUpload` middleware factory: `imageUpload({ prefix: 'dish', uploadDir: 'categories' })`.
- Returns `[multerSingle, compressToAvif]` middleware array.
- Uploaded files are compressed to AVIF format.
- Store path as `/uploads/filename.avif` in database.

### Views
- Admin views use `layout: 'layouts/admin'`.
- Storefront views use the default layout (set to `false` in app.js, use partials instead).
- Pass `title` to every view for the page `<title>`.
- Use EJS syntax: `<%= variable %>`, `<%- include('partial') %>`.

### Environment Variables
- Load with `dotenv` at app startup: `require('dotenv').config()`.
- Reference via `process.env.VARIABLE_NAME`.
- Always provide fallbacks: `process.env.PORT || 3000`.
- See `.env.example` for required variables.

### Middleware Ordering (in app.js)
1. View engine setup
2. Body parsers (json, urlencoded)
3. Static files
4. Session middleware
5. Global template variables (user, cart, etc.)
6. Offer tracking middleware
7. Route mounting
8. 404 handler
9. Error handler

### General Rules
- No linting or formatting tools are configured; follow existing code style.
- Keep functions focused and small.
- Prefer `Promise.all` for independent async operations.
- Use `parseInt(str, 10)` for parsing integers from request params.
- Use spread conditionals for optional update fields: `...(value !== undefined && { field: value })`.
