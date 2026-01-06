# TimeharborApp

TimeharborApp is a comprehensive time tracking and team management solution. It features a modern web frontend, mobile applications (Android & iOS), and a robust backend API.

**Youtube Short** : https://youtube.com/shorts/MfPd4NsjLQQ?feature=share

## Project Structure

The repository is organized into three main components:

*   **`express-api/`**: The backend REST API built with Node.js, Express, TypeScript, and PostgreSQL.
*   **`timeharbourapp/`**: The frontend application built with Next.js, React, and Tailwind CSS. It also serves as the mobile app source using Capacitor.
*   **`timeharbor-proxy/`**: A lightweight proxy server for routing requests in production environments.

## Architecture & App Flow

TimeharborApp is designed with an **Offline-First** architecture, ensuring users can track time and manage tasks regardless of internet connectivity.

### System Architecture

```mermaid
graph TD
    subgraph Client [Client Device - Mobile/Web]
        UI[User Interface]
        LocalDB[(Local DB - Dexie.js)]
        Sync[Sync Manager]
        Net[Network Detector]
        
        UI -->|1. User Action| LocalDB
        LocalDB -->|2. Update UI| UI
        Net -->|3. Detect Online| Sync
        Sync -->|4. Read Pending| LocalDB
    end
    
    subgraph Server [Backend Infrastructure]
        API[Express API]
        DB[(PostgreSQL)]
        
        API <-->|6. Persist| DB
    end
    
    Sync <-->|5. Sync Data| API
```

### Key Features

*   **Mobile-First Design**: Optimized for mobile devices using Capacitor for native Android and iOS builds.
*   **Offline-First**: Uses `Dexie.js` (IndexedDB) to store data locally. All actions (Clock In, Create Ticket) are saved locally first (optimistic UI).
*   **UUID Implementation**: Uses UUIDs for all primary keys to allow offline ID generation and conflict-free synchronization.

### Synchronization Process

1.  **Offline Action**: When a user performs an action (e.g., "Clock In"), the app generates a UUID and saves the event to the local database (`TimeEvent` table).
2.  **Queueing**: If the device is offline, the action is queued.
3.  **Network Detection**: The `NetworkDetector` monitors connection status.
4.  **Auto-Sync**: When connectivity is restored, the `SyncManager` is triggered.
    *   It replays any failed API mutations (POST/PUT/DELETE).
    *   It pushes unsynced time events to the backend.
5.  **Consistency**: Once acknowledged by the server, local records are marked as synced.

## Prerequisites

*   Node.js (v18+ recommended)
*   PostgreSQL
*   Android Studio (for Android development)
*   Xcode (for iOS development, macOS only)
*   PM2 (optional, for production process management)

## Getting Started

### 1. Backend Setup (`express-api`)

1.  Navigate to the backend directory:
    ```bash
    cd express-api
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables:
    Create a `.env` file in the `express-api` directory. You can use the following template:
    ```env
    PORT=3001
    NODE_ENV=development
    DATABASE_URL=postgresql://username:password@localhost:5432/timeharbor
    JWT_SECRET=your-super-secret-jwt-key
    JWT_EXPIRES_IN=15m
    FRONTEND_URL=http://localhost:3000
    LOG_LEVEL=info
    ```

4.  Run database migrations:
    ```bash
    npx sequelize-cli db:migrate
    ```

5.  Start the development server:
    ```bash
    npm run dev
    ```
    The API will be available at `http://localhost:3001`.

### 2. Frontend Setup (`timeharbourapp`)

1.  Navigate to the frontend directory:
    ```bash
    cd timeharbourapp
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment variables:
    Create a `.env.local` file in the `timeharbourapp` directory:
    ```env
    NEXT_PUBLIC_API_URL=http://localhost:3001
    ```

4.  Start the development server:
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:3000`.

## Mobile Development (Capacitor)

The `timeharbourapp` directory contains the Capacitor configuration for building mobile apps.

### Android

1.  Sync the project and open Android Studio:
    ```bash
    cd timeharbourapp
    npm run dev:android
    ```

### iOS (macOS only)

1.  Sync the project and open Xcode:
    ```bash
    cd timeharbourapp
    npm run dev:ios
    ```

## Production Deployment

The project includes an `ecosystem.config.js` file for managing processes with PM2.

1.  Build the projects:
    ```bash
    # Build Backend
    cd express-api
    npm run build

    # Build Frontend
    cd ../timeharbourapp
    npm run build
    ```

2.  Start with PM2:
    ```bash
    cd ..
    pm2 start ecosystem.config.js
    ```

    This will start:
    -   Frontend (served via `serve`) on port 3000
    -   Backend on port 3001
    -   Proxy on port 80

## Testing

End-to-end tests are located in the `timeharbourapp` directory and use Playwright.

To run tests:
```bash
cd timeharbourapp
npm run test
```

To run tests with UI:
```bash
npm run test:headed
```
