#!/usr/bin/env python3
"""Unit checks for the independent KiCad XML/PCB S-expression comparator."""
from __future__ import annotations
import importlib.util
import pathlib
import tempfile
import xml.etree.ElementTree as ET

HERE=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("rf_parity",HERE/"verify-kicad-parity.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

BOARD='''(kicad_pcb
 (footprint "LED_THT:LED_D5.0mm" (layer "F.Cu") (at 50 40)
  (property "Reference" "D1" (at 0 -4))
  (pad "1" thru_hole rect (at -1.27 0) (size 1.8 1.8) (drill 0.9)
    (layers "*.Cu" "*.Mask") (net 1 "VCC"))
  (pad "2" thru_hole circle (at 1.27 0) (size 1.8 1.8) (drill 0.9)
    (layers "*.Cu" "*.Mask") (net 0 ""))
 )
)'''
XML='''<?xml version="1.0"?>
<export><nets><net code="1" name="VCC"><node ref="D1" pin="1"/></net></nets></export>'''
MANIFEST={
 "schematic":{"logicalNets":[{"name":"VCC","pins":["D1:1"]}]},
 "pcb":{"pads":["D1:1","D1:2"]},
 "comparison":{"errors":[],"warnings":[],"details":[{
  "ref":"D1",
  "padDefinitions":[
   {"pin":1,"shape":"rect","offset":[-1.27,0],"size":[1.8,1.8],"drill":0.9},
   {"pin":2,"shape":"circle","offset":[1.27,0],"size":[1.8,1.8],"drill":0.9}
  ]
 }]},
 "manufacturerVerified":False
}
with tempfile.TemporaryDirectory() as temp:
    path=pathlib.Path(temp)/"net.xml"
    path.write_text(XML,"utf-8")
    nets=mod.schematic_xml_nets(path)
    assert nets=={"VCC":{"D1:1"}},nets
    assert len(mod.board_pads(BOARD))==2
    good=mod.compare(MANIFEST,BOARD,nets)
    assert good["fileIntegrityPassed"],good["fileMismatches"]
    assert good["fabricationApproval"]=="BLOCKED"
    bad_nets=mod.compare(MANIFEST,BOARD,{"VCC":{"D1:2"}})
    assert not bad_nets["fileIntegrityPassed"]
    assert any("Schematic XML VCC" in x for x in bad_nets["fileMismatches"])
    wrong_hole=mod.compare(MANIFEST,BOARD.replace("(drill 0.9)","(drill 1.1)",1),nets)
    assert not wrong_hole["fileIntegrityPassed"]
    assert any("D1:1 drill" in x for x in wrong_hole["fileMismatches"])
    wrong_net=mod.compare(MANIFEST,BOARD.replace('(net 1 "VCC")','(net 1 "GND")'),nets)
    assert not wrong_net["fileIntegrityPassed"]
    assert any("PCB net name" in x for x in wrong_net["fileMismatches"])
print("Independent KiCad file parity checks: 5/5 passed")
