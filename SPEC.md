# Product Requirements Document: AV Flow Architect

**Version:** 2.1
**Status:** Final Draft
**Date:** February 27, 2026

---

## 1. Executive Summary

**AV Flow Architect** is a specialized diagramming application for Audio-Visual professionals, System Integrators, and Live Event technicians. Unlike generic diagramming tools (Visio, Lucidchart), this application is context-aware. It understands signal flow, differentiates between connector types (HDMI vs. XLR), and manages the physical limitations of hardware.

The core differentiator is its **Layering System**, which solves the visual congestion of complex signal flows by allowing users to toggle visibility between Audio, Video, Network, Power, and AV-over-IP layers instantly.

## 2. Problem Statement

1. **Visual Overload:** In complex AV setups, drawing power, data, audio, and video lines on one layer results in an unreadable "spaghetti" diagram.
2. **Generic Components:** Competitor tools use generic rectangles. Users must manually draw ports, leading to errors (e.g., assigning 5 outputs to a switcher that only has 4).
3. **Hybrid Workflows:** Modern AV requires visualizing software endpoints (Zoom/Teams) alongside physical hardware, which existing tools handle poorly.
4. **Lack of Validation:** Generic tools allow users to connect incompatible signals (e.g., Speaker Wire to an HDMI input).

## 3. User Personas

- **The Live Event Engineer (A1/V1):** Needs to create stage plots and signal flows for festivals or corporate gigs quickly.
- **The System Integrator:** Needs to document permanent installs with precise cable schedules and power load calculations.
- **The IT/AV Tech:** Needs to visualize how a Zoom Room interacts with the corporate network and USB peripherals.

---

## 4. Key Functional Requirements

### 4.1. The Layering System (Visual Management)

The canvas supports distinct logical layers for managing visual complexity.

#### Layer Types

| Layer | Signal Types | Default Color | Dash Pattern |
|-------|-------------|---------------|--------------|
| **Audio** | XLR, TRS, Speakon, AES/EBU | Blue | Solid |
| **Video** | HDMI, SDI, DisplayPort | Green | Dashed |
| **Control/Network** | Ethernet (Control), RS232, USB (Data) | Yellow | Dotted |
| **Power** | IEC, Powercon, DC Barrel | Red | Dash-dot |
| **AV-over-IP** | Dante, NDI, AES67, AVB | Purple | Long dash |

The AV-over-IP layer is a dedicated 5th layer, separate from both Audio/Video and Network/Control. This reflects the reality that networked AV protocols (Dante, NDI, AES67) carry audio/video as network packets and don't cleanly belong to either traditional category.

#### Layer UI Controls

- **Location:** Collapsible tab within the left sidebar (alongside the device library). Not a floating widget.
- **Global Visibility:** Toggle "Eye" icons to show/hide entire layers.
- **Focus Mode:** Clicking a specific layer (e.g., "Audio") dims all other connection lines to 20% opacity, highlighting only the audio signal path.
- **Z-Index Strategy:** Power lines render at the bottom; active signal lines render on top.

#### Layer Orphan Behavior

When a layer is toggled OFF, devices that have ALL of their ports belonging to the hidden layer are **dimmed to ~20% opacity**. They remain visible and positioned on the canvas so users maintain spatial awareness, but they are visually de-emphasized.

#### Accessibility

All signal types are distinguishable through **three independent channels**:
1. **Color** (customizable per signal type via settings)
2. **Dash patterns** (unique per signal type, works in B&W prints)
3. **Inline edge labels** (toggle-able globally: `AUD`, `VID`, `PWR`, `NET`, `AoIP`)

### 4.2. "Real Gear" Component Library

Nodes are not just boxes; they are digital twins of real equipment.

#### Library Structure

- **Bundled Library:** Ships with curated JSON definitions for common devices.
- **User-Created Devices:** Users can create custom device definitions via a **form-based wizard** (step-by-step: name, manufacturer, add ports with type dropdown, label, direction).
- **B&H Photo Import:** Users paste a B&H Photo Video product URL, a local Python scraper (undetected-chromedriver) fetches product details (images, specs), and a local LLM (Ollama, llama3.2:3b) extracts structured I/O ports from the specs. The app presents a 3-step wizard: paste URL, review/edit auto-detected ports, save to library. Product images are stored as blobs in IndexedDB. Ollama starts automatically on first import and stops when the backend shuts down. Falls back to regex extraction if Ollama is unavailable.
- **Generic Devices:** "4-Ch Mixer", "Generic PTZ Camera", "Generic Switcher", etc.
- **Specific Devices:** Database of real devices (e.g., *Blackmagic ATEM Mini*, *Behringer X32*).

#### Port Mapping

- Real gear nodes are instantiated with fixed input/output handles based on their JSON definition.
- An "ATEM Mini" node cannot have a 5th HDMI input added to it, preventing planning errors.
- **Configurable I/O devices** (QSC Q-SYS Core, Biamp TesiraFORTE, etc.) define the physical maximum I/O. Users can **enable/disable individual ports** but cannot exceed hardware limits.

#### Signal Splitting

Connections are strictly **1:1** (one output port to one input port). To split a signal to multiple destinations, users must explicitly place a Distribution Amplifier (DA) or Splitter node. This enforces real-world accuracy — you can't split HDMI without hardware.

#### Software Nodes

Specific nodes for **Microsoft Teams**, **Zoom**, **vMix**, and **OBS**. These accept logical inputs (USB Video/Audio) and provide logical outputs (Network Stream).

#### Device Placement

Devices are placed on the canvas by **dragging from the library sidebar** and dropping at the desired position.

### 4.3. Dual Visualization Modes

#### Signal Flow Mode (Default)

Schematic view. Nodes are rectangular blocks with inputs on the left and outputs on the right. Optimized for tracing signal chain logic. All connections are visible according to layer settings.

#### Physical Layout Mode

Top-down "Stage Plot" view. Nodes render as their physical device appearance (e.g., a top-down view of a drum kit or mixing console). Connections are hidden or simplified to show cable runs.

**Mode switching preserves node positions.** Both modes share the same X/Y coordinates — only the visual representation changes. This ensures spatial consistency when toggling between modes.

#### Scaled Floor Plan

Physical Layout mode operates on a **scaled floor plan**:
- Users set a room scale (e.g., `1px = 1ft` or `1px = 1m`).
- Cable lengths **auto-calculate** from node positions based on the scale.
- Grid shows real-world dimensions.

### 4.4. Connections & Cabling

#### Intelligent Edges

- Edges carry metadata: Signal Type, Cable Length, Connector Type.
- **Default metadata** is auto-applied on connection (e.g., `HDMI, 10ft`). Users edit via Inspector panel. No popup interrupts the connection flow.

#### Tiered Validation

| Tier | Behavior | Example |
|------|----------|---------|
| **Block** | Prevent connection entirely | HDMI output → XLR input |
| **Warn** | Allow with red glow + warning icon | Balanced → Unbalanced, passive splitter |
| **Allow** | No warning | Compatible types |

#### Connector Variants & Physical Compatibility

The base `ConnectorType` enum groups connectors by signal family, but real-world AV gear has physically incompatible variants within each family. Each connector type supports an optional `variant` field for precise physical matching.

| Base Type | Variants | Compatibility Notes |
|-----------|----------|-------------------|
| `xlr` | `3-pin`, `5-pin`, `7-pin` | 3-pin (audio) won't fit 5-pin (DMX). Adapter required. |
| `trs` | `1/4"`, `3.5mm`, `2.5mm` | Different barrel sizes. Adapter required between sizes. |
| `hdmi` | `full`, `mini`, `micro` | Different form factors. Adapter required. |
| `ethernet` | `rj45`, `ethercon` | etherCON into RJ45 works. RJ45 into etherCON chassis requires adapter. |
| `usb` | `a`, `b`, `c`, `micro-b` | Different plug shapes. Cannot plug A into A. |
| `powercon` | `20a`, `32a`, `true1` | Different lockout profiles. Not interchangeable. |
| `speakon` | `2-pole`, `4-pole`, `8-pole` | 2-pole fits 4-pole chassis but not 8-pole. |
| `sdi` | `bnc`, `micro-bnc` | Different connector sizes. Adapter required. |

**Validation behavior with variants:**
- **Same variant → Allow** (direct connect)
- **Compatible variants → Warn** ("adapter required" with specific adapter type)
- **Incompatible variants → Block** (e.g., XLR 3-pin into XLR 5-pin)
- **No variant specified → Allow with base-type rules** (backward compatible)

This extends the `AVPort` interface with an optional `variant` field:
```typescript
interface AVPort {
  // ...existing fields
  variant?: string; // e.g. '3-pin', 'ethercon', '1/4"', 'type-a'
}
```

#### Signal Chain Analysis

Beyond port-level validation, the app traces complete signal paths and validates:
- **Gain staging:** Mic-level signals reaching line-level inputs without a preamp.
- **Impedance mismatches:** Low-impedance output to high-impedance input issues.
- **Power requirements:** Unpowered passive speakers in the signal chain.
- **Missing preamps:** Microphone connected directly to powered speakers.

Signal chain warnings appear as **advisory notices** in the Inspector panel when a device or edge is selected.

#### Cable Routing

- **Default:** Orthogonal (right-angle) routing for clarity.
- **Waypoints:** Users can drag midpoints on edges to create manual waypoints for clean routing around other devices.

#### Cable Styling

| Signal Type | Default Color | Dash Pattern |
|-------------|--------------|--------------|
| Video | Green | Dashed |
| Audio | Blue | Solid |
| Power | Red | Dash-dot |
| Data/Network | Yellow | Dotted |
| AV-over-IP | Purple | Long dash |

All colors are user-customizable in settings.

### 4.5. Multi-Page Projects

Projects support multiple pages with **cross-page signal flow**.

#### Offsheet Connectors

Pages are connected via **labeled terminal nodes** — special nodes labeled (e.g., `TO: Page 2 / FOH Input A`). Clicking a terminal node navigates to the destination page and highlights the corresponding receiving terminal.

#### Page Management

- Pages are listed in the project overview (Inspector panel when nothing is selected).
- Each page has its own canvas, node layout, and viewport state.
- Pages share the project's device library and settings.
- Maximum ~200 nodes per page (see Performance section).

### 4.6. Grouping

Devices can be grouped into **collapsible sub-circuits**.

- A group (e.g., "Stage Box") contains multiple devices and their internal connections.
- **Collapsed view:** The group renders as a single node exposing aggregate ports — only ports with external connections are shown.
- **Expanded view:** All internal devices and connections are visible and editable.
- Groups can be nested (a group within a group).

### 4.7. Annotations

The canvas supports non-device visual elements:
- **Text labels:** Free-standing text nodes for labeling areas, adding notes.
- **Shapes:** Rectangles, ellipses, and lines for marking zones (e.g., "STAGE", "FOH", "GREEN ROOM").
- **Callout arrows:** Arrows pointing to devices with explanatory text.

Annotations are treated as canvas nodes and can be moved, resized, and deleted like any other element.

### 4.8. Templates

Templates are **insertable snippets** — pre-built sub-diagrams that can be dropped into any page of an existing project.

- Examples: "2-Camera Streaming", "Conference Room Audio", "Wireless Mic Rack", "Podcast 4-Person".
- Inserting a template places all its devices and internal connections onto the current page at the cursor position.
- Templates are managed alongside the device library in the left sidebar.

---

## 5. Technical Architecture

### 5.1. Tech Stack

| Concern | Technology |
|---------|-----------|
| Framework | React + TypeScript (Vite) |
| Diagram Engine | `@xyflow/react` (React Flow) |
| State Management | `zustand` (single store, slice pattern) |
| Styling | Tailwind CSS + `shadcn/ui` |
| Icons | `lucide-react` |
| Persistence | `dexie` (IndexedDB) |
| Image Export | `html-to-image` (PNG) |
| PDF Export | `jspdf` |
| Deployment | Static SPA on Vercel or Netlify |
| Scraper Backend | Python (FastAPI + uvicorn), port 8420 |
| Browser Automation | `undetected-chromedriver` + Selenium |
| HTML Parsing | BeautifulSoup4 |
| Local LLM | Ollama (`llama3.1:8b-instruct-q4_K_M`, ~4.9GB) |

### 5.2. State Architecture

A **single Zustand store** using the slice pattern:

| Slice | Responsibility |
|-------|---------------|
| `nodeSlice` | Node positions, data, selection |
| `edgeSlice` | Connections, edge metadata |
| `layerSlice` | Layer visibility, focus mode, active layers |
| `pageSlice` | Multi-page management, active page, offsheet connectors |
| `projectSlice` | Project metadata, settings, scale configuration |
| `uiSlice` | Panel visibility, active tool, selection state |
| `historySlice` | Undo/redo stack |

Single store enables straightforward undo/redo since the entire state tree is captured in one place.

### 5.3. Data Model (TypeScript Interfaces)

```typescript
type SignalDomain = 'audio' | 'video' | 'network' | 'power' | 'av-over-ip';

type ConnectorType =
  // Audio
  | 'xlr' | 'trs' | 'rca' | 'speakon'
  // Video
  | 'hdmi' | 'sdi'
  // Network/Control
  | 'ethernet' | 'usb' | 'dmx' | 'fiber' | 'wifi'
  // Power
  | 'powercon'
  // AV-over-IP
  | 'dante' | 'aes50' | 'ndi';

interface AVPort {
  id: string;
  label: string;
  domain: SignalDomain;
  connector: ConnectorType;
  variant?: ConnectorVariant; // Physical connector subtype (e.g. 'xlr-3pin', 'hdmi-full')
  direction: 'input' | 'output' | 'bidirectional';
  enabled?: boolean; // For configurable I/O devices (defaults true)
}

type ComponentCategory = 'audio' | 'video' | 'lighting' | 'infrastructure' | 'corporate' | 'software';

interface AVComponentDef {
  type: string;
  label: string;
  category: ComponentCategory;
  icon: string;
  defaultPorts: AVPort[];
  defaultWidth?: number;
  defaultHeight?: number;
  manufacturer?: string;  // e.g. "Blackmagic Design", "QSC"
  model?: string;         // e.g. "ATEM Mini", "Q-SYS Core 110f"
  isGeneric?: boolean;    // undefined = generic
  configurableIO?: boolean; // true for DSP-type devices with toggleable ports
  powerDraw?: string;     // e.g. "60W", "25W (PoE)"
  bhUrl?: string;          // B&H product page URL (import source)
  images?: string[];       // Base64 data URIs of product images
  importSource?: 'bh' | 'manual'; // How the component was added
  importedAt?: number;     // Timestamp of import
}

interface AVNodeData {
  componentType: string;
  label: string;
  ports: AVPort[];
  model?: string;
  notes?: string;
  image?: string;
  rotation?: number;
  manufacturer?: string;
  isGenericInstance?: boolean; // true for generic, false for real gear
  configurableIO?: boolean;
  powerDraw?: string;
}

interface AVEdgeData {
  domain: SignalDomain;
  connector: ConnectorType;
  variant?: ConnectorVariant; // Physical connector subtype
  label?: string;       // Cable label, e.g. "C-01", "Snake 1"
  warning?: string;     // Validation warning message
}

interface OffsheetConnector {
  id: string;
  label: string;
  signalType: SignalDomain;
  sourcePageId: string;
  targetPageId: string;
}

interface ProjectPage {
  id: string;
  label: string;
  nodes: Node<AVNodeData>[];
  edges: Edge<AVEdgeData>[];
  viewport: { x: number; y: number; zoom: number };
}

interface AVProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  mode: 'signal-flow' | 'physical-layout';
  nodes: Node<AVNodeData>[];
  edges: Edge<AVEdgeData>[];
  viewport: { x: number; y: number; zoom: number };
  layerVisibility?: Record<SignalDomain, boolean>;
  focusedLayer?: SignalDomain | null;
  showEdgeLabels?: boolean;
  pages?: ProjectPage[];
  activePageId?: string;
  offsheetConnectors?: OffsheetConnector[];
}
```

### 5.4. Undo/Redo System

- **Granularity:** Per-action. Every discrete action (move node, create edge, delete, rename, toggle port, etc.) is independently undoable.
- **Implementation:** State snapshots stored in a bounded history stack within `historySlice`.
- **Keyboard:** `Ctrl+Z` / `Cmd+Z` to undo, `Ctrl+Shift+Z` / `Cmd+Shift+Z` to redo.

### 5.5. Performance

- **Target:** ~200 nodes per page. Large installs should use multi-page to stay within this per-page limit.
- **No virtualization required** at this scale — React Flow handles 200 custom nodes without issue.
- Node count indicator displayed in the project overview.

### 5.6. Persistence

- **Auto-save:** Continuously saves to IndexedDB (via Dexie) on every state change (debounced).
- **Manual Export/Import:** Users can export projects as `.avflow` JSON files and import them back. This is the sharing and backup mechanism.
- **No cloud storage.** All data is local to the browser.

---

## 6. UI/UX Specifications

### 6.1. Theme

- **Dark mode** by default (industry standard for AV apps).
- **Light mode** available via toggle in settings/toolbar.
- Exports (PNG, PDF) **match the active theme** at time of export.

### 6.2. The Canvas

- Grid background with snap-to-grid (20px).
- Orthogonal cable routing with manual waypoints.
- Right-click context menu for common actions.

### 6.3. Layout

```
+--------------------------------------------------+
|  Toolbar (top)                                    |
+--------+-------------------------------+---------+
|        |                               |         |
| Left   |        Canvas                 | Right   |
| Sidebar|                               | Panel   |
|        |                               | (Insp.) |
| - Lib  |                               |         |
| - Layers|                              |         |
| - Pages |                              |         |
|        |                               |         |
+--------+-------------------------------+---------+
|  Status Bar (node count, zoom level, scale)       |
+--------------------------------------------------+
```

### 6.4. Left Sidebar (Collapsible Tabs)

| Tab | Content |
|-----|---------|
| **Library** | Searchable device library. Drag to place. Categories + search filter. |
| **Layers** | Layer visibility toggles, focus mode, color swatches. |
| **Pages** | Page list, add/rename/delete pages, cross-page connection summary. |
| **Templates** | Browsable snippet templates. Drag to insert. |

### 6.5. The Inspector (Right Panel)

Context-sensitive:

| Selection State | Inspector Content |
|----------------|-------------------|
| **Nothing selected** | Project overview: device count, total power draw, page list, project notes. |
| **Node selected** | Device name, manufacturer (read-only for real gear), model (read-only for real gear, editable for generic), power draw, notes. Port list with three editing modes: **generic** (free add/remove/rename/edit), **real gear fixed I/O** (read-only port list with connector labels), **configurable I/O** (toggle switches to enable/disable ports). |
| **Edge selected** | Cable type, cable length, cable spec, signal type, source/destination info. |
| **Group selected** | Group name, contained device count, expand/collapse toggle, aggregate ports. |

### 6.6. Copy & Paste

When copying a selection of connected devices and pasting:
- All selected devices are duplicated.
- **Internal connections** (edges between copied devices) are preserved.
- External connections (edges to non-selected devices) are dropped.
- Pasted devices are offset slightly from originals to avoid overlap.

### 6.7. Keyboard Shortcuts

Full keyboard shortcut system for power users:

| Shortcut | Action |
|----------|--------|
| `1` - `5` | Toggle layer visibility (Audio, Video, Network, Power, AV-over-IP) |
| `Ctrl+Z` / `Cmd+Z` | Undo |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo |
| `Delete` / `Backspace` | Delete selected |
| `Ctrl+C` / `Cmd+C` | Copy |
| `Ctrl+V` / `Cmd+V` | Paste |
| `Ctrl+A` / `Cmd+A` | Select all |
| `Ctrl+G` / `Cmd+G` | Group selected |
| `Ctrl+Shift+G` / `Cmd+Shift+G` | Ungroup |
| `Ctrl+S` / `Cmd+S` | Export project file |
| `Arrow keys` | Nudge selected nodes |
| `Shift+Arrow` | Nudge by 10x grid |
| `Space + Drag` | Pan canvas |
| `Ctrl+0` / `Cmd+0` | Fit view to content |
| `Tab` | Cycle selection through connected devices |
| `M` | Toggle Signal Flow / Physical Layout mode |
| `F` | Focus mode on selected device's primary layer |

---

## 7. Export

| Format | Content |
|--------|---------|
| **PNG** | Raster image of the current page at current zoom. Matches active theme. |
| **PDF** | Vector export of the current page. Matches active theme. Suitable for printing. |
| **CSV Cable Schedule** | All cables: Type, Length, Spec, Source Device, Source Port, Destination Device, Destination Port. |

---

## 8. Implementation Roadmap

### Phase 1: MVP — Signal Flow, Layers, Core Editing

1. **Project Scaffolding:** Vite + React + TypeScript + Tailwind + shadcn/ui + Zustand + React Flow.
2. **Custom AV Node:** Dynamic port rendering from JSON definition. Ports on left (inputs) / right (outputs). Signal type color coding.
3. **Layering System:** Edge `data.type` attribute. Layer visibility in Zustand store. Edges render `display: none` or `opacity: 0.1` per layer state. Device dimming when all ports belong to hidden layers.
4. **AV-over-IP Layer:** 5th layer for Dante/NDI/AES67 with dedicated color and dash pattern.
5. **Basic Device Library:** Generic Mixer, Generic Speaker, Laptop, Switcher, Distribution Amp, Generic Camera, Generic Microphone.
6. **Connection Validation:** Tiered system — block impossible connections, warn on questionable ones.
7. **Inspector Panel:** Context-sensitive right panel. Project overview when nothing selected. Device/edge properties when selected.
8. **Undo/Redo:** Per-action history stack in Zustand.
9. **Multi-Page:** Page management in left sidebar. Labeled terminal nodes for offsheet connectors.
10. **Grouping:** Select devices → group → collapsible node with aggregate ports.
11. **Persistence:** Auto-save to IndexedDB. Export/import `.avflow` JSON files.
12. **Theme:** Dark mode default + light mode toggle.
13. **Keyboard Shortcuts:** Full shortcut system as specified.
14. **Cable Routing:** Orthogonal routing with manual waypoints.
15. **Accessibility:** Dash patterns per signal type, optional inline edge labels, customizable color palette.
16. **Annotations:** Text nodes and shape nodes on canvas.

### Phase 2: "Real Gear", Templates & Physical Mode

1. ~~**JSON Library Expansion:** Curated definitions for top 20 common devices (ATEMs, X32, QSys Core, Shure Wireless, etc.).~~ **DONE** — 22 real-world devices implemented.
2. **Custom Device Wizard:** Form-based step-by-step wizard for user-created device definitions.
3. ~~**Configurable I/O:** Devices with software-defined routing show max physical I/O with enable/disable per port.~~ **DONE** — Three-mode Properties Panel (generic / fixed / configurable).
4. ~~**Searchable Library Sidebar:** Filter by category, manufacturer, or model name.~~ **DONE** — Search matches label, type, category, manufacturer, and model.
5. **Snippet Templates:** Insertable sub-diagrams for common setups (Conference Room, 2-Camera Streaming, Podcast, Wireless Mic Rack).
6. **Physical Layout Mode:** Toggle to change node rendering from schematic to top-down image. Same X/Y positions.
7. **Scaled Floor Plan:** Configurable scale (px-to-real-world-unit). Auto-calculated cable lengths from node positions.
8. **Copy/Paste:** Full support with internal edge preservation.

### Phase 3: Advanced Features

1. **Signal Chain Analysis:** Full signal path tracing. Validate gain staging, impedance, preamp requirements, passive speaker power.
2. **Power Calculator:** Simple watt sum per project. Each device has a `powerDraw` field. Total displayed in project overview.
3. **Cable Schedule Export:** CSV generation of all cables with type, length, spec, source, and destination.
4. **PNG/PDF Export:** Image and vector export matching the active theme.

---

## 9. Success Metrics

1. **Speed:** A user can create a simple 2-camera streaming setup diagram in under 2 minutes.
2. **Clarity:** A user can export a PDF where Audio and Video paths are clearly distinguishable (via color, dash pattern, and labels).
3. **Accuracy:** The system prevents at least one "logic error" (like connecting HDMI to XLR) via validation enforcement.
4. **Scale:** A 200-device convention center install is documentable across multiple pages with cross-page signal flow.
5. **Accessibility:** Signal types are distinguishable by color-blind users through dash patterns and inline labels.

---

## 10. Reference Libraries

| Library | Purpose | Link |
|---------|---------|------|
| **companion-module-base** | Reference for AV device module architecture and protocol patterns (Bitfocus Companion) | https://github.com/bitfocus/companion-module-base |
| **react-dropzone** | File drag-and-drop for `.avflow` project import and device image uploads | https://github.com/react-dropzone/react-dropzone |
| **react-jsonschema-form** | Auto-generated forms from JSON Schema for the custom device wizard and Inspector panel | https://github.com/rjsf-team/react-jsonschema-form |
| **ajv** | JSON Schema validation for device definitions and project file integrity | https://github.com/ajv-validator/ajv |
| **PapaParse** | CSV generation for cable schedule export | https://github.com/mholt/PapaParse |
| **react-hotkeys-hook** | Keyboard shortcut management for the full shortcut system | https://github.com/JohannesKlauss/react-hotkeys-hook |
| **zundo** | Zustand undo/redo middleware for per-action history stack | https://github.com/charkour/zundo |

---

## 11. Implementation Progress

Tracking what has been built against the SPEC requirements.

### Completed

- [x] **4.1 Layering System** — Signal domains (audio, video, network, power, av-over-ip), layer visibility toggles, focus mode (20% dim), orphan node dimming, dash patterns per signal type, inline edge labels (AUD/VID/NET/PWR/AoIP), z-index ordering, tabbed sidebar (Components/Layers), persistence of layer state.
- [x] **Core Canvas** — React Flow canvas with snap-to-grid, signal-flow and physical-layout dual modes, minimap, background, controls.
- [x] **Component Library** — 36 generic device definitions across audio/video/lighting/infrastructure/corporate/software categories plus 22 curated real-world devices (58 total) with drag-to-place. Includes Remote Participant (Teams/Zoom caller with camera/mic/room feeds), Wireless AP (LAN/WAN/Wi-Fi), and Tablet Control (iPad mixing app) nodes. Wi-Fi connector type for wireless network connections. Library/My Gear toggle to separate built-in components from user-imported gear. Product thumbnail images displayed on imported component cards.
- [x] **Custom Components** — Form-based creator with port configuration, saved to IndexedDB.
- [x] **B&H Photo Import** — Local Python backend (FastAPI + undetected-chromedriver) scrapes B&H product pages for images and specs. Local LLM (Ollama, llama3.1:8b-instruct-q4_K_M) extracts structured I/O ports from specs with `format: "json"` constrained output, including connector variant detection. Post-processing validation cross-references ports against spec text keywords (`CONNECTOR_EVIDENCE` + `VARIANT_EVIDENCE`). 3-step import wizard (paste URL → review/edit auto-detected ports → save to library). Product images stored as blobs in IndexedDB (`componentImages` table, DB v3). Ollama auto-starts on first import, auto-stops on backend shutdown. Regex fallback if Ollama unavailable. Vite proxy (`/api` → `:8420`) with 120s timeout. Backend directory excluded from Vite file watcher to prevent page reloads.
- [x] **Inspector Panel** — Context-sensitive right panel for node properties (label, model, notes, ports) and edge properties (domain, connector, cable label).
- [x] **Undo/Redo** — Per-action history stack with bounded size.
- [x] **Grouping** — Select + group into parent node, ungroup back.
- [x] **Persistence** — Save/load to IndexedDB, export/import `.avd` JSON files.
- [x] **Theme** — Dark/light mode toggle.
- [x] **Templates** — 5 insertable templates (Conference Room, Live Band, Corporate Presentation, House of Worship, Festival Stage).
- [x] **Copy/Paste** — Full support with internal edge preservation.
- [x] **Bulk Operations** — Align, distribute, duplicate, select all.
- [x] **Signal Chain Analysis** — Graph traversal traces signal paths from sources (mics, cameras, media players) to sinks (speakers, displays, recorders) with cycle detection. Deterministic rule engine checks for missing preamps, missing amplifiers, gain staging issues, and long video chains. LLM-powered deep analysis via `/api/analyze-chain` endpoint (Ollama llama3.1:8b). Signal Chain Panel in sidebar with per-chain LLM analysis, color-coded issue cards, and affected-node highlighting. Validate button in toolbar with issue count badge. Canvas nodes display issue badges (red/amber/blue). Status bar shows error/warning counts.
- [x] **UI Polish** — Refined dark mode palette with layered depth. Domain-colored node selection glow. Subtle header gradients. Port handle glow effects. Edge selection glow with persistent warning pills. Segmented mode toggle and pill-grouped tools in toolbar. Category count badges in sidebar. Hover-lift on component cards with styled port count badges. Wider properties panel (w-72). Panel slide-in animations. Node appear animations. Issue-pulse animation on error nodes. Status bar with signal chain health indicator and total power draw calculator.

### Also Completed (from later phases)

- [x] **4.2 "Real Gear" Library** — 22 curated manufacturer-specific devices: Blackmagic Design (ATEM Mini, ATEM Mini Pro, ATEM Television Studio HD8, HyperDeck Studio Mini, Web Presenter 4K), Magewell (Pro Convert HDMI 4K Plus), Extron (DTP CrossPoint 4K), Crestron (DM-MD8x8), Behringer (X32), Yamaha (CL5), Allen & Heath (dLive S7000), QSC (Q-SYS Core 110f), Biamp (TesiraFORTE AI), Shure (ULXD4Q, MXA920), Crown (CDi DriveCore 4|600), Audinate (Dante AVIO 2x2), Luminex (GigaCore 10). Software nodes: Microsoft Teams Room, Zoom Room, OBS Studio, vMix, Remote Participant. Infrastructure: Wireless AP. Control: Tablet Control. Configurable I/O with enable/disable toggles on Extron DTP CrossPoint, QSC Core 110f, and Biamp TesiraFORTE. Three-mode Properties Panel: generic (free edit), real gear fixed (read-only ports), configurable I/O (toggle switches). AES50, NDI, and Wi-Fi connector types added. Software category with purple color in sidebar. Connector variants on real gear (HDMI full, XLR 3-pin, USB-C, Speakon 4-pole, etc.).
- [x] **4.4 Connection Validation** — Tiered validation (block/warn/allow) with connector compatibility matrix, visual feedback during drag (red/blocked, amber/warned, green/allowed), warning storage on edges, warning display in Inspector panel and edge midpoint indicator. Connector variant-aware validation (same/compatible/incompatible matrix with adapter descriptions). Signal chain analysis with deterministic rules (missing preamp, missing amplifier, gain staging, video chain length) and LLM-powered deep analysis via Ollama backend.
- [x] **4.4 Connector Variants** — 23 variants across 8 connector families (XLR 3/5/7-pin, TRS 1/4"/3.5mm/2.5mm, HDMI full/mini/micro, Ethernet RJ45/etherCON, USB A/B/C/Micro-B, Powercon 20A/32A/TRUE1, Speakon 2/4/8-pole, SDI BNC/Micro-BNC). Three-tier compatibility matrix (same/compatible/incompatible) with adapter descriptions. Variant dropdown in Properties Panel for generic ports, read-only variant display for real gear. Variants added to real gear definitions (ATEM Mini, X32, Crown CDi, Luminex GigaCore, etc.). LLM port extraction updated to detect and validate variants.
- [x] **4.5 Multi-Page** — Page management (add/rename/delete pages, page-swap architecture), offsheet connector nodes, Pages tab in sidebar, per-page undo/redo, multi-page save/load/export/import with backward-compatible migration, status bar page indicator, multi-page PDF aggregation.
- [x] **7. Export (PNG/PDF)** — PNG raster export, SVG vector export, multi-page PDF export matching active theme.

### Not Yet Implemented

- [ ] **4.3 Scaled Floor Plan** — Room scale configuration, auto-calculated cable lengths from positions.
- [ ] **4.7 Annotations** — Text labels, shapes, callout arrows on canvas.
- [ ] **6.7 Keyboard Shortcuts (remaining)** — Layer toggles (1-5), nudge (Arrow keys, Shift+Arrow), Tab cycle through connected devices, F focus mode, M mode toggle. (Core shortcuts — Ctrl+Z/Y, Ctrl+S, Ctrl+G, Ctrl+D, Ctrl+C/V, Ctrl+A, Delete — all implemented.)
- [ ] **7. Export (CSV Cable Schedule)** — CSV generation of all cables with type, length, spec, source, and destination.
