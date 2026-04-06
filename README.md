# 🥗 Lazeez - Modern Restaurant Management System

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.x-blue.svg)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-teal.svg)](https://www.prisma.io/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-lightgrey.svg)](https://www.sqlite.org/)
[![License](https://img.shields.io/badge/License-ISC-orange.svg)](LICENSE)

**Lazeez** (meaning *delicious* in Arabic/Urdu) is a high-performance, full-stack restaurant management solution. It features a stunning customer storefront for seamless ordering and a robust admin dashboard for real-time inventory and order management.

---

## 🚀 Key Features

### 🛒 Customer Storefront
- **Dynamic Menu**: Categorized menu with Veg/Non-Veg filters and "Bestseller" highlights.
- **Smart Cart & Checkout**: Intuitive cart management with delivery instructions and dine-in options.
- **User Profiles**: Secure authentication, order history, and multiple saved addresses.
- **Onboarding Wizard**: Guided first-time experience to ensure profile completeness.
- **Real-time Tracking**: Live order status updates (Pending → Preparing → Ready → Delivered).
- **Feedback System**: Rate your meal and the store with a weighted rating algorithm.

### 📊 Admin Dashboard
- **Inventory Control**: Add, edit, or toggle availability for menu items and categories.
- **Live Order Management**: Real-time order notifications via Server-Sent Events (SSE).
- **Offer Management**: Create and track promotional banners with smart popup logic.
- **Analytics**: Beautiful dashboard reports powered by Chart.js.
- **System Settings**: Configure restaurant coordinates, fees, and more.

### 🛡️ Security & Performance
- **Firebase Auth**: Enterprise-grade authentication with Google OAuth support.
- **Image Optimization**: Automatic **AVIF** compression using Sharp for lightning-fast loads.
- **Rate Limiting**: Protection against brute-force attacks on auth and API endpoints.
- **Persistent Sessions**: Redis-backed session management (Valkey) for high availability.
- **Security Headers**: Hardened with Helmet.js to prevent common web vulnerabilities.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express 5 (latest)
- **Frontend**: EJS (Server-Side Rendering), Tailwind CSS, Vanilla JS
- **Database**: Prisma ORM with SQLite (Dev) / PostgreSQL (Prod)
- **Auth**: Firebase Admin SDK
- **Real-time**: Server-Sent Events (SSE)
- **Media**: Multer + Sharp (AVIF) + Cloudinary (Optional)
- **Mailing**: Resend SDK
- **Caching**: Redis (Valkey) for sessions and rate limiting

---

## 📂 Project Structure

```text
lazeez/
├── prisma/                 # Database schema and seed scripts
├── public/                 # Static assets (CSS, client JS, images)
├── scripts/                # Utility scripts (Admin creation, etc.)
└── src/
    ├── config/             # DB and Firebase configurations
    ├── controllers/        # Logical handlers (Admin & Storefront)
    ├── middleware/         # Auth, Session, Rate-limiting
    ├── routes/             # Express route definitions
    ├── services/           # Business logic (Real-time, etc.)
    └── views/              # EJS templates and layouts
```

---

## ⚙️ Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Redis server (optional, falls back to memory store)

### 1. Project Setup
```bash
git clone <your-new-repo-url> lazeez
cd lazeez
npm install
```

### 2. Environment Setup
Create a `.env` file from the example:
```bash
cp .env.example .env
```
Update the following keys:
- `SESSION_SECRET`: A secure random string.
- `DATABASE_URL`: Your Prisma connection string.
- `FIREBASE_*`: Your Firebase project credentials.
- `RESEND_API_KEY`: For email notifications.

### 3. Database Initialization
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 4. Run the App
**Development Mode (Auto-reload):**
```bash
npm run dev
```
**Production Mode:**
```bash
npm start
```

---

## 📜 Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts server with `nodemon` for development. |
| `npm start` | Starts server in production mode. |
| `npx prisma studio` | Opens a GUI to view/edit database records. |
| `node scripts/create-admin.js` | Utility to promote a user to Admin. |

---

## 📄 License
This project is licensed under the **ISC License**.

---
*Developed with ❤️ for the School of Developers.*
