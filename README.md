# PROJECT CLUTCH ⚡

![License](https://img.shields.io/badge/license-MIT-00FF94?style=for-the-badge)
![Stack](https://img.shields.io/badge/stack-Monorepo-050505?style=for-the-badge&logo=github)
![Status](https://img.shields.io/badge/status-MVP_Development-FF0055?style=for-the-badge)

> **Reveal Your True Self.**
> 
> Project CLUTCH is not just a social network; it is a high-performance identity ecosystem designed for the modern Gamer, Geek, and Otaku culture. We blend the "Old Money" aesthetic with Cyberpunk energy to create the ultimate digital resume for your virtual life.

---

## 🏛️ Engineering Philosophy

We prioritize **efficiency**, **scalability**, and **user experience** above all else.
CLUTCH is engineered to handle high-concurrency real-time interactions while maintaining a minimal footprint on client devices.

* **Identity First:** Aggregating data from Steam, PSN, and Riot to build a "Living Gamer Card".
* **Performance Obsessed:** Fastify backend and Vite frontend for sub-millisecond interactions.
* **Clean Architecture:** Strict separation of concerns ensuring long-term maintainability.

---

## 🛠️ Tech Stack (The Engine)

We utilize a modern, type-safe, and containerized stack:

### 🎨 Frontend (Client)
* **Framework:** Vue.js 3 (Composition API)
* **Build Tool:** Vite (Lightning fast HMR)
* **Styling:** Tailwind CSS v4 (Zero-runtime CSS)
* **State Management:** Pinia
* **Design System:** Custom "Dark Luxury" Theming Engine

### 🧠 Backend (API & Core)
* **Runtime:** Node.js (v20+)
* **Framework:** Fastify (Low overhead)
* **Language:** TypeScript (Strict Mode)
* **Architecture:** Modular Monolith / MVC with Service Layer
* **Validation:** Zod

### 🏗️ Infrastructure & Data
* **Database:** PostgreSQL 15 (Reliable Relational Data)
* **Caching/Queues:** Redis 7 (Real-time feeds & Async Jobs)
* **Containerization:** Docker & Docker Compose

---

## 📂 Project Structure

This project follows a strict Monorepo structure:

```text
clutch/
├── backend/           # Fastify API & Core Logic
│   ├── src/
│   │   ├── api/       # Controllers, Routes, Middlewares
│   │   ├── core/      # Business Logic (Services, Domain)
│   │   └── infra/     # Database & External Integrations
├── frontend/          # Vue 3 Application
│   ├── src/
│   │   ├── components/# Atomic Design Components
│   │   └── views/     # Page Layouts
├── docker-compose.yml # Infrastructure Orchestration
└── README.md          # You are here
```
🚀 Getting Started
Prerequisites: Docker and Node.js 20+.

1. Clone & Install
```Bash

git clone [https://github.com/your-username/clutch.git](https://github.com/your-username/clutch.git)
cd clutch
```
2. Start Infrastructure (DB + Cache)
```Bash

docker-compose up -d
```
3. Run Development Mode
Open two terminals:

Terminal A (Backend):

```Bash

cd backend
npm install
npm run dev
```
Terminal B (Frontend):

```Bash

cd frontend
npm install
npm run dev
```
🤝 Contributing
Project CLUTCH is currently in Stealth Mode / Closed Alpha. Internal roadmap focuses on:

Steam Integration (In Progress)

Feed Algorithm (Planned)

Theming Engine (Planned)

<p align="center"> Made with 💀 & ☕ by the <b>Clutch Engineering Team</b>. </p>
