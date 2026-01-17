## Packages
framer-motion | Complex animations for the seat map and agent reasoning logs
recharts | Visualizing pricing history and load factors
lucide-react | Icons for the dashboard interface
clsx | Utility for constructing className strings conditionally
tailwind-merge | Utility for merging Tailwind CSS classes efficiently
date-fns | Date formatting for simulation timestamps

## Notes
Tailwind Config - extend fontFamily:
fontFamily: {
  sans: ["Inter", "sans-serif"],
  mono: ["JetBrains Mono", "monospace"],
  display: ["Space Grotesk", "sans-serif"],
}

The dashboard needs to poll `/api/simulation/state` frequently to show live updates.
Seat map visualization requires a custom grid layout.
Agent logs should use a scrollable container with distinct styling for different agent roles.
