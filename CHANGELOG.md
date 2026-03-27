# Changelog

## 2026-03-27
- **Right-click context menus** — Node context menu (Copy, Duplicate, Group, Delete), edge context menu (Delete Cable), and pane context menu (Paste, Select All, Zoom to Fit). Styled to match existing dropdown-menu pattern. Inspired by React Flow official context menu example and draw.io/Figma UX conventions.

## 2026-03-26
- **Auto-assign cable IDs on connect** — New edges automatically get sequential cable labels (C-01, C-02, ...) following AVIXA cable labeling standards. Edge label pills show cable IDs when enabled. Also fixed all TypeScript build errors (React Flow v12 generic types, unused variables, React 19 strict ReactNode typing).
