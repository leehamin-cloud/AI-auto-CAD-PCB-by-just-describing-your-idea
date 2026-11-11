/* Robot Forge precise pad metadata v2.9.
  Extracted from KiCad/kicad-footprints publicly available upstream .kicad_mod files,
  with pad positions recentered around their axis-aligned pad centroid.
  These are authentic PAD specifications, NOT full verified footprint graphics.
  Attribution: KiCad footprint library, https://github.com/KiCad/kicad-footprints.
  Check library upstream license before redistribution/production. */
(function(scope) {
"use strict";
const models={
  "resistor": {
    "sourcePath": "Resistor_THT.pretty/R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal.kicad_mod",
    "sourceBlobSha": "146d32eb1a0008cd76a090869545f9605346be04",
    "sourceRepository": "KiCad/kicad-footprints",
    "fullFootprintImported": false,
    "pads": [
      {
        "pin": 1,
        "shape": "circle",
        "x": -3.81,
        "y": 0,
        "size": [
          1.6,
          1.6
        ],
        "drill": 0.8
      },
      {
        "pin": 2,
        "shape": "oval",
        "x": 3.81,
        "y": 0,
        "size": [
          1.6,
          1.6
        ],
        "drill": 0.8
      }
    ]
  },
  "led": {
    "sourcePath": "LED_THT.pretty/LED_D5.0mm.kicad_mod",
    "sourceBlobSha": "f43d32e29e45454a9a0f99b8834179ac9f42d403",
    "sourceRepository": "KiCad/kicad-footprints",
    "fullFootprintImported": false,
    "pads": [
      {
        "pin": 1,
        "shape": "rect",
        "x": -1.27,
        "y": 0,
        "size": [
          1.8,
          1.8
        ],
        "drill": 0.9
      },
      {
        "pin": 2,
        "shape": "circle",
        "x": 1.27,
        "y": 0,
        "size": [
          1.8,
          1.8
        ],
        "drill": 0.9
      }
    ]
  },
  "capacitor": {
    "sourcePath": "Capacitor_THT.pretty/C_Disc_D5.1mm_W3.2mm_P5.00mm.kicad_mod",
    "sourceBlobSha": "a24487df17efbd6bd63ecdecc8f51ad14680d57a",
    "sourceRepository": "KiCad/kicad-footprints",
    "fullFootprintImported": false,
    "pads": [
      {
        "pin": 1,
        "shape": "circle",
        "x": -2.5,
        "y": 0,
        "size": [
          1.6,
          1.6
        ],
        "drill": 0.8
      },
      {
        "pin": 2,
        "shape": "circle",
        "x": 2.5,
        "y": 0,
        "size": [
          1.6,
          1.6
        ],
        "drill": 0.8
      }
    ]
  },
  "conn2": {
    "sourcePath": "Connector_PinHeader_2.54mm.pretty/PinHeader_1x02_P2.54mm_Vertical.kicad_mod",
    "sourceBlobSha": "60d48feaf9b995f0ea82391e1a7f382cf35525b3",
    "sourceRepository": "KiCad/kicad-footprints",
    "fullFootprintImported": false,
    "pads": [
      {
        "pin": 1,
        "shape": "rect",
        "x": 0,
        "y": -1.27,
        "size": [
          1.7,
          1.7
        ],
        "drill": 1
      },
      {
        "pin": 2,
        "shape": "oval",
        "x": 0,
        "y": 1.27,
        "size": [
          1.7,
          1.7
        ],
        "drill": 1
      }
    ]
  },
  "conn3": {
    "sourcePath": "Connector_PinHeader_2.54mm.pretty/PinHeader_1x03_P2.54mm_Vertical.kicad_mod",
    "sourceBlobSha": "f0d3415a014d7367b2e37203d9a899fb6aff4e3e",
    "sourceRepository": "KiCad/kicad-footprints",
    "fullFootprintImported": false,
    "pads": [
      {
        "pin": 1,
        "shape": "rect",
        "x": 0,
        "y": -2.54,
        "size": [
          1.7,
          1.7
        ],
        "drill": 1
      },
      {
        "pin": 2,
        "shape": "oval",
        "x": 0,
        "y": 0,
        "size": [
          1.7,
          1.7
        ],
        "drill": 1
      },
      {
        "pin": 3,
        "shape": "oval",
        "x": 0,
        "y": 2.54,
        "size": [
          1.7,
          1.7
        ],
        "drill": 1
      }
    ]
  },
  "ic4": {
    "sourcePath": "Package_DIP.pretty/DIP-4_W7.62mm.kicad_mod",
    "sourceBlobSha": "bf01207cc790e0f82048b60179cf84e204ceeebb",
    "sourceRepository": "KiCad/kicad-footprints",
    "fullFootprintImported": false,
    "pads": [
      {
        "pin": 1,
        "shape": "rect",
        "x": -3.81,
        "y": -1.27,
        "size": [
          1.6,
          1.6
        ],
        "drill": 0.8
      },
      {
        "pin": 2,
        "shape": "oval",
        "x": -3.81,
        "y": 1.27,
        "size": [
          1.6,
          1.6
        ],
        "drill": 0.8
      },
      {
        "pin": 3,
        "shape": "oval",
        "x": 3.81,
        "y": 1.27,
        "size": [
          1.6,
          1.6
        ],
        "drill": 0.8
      },
      {
        "pin": 4,
        "shape": "oval",
        "x": 3.81,
        "y": -1.27,
        "size": [
          1.6,
          1.6
        ],
        "drill": 0.8
      }
    ]
  }
};
function get(component){
 if(!component||!scope.robotForgePartCatalog)return null;
 const profile=scope.robotForgePartCatalog.get(component);
 return profile?models[component.kind]||null:null;
}
function pads(component){
 const info=get(component);
 return info?info.pads.map(p=>({...p,size:p.size.slice()})):null;
}
function verify(component){
 const selected=get(component),expected=scope.robotForgePartCatalog?.get(component);
 if(!selected||!expected)return {selected:false,exactPadDefinitions:false,fullFootprint:false};
 const same=expected.padPositions.length===selected.pads.length&&expected.padPositions.every((p,i)=>
   Math.abs(p[0]-selected.pads[i].x)<0.0001&&Math.abs(p[1]-selected.pads[i].y)<0.0001);
 return {selected:true,exactPadDefinitions:same,fullFootprint:false,originRecentered:true,source: selected.sourcePath};
}
scope.robotForgeFootprintPads={models,get,pads,verify};
})(typeof window!=="undefined"?window:this);
