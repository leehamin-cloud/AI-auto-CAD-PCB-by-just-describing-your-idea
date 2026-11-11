# Robot Forge PCB Studio v2.6 — 논리 연결 계획 + PCB 배선 검증

웹사이트: https://robot-forge-ui-preview.onrender.com/workspace/

## 기능
- **PCB 설계** → **연결 계획** 화면에서 핀 A·핀 B와 신호 이름을 등록합니다.
- 한 신호에 세 개 이상의 핀을 할당하려면 같은 신호 이름으로 다른 핀을 추가하세요.
- **기판 배치** 화면에서 필수 연결 중 아직 배선되지 않은 부분을 파란 점선으로 표시합니다.
- 각각의 논리 신호가 모두 구리 배선으로 연결됐는지(오픈) 확인합니다.
- 서로 다른 신호가 같은 구리 연결 그룹으로 합쳐졌는지(쇼트) 확인합니다.
- 이미 서로 다른 신호로 지정된 두 패드의 직접 배선은 차단합니다.
- 기판 JSON, SVG, 논리 넷리스트 JSON, 미검증 KiCad PCB 초안으로 내보냅니다.
- 현재 설계와 연결 계획은 브라우저 로컬 저장이며, 기존 v2.5 초안도 불러올 수 있습니다.

## 초기 사용 순서
1. PCB 설계 탭을 선택합니다.
2. **예시 회로 연결 불러오기**를 눌러 기본 보드의 4개 논리 신호를 추가해보세요.
3. 기판 배치로 돌아가 파란 점선이 표시된 핀 사이를 연결합니다.
4. **설계 초안 검사**를 눌러 미배선/합선·단순 거리 및 교차 경고를 확인합니다.
5. PCB 파일에서 넷리스트/기판 파일을 저장합니다.

## 설계 데이터
```json
{
  "format": "RobotForgePCB",
  "version": 1,
  "width": 100,
  "height": 70,
  "components": [],
  "traces": [],
  "schematic": {
    "nets": [
      {"name": "DATA", "pins": ["J1:3", "U1:2"]}
    ]
  }
}
```

여기의 `schematic`은 **논리적 핀 연결 계획**이지 KiCad 회로도(.kicad_sch)가 아닙니다.
전원 전압, 극성, 전류 용량, 저항값, 실제 핀 번호 및 전기적 적합성은 검증되지 않습니다.
예시의 VCC/GND/DATA/LED_CTRL 신호도 **실제 전자회로가 아닌 연습용 가상 연결**입니다.

## 자동 테스트
```bash
node scripts/test-pcb-v26.cjs
OUTPUT_DIR=/tmp/rf-pcb node scripts/test-pcb-v26.cjs
```

- 논리 연결 요구사항, 오픈/쇼트, 배선 차단, 잘못된 핀 중복, 이전 버전 호환성, KiCad 초안 내보내기를 테스트합니다.
- GitHub Actions 파일: `.github/workflows/robot-forge-pcb.yml`.
- 워크플로의 KiCad 9 단계는 예제 파일을 생성하고 `kicad-cli pcb export svg`로 파싱을 시도하며, `kicad-cli pcb drc --format json --severity-all --exit-code-violations`를 실행합니다.
- 기하/연결의 로컬 회귀 테스트 통과와 KiCad 공식 DRC 통과는 별개입니다. DRC 결과 및 GitHub Actions 실행 상태를 별도로 확인하세요.

## 한계 및 안전
- 풋프린트는 범용 예시이며 제조사별 정식 풋프린트가 아닙니다.
- 배선은 단일 F.Cu 구리층의 직선 단위만 지원하며 자동 배선, 비아/존/다층, 정밀 clearance rule, 제조용 Gerber가 없습니다.
- **KiCad 회로도 ERC는 미실행**입니다. 공식 PCB DRC가 완료되더라도 회로도의 전기적 적합성은 별도 검토가 필요합니다.
- 사용자가 저장한 KiCad 초안은 공식 키캐드에서 열리고 확인되기 전까지 제조 승인 대상이 아닙니다.
- 기기 연결, 실제 전원 인가, PCB 발주 전에 회로 설계, 핀 방향, 전원·보호 회로, ERC·DRC 및 숙련자의 검토를 거치세요.

공식 자료: https://docs.kicad.org/9.0/en/cli/cli.html
