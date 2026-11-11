#!/usr/bin/env python3
"""Robot Forge: compare a KiCad 9 XML schematic netlist with a .kicad_pcb draft.

This intentionally does NOT approve manufacturing, electrical safety, or real
footprint library compliance. The footprint pad specs are reference-only,
centered data captured from KiCad/kicad-footprints source. A real library
footprint graphics/pad origin import is still required for fabrication.

Usage: python3 scripts/verify-kicad-parity.py --manifest design-parity.json
       --pcb board.kicad_pcb --schematic-xml extracted.kicadxml
       --report parity-report.json
"""
from __future__ import annotations
import argparse
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

def forms(source: str, keyword: str) -> list[str]:
    """Extract balanced S-expression forms starting with a named token."""
    result = []
    pattern = re.compile(r"\(" + re.escape(keyword) + r"(?=[\s(])")
    pos = 0
    while True:
        match = pattern.search(source, pos)
        if not match:
            break
        start = match.start()
        depth, quoted, escaped = 0, False, False
        end = len(source)
        for i in range(start, len(source)):
            ch = source[i]
            if escaped:
                escaped = False
            elif quoted:
                if ch == "\\":
                    escaped = True
                elif ch == '"':
                    quoted = False
            elif ch == '"':
                quoted = True
            elif ch == "(":
                depth += 1
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        if depth != 0 or quoted:
            raise ValueError("Unbalanced KiCad S-expression near " + keyword)
        result.append(source[start:end])
        pos = end
    return result

def board_pads(text: str) -> dict[str, dict]:
    items: dict[str, dict] = {}
    for footprint in forms(text, "footprint"):
        ref_match = re.search(r'\(property\s+"Reference"\s+"([^"]+)"', footprint)
        if not ref_match:
            raise ValueError("A PCB footprint lacks a Reference property")
        ref = ref_match.group(1)
        for pad in forms(footprint, "pad"):
            pin = re.match(r'\(pad\s+"?(\d+)"?\s+thru_hole\s+(circle|oval|rect)', pad)
            at = re.search(r"\(at\s+(-?[\d.]+)\s+(-?[\d.]+)", pad)
            size = re.search(r"\(size\s+([\d.]+)\s+([\d.]+)", pad)
            drill = re.search(r"\(drill\s+([\d.]+)", pad)
            net = re.search(r'\(net\s+(\d+)(?:\s+"([^"]*)")?', pad)
            if not (pin and at and size and drill and net):
                raise ValueError("Cannot parse a through-hole pad in " + ref)
            key = ref + ":" + pin.group(1)
            if key in items:
                raise ValueError("Duplicate PCB pad reference " + key)
            items[key] = {
                "shape": pin.group(2), "offset": [float(at.group(1)), float(at.group(2))],
                "size": [float(size.group(1)), float(size.group(2))],
                "drill": float(drill.group(1)), "net": net.group(2) or "",
            }
    return items

def schematic_xml_nets(path: Path) -> dict[str, set[str]]:
    tree = ET.parse(path)
    root = tree.getroot()
    container = root.find("nets")
    if container is None:
        raise ValueError("KiCad XML netlist has no <nets> element")
    nets: dict[str, set[str]] = {}
    for net in container.findall("net"):
        name = net.attrib.get("name", "")
        nodes = {node.attrib["ref"] + ":" + node.attrib["pin"]
                 for node in net.findall("node")
                 if "ref" in node.attrib and "pin" in node.attrib}
        if name:
            nets.setdefault(name, set()).update(nodes)
    return nets

def compare(manifest: dict, pcb_text: str, xml_nets: dict[str, set[str]]) -> dict:
    mismatches, findings = [], []
    declared_nets = manifest["schematic"]["logicalNets"]
    expected = {n["name"]: set(n["pins"]) for n in declared_nets}
    pin_to_net = {pin: name for name, pins in expected.items() for pin in pins}
    parsed_pads = board_pads(pcb_text)
    listed_pads = set(manifest["pcb"]["pads"])
    if set(parsed_pads) != listed_pads:
        missing = sorted(listed_pads - set(parsed_pads))
        extra = sorted(set(parsed_pads) - listed_pads)
        mismatches.append(f"PCB pad set mismatch: missing={missing}, extra={extra}")
    for name, pins in expected.items():
        found = xml_nets.get(name)
        if found is None:
            mismatches.append(f"Schematic XML lacks declared net {name}")
        elif found != pins:
            mismatches.append(f"Schematic XML {name}: expected {sorted(pins)}, found {sorted(found)}")
    for pin, name in pin_to_net.items():
        if pin in parsed_pads and parsed_pads[pin]["net"] != name:
            mismatches.append(f"PCB net name for {pin}: expected {name}, found {parsed_pads[pin]['net']}")
    for footprint in manifest["comparison"]["details"]:
        ref = footprint["ref"]
        for spec in footprint.get("padDefinitions", []):
            pin = ref + ":" + str(spec["pin"])
            got = parsed_pads.get(pin)
            if got is None:
                continue
            for attr in ("shape",):
                if got[attr] != spec[attr]:
                    mismatches.append(f"{pin} {attr}: {got[attr]} instead of {spec[attr]}")
            for attr in ("size", "drill", "offset"):
                actual, target = got[attr], spec[attr]
                actual_numbers = actual if isinstance(actual, list) else [actual]
                target_numbers = target if isinstance(target, list) else [target]
                if len(actual_numbers) != len(target_numbers) or any(abs(a-b)>0.0005 for a,b in zip(actual_numbers,target_numbers)):
                    mismatches.append(f"{pin} {attr}: {actual} instead of {target}")
    local = manifest["comparison"]
    if local["errors"]:
        findings.extend(local["errors"])
    if local["warnings"]:
        findings.extend(local["warnings"])
    if not manifest.get("manufacturerVerified", False):
        findings.append("Real part manufacturer and complete KiCad footprint graphics remain unverified.")
    return {
        "format":"RobotForgeKiCadFileParity",
        "version":1,
        "fileIntegrityPassed":not mismatches,
        "fileMismatches":mismatches,
        "designFindings":findings,
        "extractedSchematicNetCount":len(xml_nets),
        "declaredNetCount":len(expected),
        "parsedPcbPadCount":len(parsed_pads),
        "officialErcPassed":False,
        "officialDrcPassed":False,
        "fabricationApproval":"BLOCKED"
    }

def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--manifest",type=Path,required=True)
    p.add_argument("--pcb",type=Path,required=True)
    p.add_argument("--schematic-xml",type=Path,required=True)
    p.add_argument("--report",type=Path,required=True)
    p.add_argument("--strict-design",action="store_true")
    args=p.parse_args()
    try:
        manifest=json.loads(args.manifest.read_text("utf-8"))
        result=compare(manifest,args.pcb.read_text("utf-8"),schematic_xml_nets(args.schematic_xml))
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n","utf-8")
    except (OSError,ET.ParseError,ValueError,KeyError,TypeError) as exc:
        print("KiCad parity extraction failed: "+str(exc),file=sys.stderr)
        return 3
    print(f"KiCad file parity: {'PASS' if result['fileIntegrityPassed'] else 'FAIL'}; "
          f"issues={len(result['fileMismatches'])}; "
          f"design findings={len(result['designFindings'])}")
    if not result["fileIntegrityPassed"]:
        for issue in result["fileMismatches"][:12]:print(" • "+issue,file=sys.stderr)
        return 2
    if args.strict_design and result["designFindings"]:
        return 4
    return 0

if __name__=="__main__":
    raise SystemExit(main())
