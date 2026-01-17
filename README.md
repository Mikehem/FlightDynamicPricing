# Agentic Dynamic Pricing Platform

An AI-driven dynamic pricing simulator for airline ticketing, demonstrating a multi-agent architecture for intelligent price optimization. The system simulates the Indigo Airlines BLR to DXB route using Google Gemini-powered agents that collaboratively analyze market conditions and set optimal prices in real-time.

## Features

- **Multi-Agent AI System**: 5 specialized AI agents working in coordination
- **Real-Time Price Optimization**: Dynamic pricing based on demand, competition, and market factors
- **Transparent Decision Making**: Full visibility into agent reasoning and pricing logic
- **Interactive Booking Interface**: Complete booking flow with AI-powered assistant
- **Multiple Scenarios**: 11 pre-configured market scenarios for testing different conditions
- **Visual Analytics**: Charts for demand forecasting, pricing history, and seat allocation

## AI Agent Architecture

The platform orchestrates 5 AI agents that run sequentially:

| Agent | Role | Output |
|-------|------|--------|
| **Objective Agent** | Determines system goal based on market conditions | REVENUE_MAXIMIZATION, OCCUPANCY_MAXIMIZATION, or COMPETITIVE_MATCHING |
| **Forecast Agent** | Analyzes demand patterns and predicts booking velocity | Demand score (0-1) with reasoning |
| **Pricing Agent** | Calculates price multipliers aligned with objective | Feature-based multipliers (demand, urgency, competition, fuel, seasonality) |
| **Seat Allocation Agent** | Recommends bucket reallocation strategies | Allocation recommendations with urgency level |
| **Competitor Agent** | Monitors competitive positioning | Market position analysis and pricing recommendations |

## Pricing Model

The system uses feature-based dynamic pricing with 5 multiplier categories:

```
Final Price = Base Price x (Demand x Urgency x Competition x Fuel x Seasonality)
```

- **Demand Multiplier**: Based on current booking velocity and forecast
- **Urgency Multiplier**: Days to departure impact
- **Competition Multiplier**: Competitor price positioning
- **Fuel Multiplier**: Operating cost adjustments
- **Seasonality Multiplier**: Peak/off-peak season impact

Combined multiplier is clamped to +/- 20% to prevent extreme price swings.

## Available Scenarios

| Scenario | Description | Primary Objective |
|----------|-------------|-------------------|
| IPL Season Final | High demand event with premium pricing opportunity | Revenue Maximization |
| IPL Final Cancelled | Demand collapse requiring rapid price adjustment | Occupancy Maximization |
| Low Demand - 5 Days Out | Late booking period with low interest | Occupancy Maximization |
| Severe Weather Warning | External disruption affecting travel plans | Competitive Matching |
| Competitor Price War | Aggressive competitor pricing requiring response | Competitive Matching |
| Dubai Expo 2025 | Major event driving sustained high demand | Revenue Maximization |
| Ramadan Travel Season | Cultural event with predictable demand patterns | Revenue Maximization |
| Oil Price Crash | Cost reduction opportunity | Revenue Maximization |
| Normal Weekday | Baseline scenario for comparison | Revenue Maximization |
| Weekend Rush | Moderate demand increase | Revenue Maximization |
| Last Minute Surge | High urgency bookings | Revenue Maximization |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| UI Components | shadcn/ui, Radix UI, Tailwind CSS |
| State Management | TanStack React Query |
| Backend | Express.js, TypeScript |
| Database | PostgreSQL with Drizzle ORM |
| AI/LLM | Google Gemini (gemini-2.5-flash) |
| Charts | Recharts |
| Animations | Framer Motion |

## Project Structure

```
.
├── client/                   # React frontend
│   ├── src/
│   │   ├── components/       # UI components
│   │   │   ├── AgentLogs.tsx       # Agent reasoning display
│   │   │   ├── BookingChat.tsx     # Booking assistant
│   │   │   ├── BucketPricing.tsx   # Seat bucket visualization
│   │   │   ├── DemandForecast.tsx  # Demand curve chart
│   │   │   └── ...
│   │   ├── pages/
│   │   │   └── Dashboard.tsx       # Main dashboard
│   │   └── lib/              # Utilities
├── server/                   # Express backend
│   ├── index.ts              # Server entry
│   ├── routes.ts             # API endpoints
│   ├── storage.ts            # Database & AI agents
│   └── db.ts                 # Database connection
├── shared/                   # Shared code
│   └── schema.ts             # Database schema & types
├── scripts/
│   └── setup-db.sh           # Database setup script
└── migrations/               # Database migrations
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/scenarios` | GET | List available scenarios |
| `/api/simulation/start` | POST | Start a new simulation session |
| `/api/simulation/state` | GET | Get current simulation state |
| `/api/simulation/orchestrate` | POST | Run all AI agents |
| `/api/simulation/book` | POST | Book a ticket |
| `/api/simulation/chat` | POST | Booking assistant chat |

## Quick Start

### Prerequisites

- Node.js 20.x
- PostgreSQL 14+
- Google Gemini API key

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dynamic-pricing-platform

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# - Add your GEMINI_API_KEY
# - Set DATABASE_URL
# - Set SESSION_SECRET

# Setup database (Ubuntu/Linux)
./scripts/setup-db.sh

# Push database schema
npm run db:push

# Start development server
npm run dev
```

The application will be available at `http://localhost:5000`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `SESSION_SECRET` | Yes | Session encryption secret |
| `NODE_ENV` | No | Environment (development/production) |
| `PORT` | No | Server port (default: 5000) |

## Getting a Gemini API Key

1. Visit https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key to your `.env` file

## Deployment

For production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## How It Works

1. **Select a Scenario**: Choose from 11 pre-configured market scenarios
2. **Load Scenario**: Initialize the simulation with scenario-specific data
3. **Run Agent Cycle**: Execute all 5 AI agents in sequence
4. **View Results**: See agent reasoning, pricing changes, and recommendations
5. **Book Tickets**: Use the booking interface to simulate customer purchases
6. **Iterate**: Run additional cycles to see how prices adapt

## Data Model

### Sessions
Tracks simulation state including scenario, dates, revenue, and load factor.

### Buckets
Seat allocation buckets with class (Economy/Business), pricing, and sales data.

### Reasoning Logs
Agent decision traces with full reasoning for transparency.

### Pricing History
Time-series tracking of price changes across all buckets.

## License

MIT License
