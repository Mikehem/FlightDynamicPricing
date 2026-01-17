# Agentic Dynamic Pricing Platform

## Overview

This is an AI-driven dynamic pricing simulator for airline ticketing, demonstrating a multi-agent architecture for the Indigo BLR → DXB route. The system uses multiple AI agents (Orchestrator, Demand Forecast, Seat Allocation, Dynamic Pricing, Business Rules, Competitor Analysis) powered by Google Gemini to make and explain pricing decisions in real-time. All data is scenario-driven with mocked inputs, and the platform provides transparent reasoning for every pricing decision with Human-In-The-Loop approval support.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled via Vite
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom aviation-themed color palette and CSS variables for theming
- **Animations**: Framer Motion for seat map and agent log animations
- **Charts**: Recharts for pricing history and load factor visualization
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Build System**: Custom esbuild configuration for production bundling with selective dependency inlining
- **API Design**: RESTful endpoints defined in `shared/routes.ts` with Zod schema validation
- **Development**: Vite dev server with HMR integration via middleware mode

### AI/Agent System
- **LLM Provider**: Google Gemini via Replit AI Integrations (gemini-2.5-flash for speed, gemini-2.5-pro for advanced reasoning)
- **Agent Pattern**: Multi-agent orchestration with specialized agents for forecasting, pricing, seat allocation, and business rules
- **Batch Processing**: Custom utilities with rate limiting, retry logic, and SSE support for batch AI operations
- **Image Generation**: Support for gemini-2.5-flash-image model

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Database**: PostgreSQL (connection via DATABASE_URL environment variable)
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Migrations**: Drizzle Kit with migrations output to `./migrations`

### Key Data Models
- **Sessions**: Track simulation state with scenario, dates, revenue, and load factor
- **Buckets**: Seat allocation buckets with class, pricing, and sales data
- **Reasoning Logs**: Agent decision traces with metadata for transparency
- **Pricing History**: Time-series tracking of price changes
- **Chat Messages**: Booking assistant conversation history

### Shared Code Pattern
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts`: Database schema and Zod validation schemas
- `routes.ts`: API route definitions with input/output types

## External Dependencies

### AI Services
- **Replit AI Integrations**: Provides Gemini API access without requiring a separate API key
  - Environment variables: `AI_INTEGRATIONS_GEMINI_API_KEY`, `AI_INTEGRATIONS_GEMINI_BASE_URL`
  - Requires custom httpOptions configuration with empty apiVersion

### Database
- **PostgreSQL**: Primary data store, provisioned via Replit
  - Connection string via `DATABASE_URL` environment variable
  - Session storage via `connect-pg-simple`

### GitHub Integration
- **Replit GitHub Connector**: OAuth-based GitHub access for repository operations
  - Uses Replit's connector API with identity tokens
  - Octokit REST client for GitHub API operations

### Third-Party Libraries
- **Radix UI**: Accessible component primitives for all UI interactions
- **Recharts**: Charting library for data visualization
- **Framer Motion**: Animation library for smooth transitions
- **date-fns**: Date formatting and manipulation
- **p-limit/p-retry**: Rate limiting and retry logic for API calls