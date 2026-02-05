# YChart Integration into TimeharborApp

## Overview
This PR integrates YChart, an interactive organizational chart library, into TimeharborApp to visualize team structures dynamically. The integration allows rendering hierarchical team member relationships in a collapsible, searchable org chart format.

## Changes Made
- Downloaded and placed `ychart-editor.js` in the public directory.
- Created `YChartOrgChart.tsx` component that converts team member data to YAML and initializes the YChart editor.
- Added script loading, data conversion, and rendering logic using React hooks.

## Known Issues
- **CSS Conflicts**: YChart's CSS is interfering with TimeharborApp's styling, preventing proper CSS loading. This will be addressed in future updates to the YChart repository and subsequent PRs to resolve conflicts gradually.

## Files Modified/Created
- `timeharbourapp/components/teams/YChartOrgChart.tsx` (new)
- `timeharbourapp/public/ychart-editor.js` (new)