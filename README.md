# 🍴 Lazeez - Premium Restaurant Management System

![Project Badge](https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge) ![Version](https://img.shields.io/badge/Version-1.0.0-blue?style=for-the-badge) ![Node.js](https://img.shields.io/badge/Node.js-Express_5-success?style=for-the-badge&logo=nodedotjs) ![Prisma](https://img.shields.io/badge/Prisma-ORM-white?style=for-the-badge&logo=prisma)

**Lazeez** is a full-stack, state-of-the-art restaurant management ecosystem designed to deliver a highly premium, aesthetic, and blazing-fast user experience. It features a dynamic, SEO-optimized storefront for customers and an advanced real-time Admin Operations Dashboard.

---

## 🛠️ Technology Stack

The project is built using a modern, scalable stack focusing on performance and developer productivity.

| Category | Technology | Purpose |
| --- | --- | --- |
| **Backend Framework** | Express.js 5.2 | High-performance routing, asynchronous middleware, and API design. |
| **Database & ORM** | Supabase (PostgreSQL) + Prisma | Scalable relational storage with a strongly typed ORM for safe schema migrations. |
| **Caching & Sessions** | Redis / Valkey | Distributed session management and application-level caching to reduce DB load. |
| **View Engine** | EJS + Express Layouts | Server-side rendering (SSR) for instantaneous First Contentful Paint (FCP) and SEO. |
| **Styling** | Tailwind CSS | Utility-first CSS for a pixel-perfect, responsive, and premium UI. |
| **Authentication** | Firebase Admin SDK | Secure identity management, JWT token validation, and passwordless auth. |
| **Image Pipeline** | Sharp + Multer | Automated image processing pipeline converting uploads to `AVIF` for maximum compression. |
| **Real-time Comm** | Server-Sent Events (SSE) | Unidirectional real-time streaming from server to admin dashboard. |
| **Email Service** | Resend API | Transactional email delivery for orders and system notifications. |

---

## 🧠 DSA, Algorithms & Core Concepts

The system implements several computer science fundamentals to ensure efficiency and security.

### 1. Advanced Search with Trie Data Structure
To enable lightning-fast menu searches, the application implements a **Trie (Prefix Tree)**. 
- **Concept**: Instead of performing expensive `LIKE %query%` SQL queries, the system indexes menu items in a Trie.
- **Complexity**: Reduces search time complexity to $O(L)$, where $L$ is the length of the search query, regardless of the total number of menu items.
- **Implementation**: Found in `src/utils/trie.js` and integrated into the caching service.

### 2. Cryptography & Data Security
Sensitive customer information (like phone numbers) is not stored in plain text.
- **Algorithm**: **AES-256-CBC** (Advanced Encryption Standard).
- **Concept**: Symmetric encryption using a secure 32-byte key and a unique Initialization Vector (IV) for every encryption operation to prevent pattern analysis.
- **Implementation**: Handled by `src/utils/encryption.js`.

### 3. Geolocation & Distance Logic
The system calculates delivery fees based on the physical distance between the restaurant and the customer.
- **Logic**: Integration with **OpenStreetMap (Nominatim)** and **Leaflet.js** for coordinate mapping.
- **Pricing Algorithm**: Implements a tiered pricing model where the delivery fee scales based on distance intervals.

### 4. Memory Caching Strategies
To avoid database bottlenecks on high-traffic pages (like the Home page), the system uses:
- **TTL (Time-To-Live) Caching**: Store ratings and active offers in memory, refreshing every few minutes.
- **Distributed Sessions**: Moving session state from local memory to Redis/Valkey to support horizontal scaling.

---

## 🏗️ System Design Concepts

The architecture is designed for scalability, maintainability, and low latency.

### 1. Layered Architecture (SoC)
The project follows a strict **Separation of Concerns (SoC)**:
- **Presentation Layer**: EJS templates and client-side JS for the UI.
- **Routing Layer**: Express routers that define endpoints and apply middleware.
- **Controller Layer**: Business logic handlers that process requests and orchestrate services.
- **Persistence Layer**: Prisma ORM providing a clean interface to the PostgreSQL database.

### 2. Real-time Updates via SSE
Instead of traditional WebSockets (which are bidirectional and heavier) or Polling (which is inefficient), the Admin Dashboard uses **Server-Sent Events (SSE)**.
- **Why SSE?**: Perfect for "Dashboard" use cases where the server needs to push updates (new orders, status changes) to the client without the client needing to send data back.
- **Efficiency**: Maintains a single long-lived HTTP connection, reducing overhead.

### 3. Performance Optimizations
- **Lazy Loading**: Controllers are required only when the route is hit, reducing the initial memory footprint of the application.
- **AVIF Image Compression**: The system automatically converts all uploaded images to AVIF format using the `Sharp` library, significantly reducing page load times without losing quality.
- **Database Connection Pooling**: Utilizes Supabase's connection pooler (PgBouncer) to handle thousands of concurrent database connections efficiently.

### 4. Security Hardening
- **Rate Limiting**: Implementation of `express-rate-limit` to prevent Brute Force and DoS attacks on auth endpoints.
- **Middleware Guards**: Custom `adminAuth` and `auth` middleware to ensure strict RBAC (Role-Based Access Control).
- **Input Validation**: Use of **Zod** for strict schema validation of incoming API requests.

---

## 🚀 Setup & Installation

### 1. Prerequisites
- Node.js (v18.0.0+)
- Redis / Valkey server
- PostgreSQL database (Supabase recommended)

### 2. Installation
```bash
npm install
```

### 3. Configuration
Copy `.env.example` to `.env` and fill in your credentials for:
- `DATABASE_URL` & `DIRECT_URL`
- `SESSION_SECRET` & `ENCRYPTION_KEY`
- Firebase Admin SDK JSON
- Resend API Key

### 4. Database Initialization
```bash
npx prisma migrate dev
node prisma/seed.js
node scripts/create-admin.js
```

### 5. Execution
```bash
npm run dev # Development
npm start   # Production
```

---

## 💻 Operational Commands

| Command | Action |
| --- | --- |
| `npm run dev` | Starts server with nodemon |
| `npx prisma generate` | Updates Prisma Client typings |
| `npx prisma studio` | Opens database GUI |
| `node scripts/update-menu.js` | Bulk updates menu items |

> _Designed with a focus on architectural elegance and extreme performance._
