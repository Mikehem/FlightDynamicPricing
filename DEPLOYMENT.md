# Agentic Dynamic Pricing Platform - Technical Documentation & Deployment Guide

## Overview

This is an AI-driven dynamic pricing simulator for airline ticketing, demonstrating a multi-agent architecture for the Indigo BLR to DXB route. The system uses multiple AI agents powered by Google Gemini to make and explain pricing decisions in real-time.

## Technical Architecture

### Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| AI/LLM | Google Gemini (gemini-2.5-flash) |
| Styling | Tailwind CSS + shadcn/ui |
| State Management | TanStack React Query |

### Agent System

The platform runs 5 AI agents in sequence:

1. **Objective Agent** - Determines system goal (REVENUE_MAXIMIZATION, OCCUPANCY_MAXIMIZATION, COMPETITIVE_MATCHING)
2. **Forecast Agent** - Analyzes demand patterns and market conditions
3. **Pricing Agent** - Calculates price multipliers aligned with the objective
4. **Seat Allocation Agent** - Recommends bucket reallocation strategies
5. **Competitor Agent** - Monitors competitive positioning

### Project Structure

```
.
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   └── lib/            # Utilities
├── server/                 # Express backend
│   ├── index.ts            # Server entry point
│   ├── routes.ts           # API routes
│   ├── storage.ts          # Database operations & AI agents
│   └── vite.ts             # Vite dev server integration
├── shared/                 # Shared code
│   └── schema.ts           # Database schema & types
└── migrations/             # Database migrations
```

---

## Ubuntu Deployment Guide

### Prerequisites

- Ubuntu 20.04 LTS or newer
- Node.js 20.x
- PostgreSQL 14+
- Git

### Step 1: System Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install required dependencies
sudo apt install -y curl git build-essential
```

### Step 2: Install Node.js 20.x

```bash
# Add NodeSource repository
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### Step 3: Install PostgreSQL

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE USER pricing_app WITH PASSWORD 'your_secure_password';
CREATE DATABASE dynamic_pricing OWNER pricing_app;
GRANT ALL PRIVILEGES ON DATABASE dynamic_pricing TO pricing_app;
EOF
```

### Step 4: Clone the Repository

```bash
# Clone the repository
git clone <your-repository-url> dynamic-pricing-platform
cd dynamic-pricing-platform
```

### Step 5: Configure Environment Variables

Create a `.env` file in the project root:

```bash
nano .env
```

Add the following environment variables:

```env
# Database Configuration
DATABASE_URL=postgresql://pricing_app:your_secure_password@localhost:5432/dynamic_pricing

# Google Gemini API Key (Required for AI agents)
GEMINI_API_KEY=your_gemini_api_key_here

# Session Secret (generate a random string)
SESSION_SECRET=your_random_session_secret_here

# Server Configuration
NODE_ENV=production
PORT=5000
```

**Getting a Gemini API Key:**
1. Go to https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it in your `.env` file

### Step 6: Install Dependencies

```bash
# Install project dependencies
npm install
```

### Step 7: Initialize Database

```bash
# Push database schema
npm run db:push
```

### Step 8: Build for Production

```bash
# Build the application
npm run build
```

### Step 9: Run the Application

**Development Mode:**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The application will be available at `http://localhost:5000`

---

## Production Deployment with PM2

For production deployments, use PM2 to manage the Node.js process:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the application with PM2
pm2 start npm --name "dynamic-pricing" -- start

# Configure PM2 to start on system boot
pm2 startup
pm2 save

# View logs
pm2 logs dynamic-pricing

# Monitor application
pm2 monit
```

---

## Nginx Reverse Proxy Setup (Optional)

For production, set up Nginx as a reverse proxy:

```bash
# Install Nginx
sudo apt install -y nginx

# Create site configuration
sudo nano /etc/nginx/sites-available/dynamic-pricing
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/dynamic-pricing /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## SSL Certificate with Let's Encrypt (Optional)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scenarios` | GET | List available scenarios |
| `/api/simulation/start` | POST | Start a new simulation session |
| `/api/simulation/state` | GET | Get current simulation state |
| `/api/simulation/orchestrate` | POST | Run all AI agents |
| `/api/simulation/book` | POST | Book a ticket |
| `/api/simulation/chat` | POST | Booking assistant chat |

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI agents |
| `SESSION_SECRET` | Yes | Secret for session encryption |
| `NODE_ENV` | No | Environment (development/production) |
| `PORT` | No | Server port (default: 5000) |

---

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connectivity
psql -h localhost -U pricing_app -d dynamic_pricing
```

### AI Agent Errors
- Verify your `GEMINI_API_KEY` is valid
- Check API quota at https://aistudio.google.com/
- Review server logs: `pm2 logs dynamic-pricing`

### Port Already in Use
```bash
# Find process using port 5000
sudo lsof -i :5000

# Kill the process if needed
kill -9 <PID>
```

---

## Updating the Application

```bash
cd dynamic-pricing-platform

# Pull latest changes
git pull origin main

# Install any new dependencies
npm install

# Rebuild the application
npm run build

# Push database changes (if any)
npm run db:push

# Restart the application
pm2 restart dynamic-pricing
```
