# Architecture Document

## Agentic Dynamic Pricing Platform -- BLR → DXB

------------------------------------------------------------------------

## 1. High Level Architecture

The platform consists of:

-   React Frontend\
-   FastAPI Backend\
-   LangGraph Agent Orchestration\
-   Gemini LLM\
-   SQLite Session Store

------------------------------------------------------------------------

## 2. Agent Ecosystem

### Core Agents

1.  **Orchestration Agent**
    -   Controls workflow\
    -   Determines objective\
    -   Aggregates reasoning
2.  **Demand Forecast Agent**
    -   Predicts demand\
    -   Uses scenario features\
    -   Produces confidence score
3.  **Seat Allocation Agent**
    -   Allocates seats to buckets\
    -   Optimizes for chosen objective
4.  **Dynamic Pricing Agent**
    -   Computes new prices\
    -   Considers demand and competition
5.  **Business Rules Agent**
    -   Validates decisions\
    -   Triggers HITL when required
6.  **Booking Agent**
    -   Handles user interaction
7.  **Competitor Analysis Agent**
    -   Evaluates Akasa, Air India, Jet Airways
8.  **Explanation Aggregator Agent**
    -   Collects reasoning from all agents

------------------------------------------------------------------------

## 3. Agent Workflow

1.  Scenario Loaded\
2.  Objective Selection\
3.  Demand Forecast\
4.  Competitor Analysis\
5.  Seat Allocation\
6.  Pricing Calculation\
7.  Business Rule Validation\
8.  Response to UI

------------------------------------------------------------------------

## 4. API Design

### POST /load-scenario

-   Resets system\
-   Initializes new session

### POST /orchestrate

-   Runs full agent pipeline

### POST /book

-   Books seats\
-   Triggers repricing

------------------------------------------------------------------------

## 5. SQLite Session Schema

**Tables**

-   session_meta\
-   seats\
-   allocations\
-   pricing_history\
-   reasoning_logs\
-   chat_history

Database is dropped and recreated on each scenario load.

------------------------------------------------------------------------

## 6. Reasoning Requirement

Every agent response must contain:

-   decision\
-   reasoning\
-   inputs\
-   outputs

Transparency is mandatory.

------------------------------------------------------------------------

## 7. File Structure

    project/
     ├── backend/
     │   ├── agents/
     │   ├── scenarios/
     │   ├── session/
     │   └── main.py
     ├── frontend/
     │   ├── components/
     │   └── App.tsx

------------------------------------------------------------------------

## 8. Demonstration Goals

The system must clearly show:

-   Impact of IPL event\
-   Fuel cost spikes\
-   Low demand situations\
-   Last‑minute high demand\
-   Human approvals

------------------------------------------------------------------------

**End of Architecture Document**
