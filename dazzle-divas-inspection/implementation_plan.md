# Dazzle Divas Inspection App: Next-Gen Migration Plan

This document outlines the architecture, technology stack, and implementation phases for rewriting the Dazzle Divas Inspection App into a modern, production-ready, highly scalable cross-platform application.

## 1. Goal Description

The current Next.js + SQLite architecture is a great starting point but will face bottlenecks scaling up due to local file storage and monolithic API design. The goal of this rewrite is to build a high-performance system capable of massive growth.

We will use a hybrid web and mobile stack to provide an instant, real-time admin portal for the office and a flawless, offline-capable mobile application for cleaners in the field.

## 2. Target Technology Stack

### Backend & Cloud Infrastructure ☁️

- **Convex**: Replaces the entire database (Prisma, SQLite) and API layer. Provides a real-time, managed serverless backend. WebSockets are built-in, meaning the admin dashboard updates instantly as cleaners check off tasks.
- **Rust Microservices**: Deployed for CPU-heavy tasks via Wasm or a standalone service.
  - *Image Processing*: Compressing high-resolution photos taken in the field before they upload.
  - *Report Generation*: Rapidly generating PDF inspection reports.
- **Bun**: Used as the primary package manager and runtime for the backend logic.

### Web Admin Portal 💻

*The portal used by office staff to assign properties, manage users, and review real-time inspections.*

- **React (Vite) + TypeScript**
- **Zustand**: For lightweight, rapid client-side state management.
- **Tailwind CSS + Shadcn UI**: For a beautiful, fast, and accessible admin interface.

### Mobile Application 📱

*The application used by cleaners in the field.*

- **Flutter**: Compiles to native iOS and Android code for ultimate 60FPS performance.
- **Convex Dart Client**: Connects Flutter directly to the Convex real-time backend.
- **Local Database (Isar or SQLite)**: Used for complete offline capability. This ensures inspectors can work in basements or remote areas with poor cell service, syncing automatically when connectivity is restored.

---

## 3. Proposed Architecture Changes

### [Web Admin Portal]

- **Migrate away from Next.js server side rendering**: Use Vite + React to build a blazing fast Single Page Application (SPA). This reduces server costs and simplifies the deployment to a static host (like Cloudflare Pages or Vercel static).
- **Zustand Store**: Implement a global store to seamlessly track the live status of all active inspection assignments without drilling props.

### [Backend/Database (Convex)]

- **Schema Rewrite**: Translate the existing Prisma schema (`User`, `Property`, `Inspection`, `Room`, `Task`, `Photo`) into a Convex `schema.ts`.
- **Real-time Queries**: Replace standard REST API calls with Convex hooks (`useQuery`) for instant UI updates.
- **Cloud Storage**: Implement Convex File Storage to replace local `./uploads` directory handling, allowing photos to scale alongside the database natively.

### [Mobile App (Flutter)]

- **Camera Integration**: Utilize native camera plugins to bypass the clunky mobile web camera experience.
- **Offline Sync Engine**: Build a sync layer that queues task completions and photo uploads when offline, flushing them to Convex upon reconnection.
- **Push Notifications**: Integrate Firebase Cloud Messaging (FCM) to alert cleaners of new assignments or schedule changes instantly.

---

## 4. Implementation Phases

### Phase 1: Backend Foundation (Weeks 1-2)

1. **Initialize Convex**: Set up the Convex project and write the new `schema.ts`.
2. **Data Migration**: Write a one-off script (using Bun) to migrate existing data from the SQLite instance to Convex.
3. **Core Functions**: Implement Convex mutations and queries for User authentication, Property assignment, and Inspection creation.

### Phase 2: Web Admin Dashboard (Weeks 3-4)

1. **Setup Vite + Tailwind + Zustand**: Scaffold the new web presence.
2. **Connect to Convex**: Hook up the admin dashboard to read live inspection data.
3. **Rust Microservice**: Build the Rust-powered PDF generation service and integrate it into a dashboard click-to-download feature.

### Phase 3: Flutter Mobile App (Weeks 5-8)

1. **Project Setup**: Scaffold the Flutter app for iOS and Android.
2. **Authentication & Routing**: Build secure login screens and role-based routing.
3. **The Inspection Flow (Offline-First)**: Build the core room-by-room checklist UI. Implement local storage queuing for offline operation.
4. **Camera & Uploads**: Integrate native camera capabilities and file uploading to Convex Storage.

### Phase 4: Testing & Deployment (Week 9)

1. **Beta Testing**: Release the Flutter app via TestFlight (iOS) and Google Play Console Internal Testing (Android).
2. **Performance Audits**: Ensure image compression and Rust microservices are operating efficiently.
3. **Production Launch**: Cut over domain routing and deprecate the Next.js system.

## 5. Verification Plan

### Automated Tests

- Convex unit tests for complex mutation logic (e.g., ensuring an inspection cannot be marked complete without all required photos).
- Flutter widget tests for the core inspection checklist flow.

### Manual Verification

- **Offline Check**: Log into the Flutter app, turn on Airplane Mode, complete an entire inspection (with photos), turn off Airplane Mode, and verify the admin dashboard updates correctly.
- **Load Testing**: Simulate 50 concurrent inspectors uploading photos to verify the Rust image processing pipeline stability.
