# Robot Forge PCB Studio v2.5 — implementation & verification

## Where
- Public UI: https://robot-forge-ui-preview.onrender.com/workspace/
- Select **▦ PCB 설계** at the top of the workspace.

## Working browser features
- Board dimension editing (40–220 mm width, 30–160 mm height)
- Six simplified through-hole footprint templates: resistor, LED, capacitor, 2-pin / 3-pin headers, 4-pin IC
- Click-and-drag component placement; 90° component rotation
- Top copper (F.Cu) single-segment manual routing between actual component pad endpoints
- Click-to-delete components or traces; undo edits; local browser persistence per project
- Lightweight *preliminary* design warnings: outline clearance, overlapping footprints/pads, trace/pad proximity, single-layer track intersections
- JSON board backups, SVG illustration, KiCad `.kicad_pcb` **unverified draft** output
- Distinct **CAD** and **PCB** modes that reuse the clean blue-and-white workspace layout

## How to use
1. Click **PCB 설계**.
2. Under **부품 추가**, choose a part (e.g. 저항 or 3핀 커넥터).
3. Drag the part onto the board using the 선택·이동 tool.
4. Choose **배선 연결**; click one copper pad, then a second pad.
5. Run **설계 초안 검사**, then use **↓ PCB 파일** to export.

## Explicit limits
- This is NOT schematic capture and does not know the electrical correctness of the intended connections.
- Pad nets are inferred only from existing manual tracks. No external netlist import or electrical rule checking.
- Generic footprints are illustrative, not actual manufacturer-verified footprints.
- Wires are straight, F.Cu-only; no copper zones, vias, multilayer routing, differential pairs, constraints or automatic routers.
- Local geometric clearance checks are deliberately limited and NOT KiCad's official DRC.
- KiCad 9 export follows public S-expression structure but has **not** been opened or validated with the KiCad executable; treat it as a draft.
- **Do not fabricate** PCB boards or energize attached electronics without independent schematic, footprint, voltage/current, safety, ERC and DRC verification.
- Render hosting here uses a static site: no account, secure cloud board storage, or real KiCad worker. Board edits remain in the local browser storage.

## Source
- `public/workspace/pcb-studio.js` board editor, geometry and file generation
- `public/workspace/pcb-studio.css` board editor styles
- `public/workspace/index.html` integrated PCB tab and inspector

## KiCad format reference
https://dev-docs.kicad.org/en/file-formats/sexpr-pcb/index.html

## Local automated checks completed
- Script parsing, HTML/CSS asset links and unique ids
- Default board geometry and connections
- Component insertion, pad-to-pad routing, net grouping, trace rendering
- KiCad S-expression bracket balance and footprint/track counts
- SVG/JSON generation
- Board resize, trace + placement undo, local-save persistence
- Drag movement and per-project separation
- Simple overlap and crossing-warning cases
- **Not yet completed**: real browser network E2E, KiCad official ERC/DRC, hardware test
