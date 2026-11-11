# Robot Forge PCB Studio v2.8 — KiCad 회로도 초안 및 공식 검증 파이프라인

접속: https://robot-forge-ui-preview.onrender.com/workspace/

## 구현한 새 기능
- PCB 설계 화면의 **PCB 파일** 메뉴에서 **KiCad 회로도 .kicad_sch · 실험적 생성** 선택
- 브라우저에서 KiCad 9 회로도 S-expression 구조 생성: `(kicad_sch ...)`, 임베디드 심벌 정의, 부품 인스턴스, UUID, 핀, 연결선, 넷 라벨, 루트 `sheet_instances`
- 기존 논리 연결 계획의 VCC/GND/DATA 등 같은 이름의 핀을 동일한 회로도 네트 라벨로 출력
- 브라우저에서 정한 핀 역할을 간소화 심벌의 KiCad 핀 타입에 반영
- 부품에 사용자가 선택한 KiCad 풋프린트 후보 이름을 회로도 필드에 저장
- **검증 체크리스트 JSON**: 브라우저 오픈/쇼트·핀 규칙·배치 오류와 함께, KiCad 공식 검증 및 제조사 검증은 미완료로 명시. 제조 승인 상태는 항상 `BLOCKED_FOR_MANUFACTURING`.

## 생성 파일
| 메뉴 | 확장자 | 의미 |
|---|---|---|
| KiCad 회로도 · 실험적 생성 | `.kicad_sch` | 일반화된 심벌, 라벨, 배치가 들어 있는 회로도 초안 |
| KiCad PCB · 미검증 초안 | `.kicad_pcb` | 브라우저 PCB에서 생성한 제한적 단면 기판 초안 |
| 넷리스트 | `.netlist.json` | 사용자 정의 논리 연결 정보 |
| 검증 체크리스트 | `.validation.json` | 현재 브라우저 검사 결과와 미검증 상태 |
| SVG | `.svg` | 기판·심벌의 이미지 |

## 공식 KiCad CLI 검증 (GitHub Actions)
`.github/workflows/robot-forge-pcb.yml`은 다음 순서를 실행하도록 수정했습니다.

1. `node scripts/test-pcb-v26.cjs` 회귀 검사
2. `OUTPUT_DIR=... node scripts/test-pcb-v26.cjs`로 같은 논리 연결 예제에서 `.kicad_sch`, `.kicad_pcb` 생성
3. `kicad-cli sch export netlist`: KiCad가 생성된 회로도를 해석하고 네트리스트를 추출할 수 있는지 검증
4. `kicad-cli sch export svg`: KiCad가 심벌을 렌더링할 수 있는지 검증
5. `kicad-cli sch erc --format json --severity-all --exit-code-violations`: 공식 회로도 ERC 보고서 생성
6. `kicad-cli pcb export svg`: 기판 파일의 KiCad 파싱 확인
7. `kicad-cli pcb drc --format json --severity-all --exit-code-violations`: 공식 PCB DRC 보고서 생성
8. ERC·DRC 모두 오류가 0일 경우에만 **진단용** Gerber 및 Excellon 드릴 파일 생성. `NOT_FOR_MANUFACTURING.txt`도 함께 저장
9. 모든 결과를 워크플로 Artifacts로 업로드. ERC 또는 DRC 문제 발견 시 CI가 실패 상태로 종료됩니다.

자동화 파일을 작성했다는 사실은 CLI 검증 성공과 다릅니다. **KiCad GitHub Actions 실제 실행 결과가 확인되기 전까지 ERC/DRC를 통과했다고 주장할 수 없습니다.**

## 한계
- KiCad 실제 내장 심벌 라이브러리가 아니라 브라우저가 생성한 사각형 기본 심벌을 포함합니다.
- 부품 이름과 참고 핀 간격만 연결했습니다. 실제 부품 데이터시트, 실크, 코트야드, 3D 모델, 부품별 핀맵과 공식 라이브러리 형상은 미검증입니다.
- 단일 A4 회로도 페이지로 최대 24개 부품을 내보내는 실험 기능입니다.
- 회로도 넷리스트와 기판 트랙의 공식 KiCad parity 비교, 실부품 전기 규칙, 실제 회로 시뮬레이션은 아직 지원하지 않습니다.
- Gerber는 브라우저에서 직접 제공하지 않습니다. CI를 통과한 예제의 진단 파일만 대상으로 하며, **제조 발주용으로 제공하지 않습니다.**
- 프로젝트 파일/데이터는 각 브라우저 로컬 저장 중심입니다. 저장용 JSON 백업을 사용하세요.

## 테스트
`node scripts/test-pcb-v26.cjs`의 내부 테스트 **39/39개 통과** (KiCad CLI가 아닌 Node.js 기반 테스트). GitHub Actions 최종 상태는 별도 확인해야 합니다.

## 공식 근거
- https://dev-docs.kicad.org/en/file-formats/sexpr-schematic/
- https://docs.kicad.org/9.0/en/cli/cli.html
