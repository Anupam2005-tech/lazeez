# Comprehensive Technical Reference & User Manual
## Resto Restaurant Management System 

*Version 1.0.0 | Generated: March 2026*

Welcome to the definitive reference manual for the **Resto Restaurant Management System**. This document expands heavily upon all prior instructions. It serves as an exhaustive guide, describing every single directory, file, and line of architectural logic behind the entire application. It explains *why* the stack was chosen, *how* each component interacts with others, and precisely *what* every file does in the pipeline.

By reading this 15-20 page equivalent reference, developers will have zero ambiguity regarding the flow of data, state management, routing paradigms, and security implementations within the Resto application.

---

# Table of Contents
1. **System Architecture Overview**
2. **Root Directory Documentation**
3. **Database Layer (`/prisma`)**
4. **Configuration & Services (`/src/config` & `/src/services`)**
5. **Middleware Subsystem (`/src/middleware`)**
6. **Storefront Operations (Controllers & Routes)**
7. **Admin Dashboard Operations (Controllers & Routes)**
8. **View Templating Engine (`/src/views`)**
9. **Static Assets & Public Directory (`/public`)**
10. **Utility Scripts (`/scripts`)**
11. **Setup, Initialization, & Default Environment**

---

# 1. System Architecture Overview

The Resto Management System operates on a strict Model-View-Controller (MVC) paradigm implemented via Node.js and Express.js v5.

- **The Model:** Handled by Prisma ORM interacting with a lightweight SQLite database.
- **The View:** Rendered server-side using EJS (Embedded JavaScript) templates styled via Tailwind CSS grids and Flexbox.
- **The Controller:** Modularized JavaScript files grouping business logic together, keeping Express routes extremely lean.

### Core Data Flow
When a user accesses `http://localhost:3000/orders`:
1. The Express `app.js` catches the request.
2. It hits the `auth.js` middleware to verify if the user's session cookie exists.
3. Once passed, the `indexRoutes` diverts the request to `/src/routes/orders.js`.
4. The router calls `ordersController.myOrders()`.
5. The controller asks the Prisma `db.js` layer to fetch orders where `userId === session.user.id`.
6. The controller passes this raw JSON array into `res.render('storefront/orders')`.
7. EJS compiles the HTML dynamically and streams it to the user.

---

# 2. Root Directory Documentation

The root directory acts as the orchestration layer. It bootstraps the application and defines dependencies.

### `app.js`
This is arguably the most critical file. It is the heart of the Express application.
- **Line 1-10 (Imports):** Pulls in core libraries like `express`, `path`, `express-session`, `dotenv`, and initializes `connect-sqlite3` to ensure that user sessions survive server restarts.
- **Line 12-17 (Template Setup):** Configures EJS. Sets the global views directory to `src/views`. Notably explicitly sets `app.set('layout', false)` because the storefront uses manual EJS `<%- include() %>` partials, while the admin panel uses dynamic `express-ejs-layouts`.
- **Line 24-31 (Session Storage):** Secures the web application. A cookie is spawned for users lasting exactly one week. The actual session variables are stored in `sessions.db`.
- **Line 33-77 (Global Locals):** Any variable placed on `res.locals` becomes accessible inside *every single EJS file*. This is why `user`, `cart`, `unseenOfferCount`, and Firebase environment keys don't need to be passed individually by controllers. They are intercepted here globally.
- **Line 90-117 (Server-Sent Events):** The `/events` endpoint allows browsers to connect natively to a stream. Without needing heavy WebSockets, the server can push raw JSON text to any connected client. This file intercepts requests here and registers them into the `realtime.js` service.
- **Line 119-145 (Mounting & Errors):** Routes are mounted into their respective URL trees (e.g., `/admin` goes to `adminRoutes`). At the bottom, a 404 catch-all and a 500 stack-trace printer prevent the Node process from silently dying.

### `package.json`
Defines the Node environment.
- **Dependencies:** Specifies exact versions to prevent breaking changes. `better-sqlite3` is used for high-performance synchronous SQLite queries. `sharp` and `multer` form the image upload pipeline. `firebase-admin` is used for securely checking UID tokens.
- **Scripts:** `start` (node app.js) is meant for production. `dev` (nodemon app.js) watches for file saves and restarts the server instantly. `prisma: seed` maps to creating dummy data.

### `.env.example` & `.env`
Environment variables dictate behavior that shouldn't be hardcoded into Git.
- **Why it's necessary:** Different machines have different paths, different database URLs, and entirely different API keys. The `.env` provides a local sandbox isolation map for Firebase keys, CSRF secrets, and ports.

### `README.md` & `AGENTS.md`
- **README:** The standard git greeting explaining installation and high-level features.
- **AGENTS.md:** A specialized developer ruleset instructing LLMs and team members on exact coding behaviors. It enforces CommonJS standards, Prisma singletons, and route formatting.

---

# 3. Database Layer (`/prisma`)

This folder manages how JavaScript objects map to SQL tables.

### `schema.prisma`
The central nervous system of data structure.
- **Generator & Provider:** Dictates the engine (`sqlite`) and the client generator (`prisma-client-js`).
- **Models:**
  - `User`: Handles identity. Relates conditionally to `Order` and `Address`. Employs `role` (enum abstraction: 'admin' or 'customer').
  - `Category` & `MenuItem`: Core content. `MenuItem` has a one-to-many relationship with `Category`. MenuItems have constraints like `isVeg` and `available`.
  - `Order` & `OrderItem`: A finalized shopping cart. `Order` holds the total sum, the status (`Pending`, `Preparing`, `Completed`), and relates to many `OrderItems` representing individual dishes the user locks in at the time of purchase.
  - `Offer`: Standalone promotional objects designed to create urgency (discount popups).
  - `Feedback`: Textual reviews submitted by users.

### `seed.js`
The database populator.
- **Role:** Empty databases make testing the UI impossible. `seed.js` uses `bcryptjs` to hard-hash default passwords and uses `prisma.create` loops to generate dozens of items (Biryani, Pasta, Drinks) automatically.
- **Default Credentials Built Here:**
  - Admin: `admin@resto.com` (pass: `admin123`)
  - User: `user@resto.com` (pass: `user123`)
- **Execution:** Runs automatically via `npx prisma db seed`.

---

# 4. Configuration & Services (`/src/config` & `/src/services`)

### `src/config/db.js`
- **Content:** Exact logic: `const prisma = new PrismaClient(); module.exports = prisma;`.
- **Why it's necessary:** If every controller creates its own `new PrismaClient()`, Node will spawn hundreds of database connections until SQLite locks up and crashes with an `EBUSY` error. Establishing a singleton connection pool prevents memory leaks.

### `src/config/firebase-admin.js`
- **Content:** Pulls `FIREBASE_PROJECT_ID`, Private Keys, and Client Emails from the `.env` to initialize the Admin SDK.
- **Why it's necessary:** The client-side Firebase SDK can be spoofed by a malicious browser. The Admin SDK allows the Node server to securely cross-reference Firebase tokens without trusting the browser's payload.

### `src/services/realtime.js`
- **Content:** A proprietary Server-Sent Events (SSE) manager.
- **Mechanics:** It maintains two Maps in memory: `adminClients` and `userClients`. When a user visits `/events`, they are pushed into an array.
- **Trigger Actions:** `notifyAdminNewOrder(order)` iterates over all connected admin responses and forces a `res.write()` string containing JSON. `notifyUserOrderStatus(userId, orderId, status)` specifically searches for the individual user and pushes an updated timeline bar.
- **Why not WebSockets (Socket.io)?** SSE is natively supported by HTTP, requires zero extra libraries on the frontend, and acts seamlessly for unidirectional (server-to-client) data streams.

---

# 5. Middleware Subsystem (`/src/middleware`)

Middleware files act as checkpoints before a route accesses a controller.

### `auth.js`
- **Mechanics:** Checks if `req.session` and `req.session.user` exist. If so, it calls `next()`. If not, it halts execution and safely redirects the user to `/auth/login?redirect=...`.
- **Purpose:** Protects endpoints like `/checkout` and `/profile`.

### `adminAuth.js`
- **Mechanics:** Identical to `auth.js`, except it specifically performs a second check: `if (req.session.user.role !== 'admin')`. If standard users try accessing `/admin/menu`, this file throws a `403 Forbidden` error.
- **Purpose:** Segregates business powers from end-user powers.

### `imageUpload.js`
Instead of manually processing buffer streams everywhere, this acts as a global factory.
- **Mechanics:** First, it uses `multer({ storage: multer.memoryStorage() })`. It intercepts incoming form fields targeting `image`. It does *not* write them to disk immediately.
- **Second Stage (Sharp):** It pipes that memory buffer to `sharp()`. It forcefully resizes standardizations, converts the file exclusively to the `.avif` format (which is 50% smaller than WebP and 80% smaller than JPEG), and generates a UUID filename. It then explicitly modifies `req.file.filename` so the next controller can just grab the optimized path string and toss it in the database.
- **Why it's necessary:** Prevents 10MB iPhone photos from crashing the server's bandwidth quotas.

---

# 6. Storefront Operations (Controllers & Routes)

*Path: `/src/controllers` and `/src/routes/`*

### `homeController.js` & `index.js` routes
- **Overview:** The primary landing mechanism.
- **Logic:** Queries Prisma for all Categories and all MenuItems where `available: true`. Groups items under categories. Grabs the most recent `Offer` for the hero banner. Passes everything to `res.render('storefront/home')`.

### `cartController.js` & `cart.js` routes
- **Overview:** The non-destructive shopping logic.
- **Logic:** Operates entirely independently of the database. When someone POSTs to `/cart/add`, the controller finds the item in the DB just to verify the price, then pushes an object `{ id, name, price, quantity: 1 }` into the `req.session.cart` array. If an item exists, it increments `quantity`.
- **Why Session?** By using sessions, customers can browse anonymously. They only hit the database (and authentication logic) once they explicitly commit to paying.

### `checkoutController.js` & `checkout.js` routes (Protected by `auth.js`)
- **Overview:** Translates the ephemeral Cart Session into a concrete Database Order.
- **Logic:** 
  1. Validates the cart isn't empty.
  2. Queries the user's saved Addresses.
  3. Calculates Subtotal, applies Platform Fees and Delivery metrics via the Settings table.
  4. Once confirmed, creates an `Order` using Prisma transitions.
  5. Clears `req.session.cart = []`.
  6. **Crucial Step:** Triggers `req.app.locals.realtime.notifyAdminNewOrder()`.

### `authController.js` & `auth.js`
- **Overview:** Login and Registrations.
- **Logic:** Provides two methods. An offline method uses `bcrypt.compareSync` on an email entry against the `User` DB table. The online method receives an `idToken` from the frontend, uses `firebaseAdmin.auth().verifyIdToken()`, grabs the UID, and issues a session.

---

# 7. Admin Dashboard Operations (Controllers & Routes)

*Path: `/src/controllers/admin/` and `/src/routes/admin/`* (Strictly protected by `adminAuth.js`)

### `dashboardController.js`
- **Logic:** The analytical brain. Groups orders by timestamp spanning the last 7 days. Retrieves the count of `Pending` items immediately requiring attention. Injects this highly condensed JSON to EJS, which feeds it straight into `<canvas id="revenueChart">` mapped via Chart.js scripts.

### `menuController.js` & `categoriesController.js`
- **Logic:** Full CRUD operations over the menu. 
- **Notable Flow:** `POST /admin/menu/new` is prefixed by `imageUpload`. The controller waits for the upload to complete, accepts the fields from `req.body` (extracting strings, parsing floats for prices), applies structural validation, and inserts it. If an old item is overwritten, Node `fs.unlinkSync` is utilized to delete the old `.avif` file from the disk to prevent orphaned files stacking up forever.

### `ordersController.js`
- **Logic:** The management hub. Uses Prisma's `include` to fetch Orders nested with their exact `OrderItem` models. Allows admins to POST a `{ status: 'Preparing' }` update. 
- **Action:** Immediately calls `realtime.notifyUserOrderStatus(userId)`, fulfilling the live-tracking circle.

---

# 8. View Templating Engine (`/src/views`)

Resto rejects pure Single Page Application frameworks (like React/Vue) in favor of Server-Side Rendering (SSR). This prevents UI layout shifts and guarantees fast indexing.

### `/src/views/layouts/`
- **`admin.ejs`:** Uses `express-ejs-layouts`. Holds the `<head>`, Tailwind script imports, the left-hand Sidebar navigation map, and the `<%- body %>` substitution clause. Any admin page rendered automatically wraps itself inside this skeleton.

### `/src/views/storefront/`
- Does avoiding a layout. Files like `home.ejs`, `cart.ejs`, and `checkout.ejs` manually include top-level Navigation bars using `<%- include('../partials/navbar') %>` and footers with `<%- include('../partials/footer') %>`. This allows individual pages to load specialized ad-hoc scripts without bloating a global layout.

### Data Injection Mechanics
In every `.ejs` file, you'll see `<%= item.name %>` tags. Node processes this on the backend. When the HTML hits the browser, it is fully compiled static text. For dynamic scripts (like passing order metrics to Chart.js), the backend uses `<%- JSON.stringify(data) %>` inside hidden script tags, allowing standard client JS to safely read node-injected data objects.

---

# 9. Static Assets & Public Directory (`/public`)

Everything inside `/public` is universally accessible by anyone.

### `/public/css/` & `/public/js/`
- **Roles:** Holds custom CSS variables and client-side behavior specifically built for EJS views, such as managing the EventSource listeners for the `/events` stream to trigger toaster notifications dynamically.

### `/public/uploads/`
- **Roles:** The filesystem repository for dynamically uploaded category representations and menu dish images. Excluded via `.gitignore` to prevent massive repository bloat, but automatically created upon first run.

---

# 10. Utility Scripts (`/scripts`)

Located in the `/scripts` folder, these files are standalone Node executables meaning they don't rely on Express running. They interface with Prisma immediately.

### `create-admin.js`
- **Command:** `node scripts/create-admin.js <email>`
- **Logic:** Checks the DB for the given email. If it exists, it mutates the `role` field directly to `'admin'`.
- **Necessity:** If the frontend doesn't supply a backend UI for permission escalation due to security, command-line direct database intervention is the safest foolproof way to grant ultimate access.

### `update-menu.js`
- **Command:** `node scripts/update-menu.js`
- **Logic:** A templated batch script. Used by developers if the restaurant needs to apply a sudden universal 5% price hike to every item, or toggle `available: false` universally. Executes via Prisma `updateMany`.

---

# 11. Setup, Initialization, & Default Environment

By documenting every layer intricately above, the sequence of operations becomes radically clear.

1. **System Introspection:** The server boots via `app.js`.
2. **Path Setup:** `/public` becomes the image server.
3. **Template Boot:** `/src/views` becomes the UI compiler.
4. **Database Verification:** `db.js` talks directly to `dev.db` via Prisma singletons.
5. **Route Registration:** `/admin` tree is mounted behind `adminAuth.js` shields. `/checkout` is mounted behind `auth.js`.
6. **Execution Listening:** `app.listen(3000)` opens the networking ports.
7. **Ongoing Events:** Session variables handle shopping. Database mutations handle inventory. SSE streams handle rapid UI refreshing.

### Bootstrapping Default Users
Upon running `node prisma/seed.js`, a pristine testing environment is finalized. It yields two critical testing vectors:
- **`user@resto.com` (pass: `user123`)**: Test the entire anonymous-to-authenticated checkout cart flow.
- **`admin@resto.com` (pass: `admin123`)**: Access the `dashboardController`, observe incoming live orders from dummy users, and rapidly manage the uploaded categories.

*--- End of General Technical Protocol & Resto Management Framework Documentation ---*
