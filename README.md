# TimeharborApp

TimeharborApp is a comprehensive time tracking and team management solution. It features a modern web frontend, mobile applications (Android & iOS), and a robust backend API.

**Youtube Short** : https://youtube.com/shorts/MfPd4NsjLQQ?feature=share

**Proxmox link** : https://timeharborapp.opensource.mieweb.org

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
*   **Push Notifications**: Native push notifications via Firebase Cloud Messaging (Android) and Apple Push Notification service (iOS).
*   **Team Management**: Create and manage teams, invite members, and track team activity.
*   **Ticket System**: Create, assign, and track tickets/tasks with time logging support.
*   **Smart Time Tracking**: Clock in/out with automatic event logging and team/ticket association.
*   **Real-time Sync**: Automatic synchronization of time events, tickets, and team data when online.

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
    
    # Push Notifications (Optional)
    # Firebase Cloud Messaging (Android)
    FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
    
    # Apple Push Notification Service (iOS)
    APN_KEY_PATH=./AuthKey_XXXXXXXXXX.p8
    APN_KEY_ID=your-apn-key-id
    APN_TEAM_ID=your-apple-team-id
    APN_BUNDLE_ID=com.yourcompany.timeharbor
    APN_PRODUCTION=false
    ```
    
    **Push Notification Setup:**
    - For **Android (FCM)**: Download your `firebase-service-account.json` from Firebase Console and place it in the `express-api` directory.
    - For **iOS (APNs)**: Download your APNs authentication key (`.p8` file) from Apple Developer Portal and place it in the `express-api` directory.

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

## Mobile Features (Capacitor)

The mobile app leverages Capacitor plugins for native functionality:

### Native Integrations
*   **Push Notifications**: `@capacitor/push-notifications` for FCM (Android) and APNs (iOS)
*   **Network Detection**: `@capacitor/network` for online/offline status monitoring
*   **Clipboard**: `@capacitor/clipboard` for copy/paste functionality
*   **App Lifecycle**: `@capacitor/app` for background/foreground event handling

### Mobile-Specific Features
*   **Automatic Re-authentication**: Hooks into auth state changes to re-register push tokens
*   **Background Sync**: Queues offline actions and syncs when connection is restored
*   **Native UI**: Platform-specific components and behaviors
*   **Local Storage**: Dexie.js for client-side data persistence

### User Interface Features
*   **Dashboard**: Overview of time tracking, teams, and recent activity
*   **Activity View**: Detailed time tracking history with filtering options
*   **Teams Management**: Create teams, manage members, and view team statistics
*   **Tickets/Tasks**: Create and track work items with time logging
*   **Settings**: User profile management and app preferences
*   **Responsive Design**: Optimized for mobile, tablet, and desktop screens
*   **Dark Mode Ready**: Tailwind CSS with modern UI components

### Build Scripts
```bash
# Development builds (opens IDE)
npm run dev:android    # Android Studio
npm run dev:ios        # Xcode

# Production builds (with Next.js optimization)
npm run prod:android   # Build + sync + open Android Studio
npm run prod:ios       # Build + sync + open Xcode
```

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

## API Features & Endpoints

The Express API provides comprehensive functionality for time tracking and team management:

### Authentication (`/auth`)
*   **Signup/Login**: JWT-based authentication with access and refresh tokens
*   **Token Refresh**: Automatic token renewal using refresh tokens
*   **Secure Password Hashing**: BCrypt implementation for password security
*   **Session Management**: Automatic cleanup of expired tokens via scheduled jobs

### Dashboard (`/dashboard`)
*   **User Statistics**: Total hours worked, current status, recent activity
*   **Time Summaries**: Daily, weekly, and monthly time tracking summaries
*   **Team Overview**: Team member status and activity

### Team Management (`/teams`)
*   **Create Teams**: Create and manage multiple teams
*   **Member Management**: Add/remove team members, assign roles
*   **Team Activity**: Track team-wide time logs and productivity

### Ticket System (`/tickets`)
*   **Create Tickets**: Create tasks/tickets with descriptions and assignments
*   **Ticket Assignment**: Assign tickets to team members
*   **Time Tracking**: Associate time logs with specific tickets
*   **Status Management**: Track ticket progress and completion

### Time Tracking (`/time`)
*   **Clock In/Out**: Start and end time tracking sessions
*   **Time Events**: Log work sessions with start/end times
*   **Team/Ticket Association**: Link time events to teams and tickets
*   **Event History**: Query and analyze time tracking history

### Security & Middleware
*   **Rate Limiting**: Protection against brute force attacks
*   **Helmet**: Security headers for HTTP protection
*   **CORS**: Configured for frontend/mobile app access
*   **Request Validation**: Express-validator for input sanitization
*   **Error Handling**: Centralized error handling middleware

### Push Notifications
*   **FCM Integration**: Firebase Cloud Messaging for Android devices
*   **APNs Integration**: Apple Push Notification service for iOS devices
*   **Token Management**: Automatic storage and refresh of device tokens
*   **Multi-Device Support**: Send notifications to all user devices

### Logging & Monitoring
*   **Winston Logger**: Structured logging with multiple transports
*   **Request Logging**: Morgan middleware for HTTP request logging
*   **Log Rotation**: Automatic log file management
*   **Error Tracking**: Detailed error logs for debugging

## Database Migrations

The project uses Sequelize for database management with the following schema:

*   **users**: User accounts with authentication credentials
*   **refresh_tokens**: JWT refresh token storage
*   **teams**: Team definitions and settings
*   **members**: Team membership associations
*   **tickets**: Task/ticket tracking
*   **time_events**: Time tracking events (merged from attendance/work_logs)
*   **fcm_tokens**: Device tokens for push notifications

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

## Useful Scripts & Commands


### Testing API Endpoints

Test authentication and token refresh:
```bash
# Create a test user and test token refresh
TEST_EMAIL="test-$(date +%s)@test.com"
RESPONSE=$(curl -s -X POST http://localhost:3001/auth/signup \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Test123456\",\"full_name\":\"Test User\"}")
  
REFRESH_TOKEN=$(echo $RESPONSE | jq -r '.session.refresh_token')

# Test token refresh
curl -s -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}" | jq
```

### Database Management

Run migrations:
```bash
cd express-api
npx sequelize-cli db:migrate
```

Rollback last migration:
```bash
npx sequelize-cli db:migrate:undo
```

Clear all data (development only):
```bash
npx ts-node scripts/clearData.ts
```

### Monitoring Logs

View combined logs:
```bash
tail -f express-api/logs/combined.log
```

View error logs only:
```bash
tail -f express-api/logs/error.log
```


## Troubleshooting

### Push Notifications Not Working

1. **Android (FCM)**:
   - Verify `firebase-service-account.json` is in the `express-api` directory
   - Check `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env`
   - Ensure the app is registered in Firebase Console
   - Verify the package name matches in Firebase and Capacitor config

2. **iOS (APNs)**:
   - Verify `.p8` key file is in the `express-api` directory
   - Check all APN environment variables in `.env`
   - Ensure the bundle ID matches in Apple Developer Portal and Capacitor config
   - Test with development mode first (`APN_PRODUCTION=false`)

### Sync Issues

1. Check network detector status in console logs
2. Verify API_URL environment variable
3. Check browser/app console for sync errors
4. Manually trigger sync from the app

### Database Connection Issues

1. Verify PostgreSQL is running
2. Check `DATABASE_URL` in `.env`
3. Ensure database exists: `createdb timeharbor`
4. Run migrations: `npx sequelize-cli db:migrate`

## Technology Stack

### Backend
*   **Node.js** with **Express** and **TypeScript**
*   **PostgreSQL** with **Sequelize ORM**
*   **JWT** for authentication
*   **BCrypt** for password hashing
*   **Winston** for logging
*   **Firebase Admin SDK** for FCM
*   **node-apn** for APNs
*   **node-cron** for scheduled jobs

### Frontend/Mobile
*   **Next.js 16** with **React 19**
*   **Tailwind CSS 4** for styling
*   **Capacitor 8** for mobile builds
*   **Dexie.js** for local database
*   **Playwright** for E2E testing
*   **Lucide React** for icons

### DevOps
*   **PM2** for process management
*   **Sequelize CLI** for migrations
*   **Nodemon** for development
*   **Serve** for static file serving

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

[Add your license information here]
