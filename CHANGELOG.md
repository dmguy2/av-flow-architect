# Changelog

## 2026-03-27
- **CSV cable schedule & equipment list export** — New Export menu options: "Cable Schedule (CSV)" and "Equipment List (CSV)" generate spreadsheet-ready files with all connections/equipment. Essential for bid documents, pull sheets, and inventory management. Inspired by AVIXA cable scheduling standards.
- **Disconnected device detection** — Signal chain analysis now flags speakers/displays/projectors with no incoming signal (warning) and source devices (mics/cameras) with no outgoing connections (info). Graph-level analysis catches wiring oversights that chain-level rules can't detect. Inspired by static analysis "unused variable" patterns.
- **Right-click context menus** — Node context menu (Copy, Duplicate, Group, Delete), edge context menu (Delete Cable), and pane context menu (Paste, Select All, Zoom to Fit). Styled to match existing dropdown-menu pattern. Inspired by React Flow official context menu example and draw.io/Figma UX conventions.

## 2026-03-26
- **Auto-assign cable IDs on connect** — New edges automatically get sequential cable labels (C-01, C-02, ...) following AVIXA cable labeling standards. Edge label pills show cable IDs when enabled. Also fixed all TypeScript build errors (React Flow v12 generic types, unused variables, React 19 strict ReactNode typing).
