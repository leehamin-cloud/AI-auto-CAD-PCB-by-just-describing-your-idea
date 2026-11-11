# Robot Forge PCB Studio v2.7 — 심벌 회로도·핀 기능·KiCad 풋프린트 참고 규격

사이트: https://robot-forge-ui-preview.onrender.com/workspace/

## 이번에 구현한 것
기존 PCB 배치·배선 기능 및 논리 연결 계획(v2.6)을 유지하면서 다음 기능을 추가했습니다.

- PCB 편집기의 **◇ 심벌 회로도**: 저항, LED, 커패시터, 핀 헤더, 4핀 IC를 간단한 SVG 심벌과 핀/신호 이름으로 표시. 이는 실제 KiCad 스키매틱(.kicad_sch)이 아닌 교육용 개념도입니다.
- 선택 부품의 **부품 규격·핀 역할** 패널: KiCad 라이브러리 후보를 적용하면 브라우저 초안에서 패드 간격/바디 외형에 대응하는 **간소화된** 모델로 변경. 되돌리기 지원.
- 핀 역할: 미지정 / 수동 / 입력 / 출력 / 전원 입력 / 전원 공급. 사용자가 지정한 역할은 프로젝트 JSON에 저장.
- 보조 전기 규칙: 하나의 논리 신호에 두 개 이상의 전원 출력, 여러 개의 일반 출력, 전원 공급원을 명시하지 않은 전원 입력, 구동원을 표시하지 않은 입력, LED K/A 동일 신호를 탐지.
- 기판 배선(실제 구리 트랙)과 논리 넷리스트는 기존처럼 분리되며 **PCB 오픈·쇼트 검사**와 함께 표시.
- **심벌 회로도 SVG** 내보내기. 기존 기판 SVG, JSON, 논리 넷리스트 JSON, KiCad PCB **미검증 초안** 내보내기 유지.

## 실제 KiCad 라이브러리 후보(이름·기본 피치)
| 편집기 부품 | KiCad 풋프린트 후보 | 간소 모델 패드 간격 |
|---|---|---|
| 저항 | `Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal` | 7.62 mm |
| LED | `LED_THT:LED_D5.0mm` | 2.54 mm |
| 세라믹 커패시터 | `Capacitor_THT:C_Disc_D5.1mm_W3.2mm_P5.00mm` | 5.00 mm |
| 2핀 헤더 | `Connector_PinHeader_2.54mm:PinHeader_1x02_P2.54mm_Vertical` | 2.54 mm |
| 3핀 헤더 | `Connector_PinHeader_2.54mm:PinHeader_1x03_P2.54mm_Vertical` | 2.54 mm |
| 4핀 DIP 패키지 | `Package_DIP:DIP-4_W7.62mm` | 7.62 mm 행 간격 · 2.54 mm 핀 간격 |

**주의:** KiCad 라이브러리에서 풋프린트 식별자와 대표 피치를 확인한 *참고 후보*입니다. 실제 라이브러리의 원점, 패드 모양/크기, 실크스크린, 코트야드, 3D 모델 및 제조사 핀 호환성을 그대로 가져온 것이 아닙니다. 웹사이트의 내보내기는 여전히 자체 생성한 간소 풋프린트 초안입니다. 부품 구매·제조 전에 KiCad에서 반드시 공식 풋프린트로 교체/갱신·검증해야 합니다.

## 로컬에서 사용하기
1. **PCB 설계** 탭에서 부품을 배치합니다.
2. **◇ 심벌 회로도** 탭을 열어 핀 번호와 신호 이름을 확인합니다.
3. **⌁ 연결 계획**에 실제 연결해야 할 핀과 신호 이름을 지정합니다.
4. **▦ 기판 배치**에서 패드를 배선합니다.
5. 부품을 클릭한 후 **부품 규격·핀 역할**을 열어 KiCad 참고 규격이나 핀 역할을 지정할 수 있습니다.
6. **설계 초안 검사**에서 미배선, 쇼트, 배치 간격, 보조 전기 규칙 경고를 확인합니다.
7. 데이터 손실을 방지하려면 PCB JSON으로 백업하고, KiCad에서 별도 검증합니다.

## 자동 검사
```bash
node scripts/test-pcb-v26.cjs
OUTPUT_DIR=/tmp/rf-pcb node scripts/test-pcb-v26.cjs
```
28개 회귀 시나리오에 PCB v2.7 모듈 로드, 심벌 표시, 프로필 선택, 간격, 핀 기능, 자동 배선 경고, 내보내기 등을 포함합니다.
GitHub Actions: `.github/workflows/robot-forge-pcb.yml` (KiCad 9 CLI로 예제 PCB 파싱 시도 및 공식 PCB DRC 실행). 실행 결과는 GitHub Actions 화면에서 별도로 확인해야 합니다.

## 구현하지 않았거나 검증하지 않은 범위
- 진짜 KiCad 회로도(.kicad_sch)·심벌/풋프린트 실물 라이브러리 동기화
- 부품 데이터시트에 기반한 핀 기능 자동 지정
- SPICE/전압·전류/전력 계산, PCB 3D/고급 자동 배선
- KiCad 공식 스키매틱 ERC / 실제 제조에 필요한 KiCad PCB DRC 통과 결과
- Gerber 등 제조 승인 패키지

이 시스템은 취미·학습용 CAD/PCB 설계 초안입니다. 기본 툴에서 **충돌이 발견되지 않았다는 결과가 안전하거나 제조 가능한 설계임을 뜻하지는 않습니다.**

## KiCad 자료
- https://kicad.github.io/footprints/Resistor_THT.html
- https://kicad.github.io/footprints/LED_THT.html
- https://kicad.github.io/footprints/Capacitor_THT.html
- https://kicad.github.io/footprints/Connector_PinHeader_2.54mm.html
- https://kicad.github.io/footprints/Package_DIP.html
- https://www.kicad.org/discover/schematic-capture/
