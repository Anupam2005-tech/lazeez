# Lazeez - Premium Restaurant Management System

![Project Badge](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge) ![Version](https://img.shields.io/badge/Version-1.0.3-blue?style=for-the-badge) ![Node.js](https://img.shields.io/badge/Node.js-Express_5-success?style=for-the-badge&logo=nodedotjs) ![Prisma](https://img.shields.io/badge/Prisma-ORM-white?style=for-the-badge&logo=prisma) ![Vercel](https://img.shields.io/badge/Deployment-Vercel-black?style=for-the-badge&logo=vercel)

**Lazeez** is a full-stack, enterprise-grade restaurant management ecosystem. It bridges the gap between a high-converting, aesthetic customer storefront and a high-efficiency real-time admin operations hub. Designed for extreme performance and scalability, it leverages a serverless-first architecture to ensure zero downtime and instantaneous response times.

---

## Performance Optimizations

This project has been heavily optimized for speed and scalability.

### Backend Optimizations

| Optimization | Details |
|---|---|
| **Feedback Rating Cache** | Item ratings computed once and cached in `AppCache` with 10-min TTL. Eliminates 3 DB queries per page load. |
| **Menu Data Cache** | Menu items, categories, and search trie cached with 5-min auto-refresh. |
| **Settings Cache** | Delivery/payment settings cached for 30 minutes. |
| **Sitemap Cache** | XML sitemap built once, cached for 1 hour. |
| **Database Indexes** | Indexes on `Order.userId`, `Order.status`, `Order.createdAt`, `MenuItem.categoryId`, `MenuItem.available`, `SavedAddress.userId`, `Feedback.userId`, `Feedback.orderId`. |
| **Parallel DB Queries** | Dashboard runs all independent queries via `Promise.all`. |
| **N+1 Query Fix** | Admin orders list only selects `{ name, email, phone }` instead of full user object. |
| **Lazy Firebase Admin** | Firebase Admin SDK initializes on first auth call, not at server startup. |
| **Aggressive Static Caching** | JS/CSS cached for 1 year (immutable), images for 1 year, HTML files uncached. |

### Frontend Optimizations

| Optimization | Details |
|---|---|
| **Local Tailwind CSS** | Pre-built 62KB CSS file served from `/public/css/tailwind.css`. No CDN dependency. |
| **Async Script Loading** | Firebase SDKs load `async`, client scripts load `defer` — no render blocking. |
| **Skeleton Loading Overlay** | Full-page skeleton shown during initial load. |
| **Auth-Aware Services** | SSE and location services skip requests for unauthenticated users. |
| **Google Auth Domain Fix** | `authDomain` set to Firebase default to prevent 404s on Vercel. |

---

## Key Features

### Customer Storefront
- **Dynamic Menu Discovery**: Fast, category-based browsing with real-time search powered by a Trie data structure.
- **Intelligent Location Service**: Automatic GPS detection and reverse geocoding via Nominatim (OpenStreetMap), with intelligent Tripura region detection. Calculates precise delivery fees based on distance using the Haversine formula.
- **Seamless Ordering Flow**: A frictionless path from dish selection to checkout with a persistent, session-based cart.
- **Premium UX**: Modern, responsive UI built with pre-built Tailwind CSS and Alpine.js, featuring skeleton loaders and slide-up mobile modals.
- **Order Tracking**: Real-time visibility into order status for the customer.

### Admin Operations Dashboard
- **Real-time Order Hub**: Instant notifications of new orders using Server-Sent Events (SSE), eliminating the need for page refreshes.
- **Dynamic Menu Management**: Full CRUD capabilities for categories and dishes, with immediate reflection on the storefront.
- **Order Lifecycle Control**: Manage order states from `Pending` → `Accepted` → `Preparing` → `Out for Delivery` → `Delivered`.
- **Analytics & Insights**: High-level overview of store performance and customer feedback.

### Core System Capabilities
- **Serverless Session Management**: Distributed session handling via Vercel KV (Upstash) for infinite scalability.
- **Automated Image Pipeline**: High-performance image processing converting all uploads to `AVIF` for maximum compression.
- **Strict Security**: RBAC (Role-Based Access Control), rate limiting, reCAPTCHA protection, and AES-256 encryption for sensitive customer data.
- **SEO Optimized**: Server-Side Rendering (SSR) with EJS for lightning-fast First Contentful Paint (FCP).

---

## Architecture & Project Flow

### System Architecture
The project follows a **Layered Architecture** to ensure a strict separation of concerns:

`Request` → `Middleware (Auth/RateLimit/reCAPTCHA)` → `Router` → `Controller` → `Service/DB (Prisma)` → `Response`

### Customer Journey Flow

```mermaid
graph TD
    A[Landing Page] --> B{Location Set?}
    B -- No --> C[Detect GPS / Manual Search]
    B -- Yes --> D[Browse Menu]
    C --> D
    D --> E[Search / Filter Dishes]
    E --> F[Item Detail View]
    F --> G[Add to Cart]
    G --> H[Review Cart]
    H --> I[Checkout Page]
    I --> J{Authenticated?}
    J -- No --> K[Login / Sign Up]
    J -- Yes --> L[Set Delivery Address]
    K --> L
    L --> M[reCAPTCHA Verification]
    M --> N[Secure Payment Simulation]
    N --> O[Order Success Page]
```

### Order Lifecycle Flow

```mermaid
graph LR
    P[Order Placed] --> Q[Admin Notified via SSE]
    Q --> R[Order Accepted]
    R --> S[Preparing Food]
    S --> T[Out for Delivery]
    T --> U[Order Delivered]
    U --> V[Customer Feedback]
```

### Location Detection Flow

```mermaid
graph TD
    A[GPS Detection] --> B{Navigator Geolocation API}
    B -->|Success| C[Get Lat/Lng Coordinates]
    B -->|Failed| J[Show Error / Fallback]
    C --> D[Nominatim Reverse Geocoding]
    D --> E{Location Validation}
    E -->|In Tripura Bounds| F[Accept Location]
    E -->|Outside Tripura| G[Show Warning]
    E -->|Ambiguous State| H[Check Keywords/Pincode]
    H -->|Tripura Match| F
    H -->|No Match| G
    F --> I[Calculate Distance & Delivery Fee]
    G --> K[Prompt Manual Selection]
    I --> L[Update UI with Location]
```

---

## Technology Stack

| Category | Technology | Purpose |
|---|---|---|
| **Backend Framework** | Express.js 5.2 | High-performance routing and API design. |
| **Database & ORM** | Supabase (PostgreSQL) + Prisma | Scalable relational storage with strongly typed schema. |
| **Session Store** | Vercel KV (Upstash) | Serverless, HTTP-based distributed session management. |
| **View Engine** | EJS | SSR for instantaneous load times and SEO. |
| **Styling** | Tailwind CSS (pre-built) + Alpine.js | Modern, responsive, and interactive premium UI. |
| **Authentication** | Firebase Admin SDK (lazy-loaded) | Secure identity management and JWT validation. |
| **Bot Protection** | Google reCAPTCHA v3 | Invisible spam/bot protection on forms and checkout. |
| **Search Console** | Google Search Console | SEO monitoring and sitemap integration. |
| **Image Pipeline** | Sharp + Multer | Automated conversion of images to `AVIF` format. |
| **Real-time Comm** | Server-Sent Events (SSE) | Real-time server → admin push notifications. |
| **Email Service** | Resend API | Transactional emails for orders and notifications. |
| **Maps & Geocoding** | OpenStreetMap (Nominatim) + Leaflet.js | Free, open-source map tiles and geocoding. |

---

## External Integrations

### Google reCAPTCHA v3

The project implements **invisible reCAPTCHA v3** for bot protection without disrupting user experience.

**Implementation Details:**
- **Site Key**: Frontend integration in `header.ejs`
- **Secret Key**: Backend verification in authentication routes
- **Score Threshold**: 0.5 (configurable based on sensitivity)
- **Protected Endpoints**: Login, Register, Checkout, Profile updates

**Environment Variables Required:**
```env
RECAPTCHA_SITE_KEY="your-recaptcha-site-key"
RECAPTCHA_SECRET_KEY="your-recaptcha-secret-key"
```

> ⚠️ **Important**: Add your domain(s) to the [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin) to avoid 401 Unauthorized errors.

### Google Search Console Integration

**SEO Features:**
- **Server-Side Rendering (SSR)**: All pages are rendered on the server for proper crawling.
- **Meta Tags**: Comprehensive Open Graph, Twitter Card, and semantic HTML tags.
- **Structured Data**: JSON-LD schema markup for Restaurant/Food establishment.
- **Sitemap**: Cached XML sitemap generation at `/sitemap.xml` (refreshes every 1 hour).
- **Robots.txt**: Configured for proper crawling directives.

---

## DSA & Core Concepts

### 1. Fast Search with Trie (Prefix Tree)
Instead of slow SQL `LIKE` queries, menu items are indexed in a **Trie**.
- **Complexity**: $O(L)$ search time (where $L$ is query length).
- **Benefit**: Instantaneous search results even with thousands of menu items.

### 2. Tiered Delivery Pricing
Delivery fees are calculated using the **Haversine Formula** to determine the great-circle distance between two points on a sphere.
- **Logic**: $\text{Fee} = \text{Base Rate} \times \lceil \text{Distance} / 5\text{km} \rceil$.
- **Tripura Focus**: GPS coordinates are validated against Tripura's bounding box (Lat: 22.9°-24.6°, Lng: 91.1°-92.3°) for delivery eligibility.

### 3. Geolocation with Nominatim
Uses OpenStreetMap's Nominatim API for free, privacy-respecting geocoding.
- **Reverse Geocoding**: GPS coordinates → Human-readable address
- **Forward Geocoding**: Search query → Lat/Lng coordinates

---

## Directory Structure

```
lazeez/
├── prisma/
│   └── schema.prisma         # Database schema with indexes
├── public/
│   ├── css/
│   │   ├── premium.css      # Custom styles
│   │   └── tailwind.css     # Pre-built Tailwind (generated)
│   ├── js/
│   │   ├── firebase-client.js
│   │   ├── google-location-service.js
│   │   └── realtime.js
│   └── img/
├── src/
│   ├── config/
│   │   ├── db.js            # Prisma singleton
│   │   └── firebase-admin.js # Lazy-loaded Firebase Admin
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   │   ├── cache.js         # AppCache (menus, ratings, settings, sitemap)
│   │   └── realtime.js      # SSE connection manager
│   ├── utils/
│   └── views/
├── app.js                    # Main entry point
├── package.json
└── tailwind.config.js
```

---

## Setup & Installation

### 1. Prerequisites
- Node.js (v18.0.0+)
- PostgreSQL database (Supabase recommended)
- Vercel KV (Upstash) account
- Google reCAPTCHA keys (v3)

### 2. Installation
```bash
npm install
```

### 3. Configuration
Create a `.env` file in the root directory:
```env
# Database (use port 5432, NOT 6543/pgbouncer)
DATABASE_URL="postgresql://user:pass@host:5432/postgres"
DIRECT_URL="postgresql://user:pass@host:5432/postgres"

# Session & Security
SESSION_SECRET="your-long-random-secret"

# Vercel KV (Upstash)
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."

# Firebase
FIREBASE_AUTH_DOMAIN="your-project.firebaseapp.com"
FIREBASE_API_KEY="..."
FIREBASE_PROJECT_ID="..."

# Google reCAPTCHA v3
RECAPTCHA_SITE_KEY="6Lxxxxx"
RECAPTCHA_SECRET_KEY="6Lxxxxx"

# Email
RESEND_API_KEY="re_xxxxx"
```

### 4. Database Initialization
```bash
npx prisma db push
npx prisma generate
node prisma/seed.js
node scripts/create-admin.js
```

### 5. Execution
```bash
npm run dev # Builds Tailwind CSS + starts server with hot-reload
npm start   # Builds Tailwind CSS + starts server in production
```

---

## Operational Commands

| Command | Action |
|---|---|
| `npm run dev` | Builds Tailwind CSS and starts server with hot-reload |
| `npm start` | Builds Tailwind CSS and starts server in production |
| `npm run css` | Builds Tailwind CSS only (run before `node index.js`) |
| `npm run css:watch` | Watches and rebuilds Tailwind CSS on changes |
| `npx prisma db push` | Push schema changes to database |
| `npx prisma generate` | Regenerates Prisma client after schema changes |
| `npx prisma studio` | Opens a GUI to browse and edit database data |

---

## Security Implementation

| Security Feature | Implementation | Protection Against |
|---|---|---|
| **reCAPTCHA v3** | Invisible bot scoring on forms | Bots, spam submissions |
| **Rate Limiting** | `express-rate-limit` on auth routes | Brute force, DoS attacks |
| **RBAC** | Admin middleware checks `role === 'admin'` | Unauthorized access |
| **XSS Prevention** | EJS auto-escapes all output | Cross-site scripting |
| **Zod Validation** | Strict schema validation on inputs | SQL/NoSQL injection |
| **Secure Sessions** | HTTP-only, SameSite cookies | Session hijacking |
| **Lazy Auth SDK** | Firebase Admin loads on-demand only | Unnecessary CPU/memory |

---

## Deployment Checklist

Before deploying to production, ensure:

- [ ] All environment variables are set in Vercel dashboard
- [ ] Domain added to Google reCAPTCHA Admin Console
- [ ] Domain verified in Google Search Console
- [ ] Sitemap submitted to Google Search Console
- [ ] `robots.txt` configured for production
- [ ] HTTPS enforced (automatic on Vercel)
- [ ] Database indexes applied (`npx prisma db push`)
- [ ] Session store (Upstash KV) provisioned
- [ ] `FIREBASE_AUTH_DOMAIN` set to `your-project.firebaseapp.com` (not your custom domain)

---

> _Designed for architectural elegance, extreme performance, and effortless scalability._
