# Technical Requirements Document

## Agentic Dynamic Pricing Simulator -- Indigo BLR → DXB

### 1. Overview

This system demonstrates an AI‑driven dynamic pricing engine for airline
ticketing using a multi‑agent architecture.\
All data is mocked and pre‑created as scenarios.

**Route:** Bangalore (BLR) to Dubai (DXB)\
**Airline:** Indigo\
**Competitors:** Akasa Air, Air India, Jet Airways\
**Persistence Model:** Session‑only using SQLite

------------------------------------------------------------------------

## 2. Goals of the System

-   Demonstrate how pricing decisions change based on scenario
    conditions\
-   Show collaboration of multiple AI agents\
-   Provide transparent reasoning for every decision\
-   Support Human‑In‑The‑Loop approvals\
-   Visualize seat allocation and pricing changes in real time

------------------------------------------------------------------------

## 3. Technology Stack

-   **Frontend:** React + TypeScript\
-   **Backend:** FastAPI\
-   **Agent Framework:** LangGraph\
-   **LLM:** Google Gemini\
-   **Database:** SQLite (session scoped only)

------------------------------------------------------------------------

## 4. Scenario‑Driven Design

All inputs are loaded from pre‑defined JSON scenario files.

### Environment Data Structure

-   Current Date\
-   Departure Date\
-   Days to Departure\
-   Revenue Target\
-   Event Information\
-   Weather Forecast\
-   Fuel Cost Index\
-   Occupancy\
-   Demand Forecast\
-   Competition Pricing\
-   Base Prices per Bucket

Additional optional features:

-   Seasonality Index\
-   Cancellation Rate\
-   No‑show Probability\
-   Historical Load Factor\
-   Social Sentiment Index

------------------------------------------------------------------------

## 5. Aircraft Model

**Aircraft:** Airbus A321 Neo\
**Total Seats:** 192

  Class      Seats   Buckets
  ---------- ------- ---------
  Business   24      2
  Economy    168     4

### Economy Buckets

  Bucket   Seats   Base Price
  -------- ------- ------------
  ECO_1    42      12000
  ECO_2    42      14000
  ECO_3    42      16000
  ECO_4    42      18000

### Business Buckets

  Bucket   Seats   Base Price
  -------- ------- ------------
  BUS_1    12      28000
  BUS_2    12      32000

------------------------------------------------------------------------

## 6. User Interface

### Panel 1 -- Environment Panel

-   Scenario selection dropdown\
-   Description\
-   Environment data display\
-   Load Scenario button

### Panel 2 -- Plane Visualization

-   Seat map of 192 seats\
-   Color‑coded buckets\
-   Revenue and demand forecasts\
-   Current objective\
-   Reasoning display

### Panel 3 -- Chat Window

-   Booking assistant\
-   HITL approvals\
-   Live reasoning trace

------------------------------------------------------------------------

## 7. Session Behavior

-   Data persists only during a scenario session\
-   Clicking **Load Scenario** resets everything\
-   No cross‑scenario memory is retained

------------------------------------------------------------------------

## 8. Human‑In‑The‑Loop Triggers

Approval required when:

-   Price drop \> 20%\
-   Price below floor threshold\
-   Revenue risk \> 15%\
-   Extreme seat reallocation

------------------------------------------------------------------------

## 9. Acceptance Criteria

The system is successful if:

-   Scenarios load correctly\
-   Agents execute sequentially\
-   UI updates dynamically\
-   Reasoning is visible\
-   HITL approvals work\
-   Booking triggers repricing

------------------------------------------------------------------------

**End of TRD**
