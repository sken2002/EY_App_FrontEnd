# Project Spider

Project Spider is an AI-enhanced Risk Intelligence platform designed for complex infrastructure programmes. It transforms fragmented project signals (cost, schedule, supplier, operational, and cashflow data) into connected, explainable, and actionable risk intelligence.

## Overview

Unlike traditional reporting tools that merely monitor lagging indicators, Project Spider is built to investigate, explain, and act upon risk. It aggregates data across hundreds of work packages and contracts to provide a prioritized portfolio view, allowing leadership to allocate attention where exposure is greatest.

### Core Capabilities

- **Dependency Mapping:** Analyzes dependencies, contracts, and work packages as a single interconnected system.
- **Risk Propagation Modelling:** Identifies dependency pathways and calculates potential downstream blast radius.
- **Intervention Simulation:** Allows users to model operational changes and immediately observe the impact on the Composite Risk Index (CRI) before committing resources.
- **Explainable AI:** Converts complex risk calculations into clear, executive-level narratives, ensuring every score is traceable to business rules and source evidence.

## Architecture

The system is composed of a deterministic risk engine and a multi-agent AI layer:

1. **Deterministic Layer:** Computes base metrics (CPI, SPI, VAC) and applies framework weights across six dimensions to produce severity scores and the Composite Risk Index. It also manages the graph topology and dependency mappings.
2. **AI Strategist Layer:** Interprets the deterministic outputs and translates them into an executive-level mitigation strategy, preserving transparency and auditability.

## Development Setup

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## Risk Framework

The Composite Risk Index is calculated across six dimensions:
- **Cost & Financial:** CPI, SPI, Cost Variance
- **Cashflow:** Cashflow deviation, payment rejection rate
- **Supplier:** Supplier concentration, supplier performance
- **Schedule:** Milestone delays, schedule slippage
- **Operational:** Service-order backlog, unresolved incidents
- **Data Quality:** Issue severity, inventory quality
