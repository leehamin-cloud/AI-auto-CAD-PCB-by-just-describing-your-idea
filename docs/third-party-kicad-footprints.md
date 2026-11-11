# Third-party notice: KiCad footprint library reference data

## Upstream
- Project: **KiCad/kicad-footprints**
- Source: https://github.com/KiCad/kicad-footprints
- Library license: **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0), with the special exception described by KiCad**
- Original library license notice: https://github.com/KiCad/kicad-footprints/blob/master/LICENSE.md
- License legal code: https://creativecommons.org/licenses/by-sa/4.0/legalcode

## Reference geometry and attribution
Robot Forge's browser PCB preview contains transformed portions of pad and footprint reference geometry from these six upstream files:

- `Resistor_THT.pretty/R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal.kicad_mod`
- `LED_THT.pretty/LED_D5.0mm.kicad_mod`
- `Capacitor_THT.pretty/C_Disc_D5.1mm_W3.2mm_P5.00mm.kicad_mod`
- `Connector_PinHeader_2.54mm.pretty/PinHeader_1x02_P2.54mm_Vertical.kicad_mod`
- `Connector_PinHeader_2.54mm.pretty/PinHeader_1x03_P2.54mm_Vertical.kicad_mod`
- `Package_DIP.pretty/DIP-4_W7.62mm.kicad_mod`

The transformation recenters original pad coordinates around a bounding-pad centroid, transcribes pad sizes/shapes/drills, and approximates some legacy `fp_arc` primitives with polyline segments. Source blob hashes are recorded in `public/workspace/pcb-pad-library.js` and `public/workspace/pcb-footprint-graphics.js`. The official original full KiCad footprint libraries are **not** bundled as `.pretty` libraries or represented as imported complete exact KiCad footprints.

To the extent these extracted reference-data collections are redistributed library adaptations, review the applicable CC BY-SA 4.0 attribution and share-alike requirements before commercial redistribution or broader distribution. KiCad's exception explains that electronic designs produced *using* the libraries are not necessarily required to adopt the same license; redistribution of adapted library collections is a distinct case.

Source materials are provided without warranty, as stated in KiCad's library license. This notice does not replace a legal license review and does not certify the footprint data for manufacture.

## Revision and drift
`scripts/check-kicad-upstream-v31.cjs` checks that cached source hashes are internally consistent and can compare them with GitHub's current upstream blobs. Upstream changes are not applied silently.
