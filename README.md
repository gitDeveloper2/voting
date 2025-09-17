# 🗳️ Voting API System

A comprehensive Next.js-based voting platform with real-time vote management, automated launch cycles, and a powerful admin dashboard.

## 🏗️ System Architecture

- **Frontend:** Next.js with TypeScript and Tailwind CSS
- **Backend:** Next.js API Routes with MongoDB and Redis
- **Authentication:** NextAuth.js with credential-based login
- **Caching:** Redis for real-time votes, MongoDB for persistence
- **Automation:** Single daily cron job for launch management
- **Admin Panel:** Comprehensive management interface

## ⚡ Key Features

- **Real-time Voting:** Fast Redis-based vote storage
- **Automated Launch Management:** Daily cycle with atomic operations
- **Admin Dashboard:** Complete system monitoring and control
- **Vote Flushing:** Automatic transfer from Redis to MongoDB
- **Cache Revalidation:** Automatic cache updates after operations
- **Manual Controls:** Admin override capabilities

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## 🔄 Automated Launch Cycle

The system uses a single daily cron job for reliable launch management:

**Schedule:** Daily at 6 AM UTC (`0 6 * * *`)  
**Endpoint:** `/api/cron/daily-launch-cycle`

**Operations:**
1. Flush previous day's votes from Redis to MongoDB
2. Create new launch with scheduled apps
3. Initialize Redis keys for new voting
4. Trigger cache revalidation
5. Comprehensive status reporting

## 🎛️ Admin Panel

Access the admin dashboard at `/admin` with the following features:

- **Dashboard:** System overview and statistics
- **Voting:** Real-time vote monitoring and manual flush controls
- **Launches:** Launch history and management
- **Apps:** Application management with pagination
- **Config:** System health and environment status

## 🔧 Environment Variables

```env
MAIN_MONGODB_URI=your-mongodb-connection-string
MONGODB_DATABASE=basicutils
REDIS_URL=your-redis-connection-string
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3000
ADMIN_PASSWORD=your-admin-password
CRON_SECRET=your-cron-secret
CORS_ORIGINS=your-allowed-origins
```

## 📊 API Endpoints

### Public APIs
- `POST /api/vote` - Submit a vote
- `GET /api/votes/{appId}` - Get vote count

### Admin APIs
- `GET /api/admin/launches` - List launches
- `POST /api/admin/launches/{date}/flush` - Manual flush
- `GET /api/admin/users` - List users

### Cron APIs
- `GET /api/cron/daily-launch-cycle` - Daily launch management

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) for more information about the framework.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# voting-api
