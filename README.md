# RF Outdoor Link Planner

A web-based tool for planning point-to-point RF links on a map, featuring tower placement, frequency configuration, and Fresnel zone visualization.

## Features

- **Interactive Map**: Built with Leaflet.js and OpenStreetMap.
- **Tower Management**: Click to place towers, configure names and frequencies (GHz).
- **Link Planning**: Connect towers with visual validation (frequencies must match).
- **Fresnel Zone Visualization**: Automatically calculates and displays the first Fresnel zone as an ellipse around the link when selected.
- **Dark Mode UI**: A premium, glassmorphism-inspired interface.

## How to Use

1.  **View Mode**: Default mode. Click items to select them and view properties.
2.  **Add Tower**: Click the "Tower" icon in the toolbar, then click on the map to place a tower.
3.  **Draw Link**: Click the "Link" icon. Click a source tower, then a target tower to connect them.
    - *Note*: Towers must have the same frequency to be connected.
4.  **Visualize Fresnel Zone**: Click on an existing link to see the Fresnel zone ellipse.

## Technical Details

- **Frontend**: Vanilla JavaScript, HTML5, CSS3.
- **Map Engine**: Leaflet.js.
- **Fresnel Calculation**:
    - Formula: $r = \sqrt{\frac{\lambda d_1 d_2}{d_1 + d_2}}$
    - The application generates a polygon by calculating the Fresnel radius at multiple points along the link and projecting them back to geographical coordinates.

## Design Decisions

- **Framework-less**: Used Vanilla JS to keep the bundle size small and demonstrate core DOM manipulation and logic skills.
- **2D Visualization**: The Fresnel zone is approximated as a 2D projection on the map surface. This provides immediate visual feedback without the complexity of a 3D engine.
- **User Experience**: Prioritized a "clean" map view. Controls are floating and semi-transparent (glassmorphism) to maximize map visibility.

## Setup

Simply open `index.html` in any modern web browser. No build step required.
