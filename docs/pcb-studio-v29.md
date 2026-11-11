# Robot Forge PCB Studio v2.9 — KiCad 원본 패드 규격 + 회로도↔PCB 정합성

작업 화면: https://robot-forge-ui-preview.onrender.com/workspace/

## 구현 내용

1. **실제 KiCad 라이브러리 패드 정보 6종**: `KiCad/kicad-footprints` 공식 저장소의 `.kicad_mod` 원본에서 패드 번호, 모양(circle/rect/oval), 패드 크기, 드릴 지름, 중심에서 상대적 위치를 추출하여 `pcb-pad-library.js`에 추가했습니다. 출처 경로와 해당 원본 blob SHA도 포함합니다.
2. 기존의 단순 원형 패드 대신, 라이브러리 프로필을 선택한 경우 **실제 패드 모양·크기·드릴 규격을 2D 기판과 `.kicad_pcb` 내보내기에 적용**합니다. 원본 라이브러리의 패드 좌표는 브라우저 작업용 부품 중심 좌표로 변환했습니다.
3. **독립 회로도↔PCB 핀/넷 비교**: 등록된 논리 신호와 실제 PCB 구리 연결 그룹을 대조합니다. 빠진 연결(Open), 서로 다른 신호의 의도하지 않은 합선(Short), 잘못된/누락된 패드, 공식 출처 패드 위치 불일치를 보고합니다. 이때 검증이 되지 않은 사용자 배선은 통과 처리하지 않습니다.
4. 새 **PCB 파일 → 회로도↔PCB 핀·넷 비교 보고서 JSON**은 기대 신호 및 핀, PCB 구리 연결 그룹, 원본 패드 메타데이터와 추적용 SHA, 모든 로컬 오류와 경고를 기록합니다.
5. GitHub Actions에는 **KiCad가 실제 추출한 회로도 XML 넷리스트와 `.kicad_pcb` 파일의 핀/신호/패드 규격을 직접 비교하는 Python 검사** `scripts/verify-kicad-parity.py`를 연결했습니다. 독립 검사기의 정상/잘못된 넷/드릴/신호 이름 케이스도 `scripts/test-kicad-parity.py`로 테스트합니다.
6. 기존 실험적인 `.kicad_sch`, 기판 `.kicad_pcb`, ERC/DRC 및 조건부 진단용 Gerber GitHub Actions 기능을 유지합니다.

## 원본 출처 (파일 / GitHub 원본)

- `Resistor_THT.pretty/R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal.kicad_mod`
- `LED_THT.pretty/LED_D5.0mm.kicad_mod`
- `Capacitor_THT.pretty/C_Disc_D5.1mm_W3.2mm_P5.00mm.kicad_mod`
- `Connector_PinHeader_2.54mm.pretty/PinHeader_1x02_P2.54mm_Vertical.kicad_mod`
- `Connector_PinHeader_2.54mm.pretty/PinHeader_1x03_P2.54mm_Vertical.kicad_mod`
- `Package_DIP.pretty/DIP-4_W7.62mm.kicad_mod`

원본 저장소: https://github.com/KiCad/kicad-footprints

**중요:** 이 단계에서 가져온 것은 실제 원본의 **패드 메타데이터**뿐입니다. 실크스크린·코트야드·구조선·전체 3D 모델 등 **전체 공식 풋프린트 데이터를 가져온 것은 아닙니다.** 일부 후보는 오래된 라이브러리 리비전 기준이며, 실제 부품의 최신 데이터시트와 대조해야 합니다. 원본을 그대로 복제하거나 제조사가 검증한 부품으로 오인하지 마세요.

## 자동 검증 명령

```bash
node scripts/test-pcb-v26.cjs
python3 scripts/test-kicad-parity.py
OUTPUT_DIR=/tmp/robot-forge-draft node scripts/test-pcb-v26.cjs
kicad-cli sch export netlist --format kicadxml \
  -o /tmp/robot-forge-draft/parsed-schematic.xml \
  /tmp/robot-forge-draft/robot-forge-draft.kicad_sch
python3 scripts/verify-kicad-parity.py \
  --manifest /tmp/robot-forge-draft/robot-forge-parity.json \
  --pcb /tmp/robot-forge-draft/robot-forge-demo.kicad_pcb \
  --schematic-xml /tmp/robot-forge-draft/parsed-schematic.xml \
  --report /tmp/robot-forge-draft/ki-cad-file-parity.json
```

KiCad 독립 검사에서는 XML 신호/핀과 PCB 패드의 연결명 및 원본 패드 크기·드릴 지름을 대조합니다. **로컬 설계의 미배선·쇼트**도 별도로 보고하되, 파일 구조 정합성과 전기적 회로 완성 여부를 혼동하지 않습니다. CLI를 설치하지 않은 환경에서는 Python 테스트만 실행할 수 있습니다.

## 검증·제조 상태

- Node.js PCB 회귀 테스트: **50/50 통과** (브라우저 모의 환경 / KiCad CLI 아님)
- KiCad CLI 실제 파싱 및 독립 XML vs PCB 파일 비교: **실행 결과 확인 필요**
- KiCad 공식 ERC, DRC, 실물 부품 데이터시트, 완전한 라이브러리 풋프린트 검증: **미확인/미완료**
- 자동 생성 예제의 일부 의도적 미배선: 데이터에서 **Open 오류**로 기록
- 생산용 Gerber 제조 승인: **차단**; 오직 조건을 충족한 경우에만 CI 진단용 미리보기 파일을 생성

정확한 하드웨어 제조를 원한다면 반드시 실제 KiCad 라이브러리 업데이트, 부품 제조사 핀맵 검토, 전원/보호회로 설계, ERC·DRC, 제작 사양 검증, 인간 승인 절차를 추가해야 합니다.

공식 파일 형식: https://dev-docs.kicad.org/en/file-formats/sexpr-footprint/index.html

공식 CLI: https://docs.kicad.org/9.0/en/cli/cli.html
