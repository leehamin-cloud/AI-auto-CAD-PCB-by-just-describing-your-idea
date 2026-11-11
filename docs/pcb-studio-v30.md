# Robot Forge PCB Studio v3.0 — 양면 PCB·비아·자동 배선 초안

접속: https://robot-forge-ui-preview.onrender.com/workspace/

## 새로 구현한 것

### 1. KiCad 라이브러리에서 추출한 부품 외형
`pcb-footprint-graphics.js`에는 KiCad/kicad-footprints 저장소의 THT 6종에 대한 `F.SilkS`, `F.Fab`, `F.CrtYd` 그림의 선과 원 정보를 담았습니다. 기존 `pcb-pad-library.js`의 원본 패드 규격과 결합해 브라우저 PCB 뷰 및 생성된 KiCad `.kicad_pcb` 초안에 표시합니다.

구형 `.kicad_mod`의 `fp_arc`는 각도 20° 이하의 연속 선분으로 근사합니다. 참조 원본 경로와 blob SHA, 일부 그래픽은 보존하지만 **공식 라이브러리 풋프린트 전체를 그대로 복사한 것이 아니며, 제조사 부품 적합성은 검증되지 않았습니다.** 실제 KiCad에서 공식 라이브러리 파일과 부품 데이터시트를 대조해야 합니다.

### 2. 양면 배선
- 기존 레거시 직선 배선(층 미지정 → F.Cu) 프로젝트는 자동으로 호환됩니다.
- 수동 배선에서 **F.Cu(앞면)** 또는 **B.Cu(뒷면)**를 선택할 수 있습니다.
- 색상: 주황색은 F.Cu, 보라색은 B.Cu
- 자동 경로에서는 필요한 경우 F.Cu↔B.Cu 전환 지점에 **스루 비아**를 생성합니다(참고값: 지름 1.4mm, 드릴 0.6mm). 기존 제공 부품은 관통형 패드(THT)입니다.
- KiCad PCB 초안에는 각 선분의 층을 명시한 `(segment ...)`와 `(via ...)`를 내보냅니다.
- 현재는 **2개 구리층만** 구현했으며 내층, blind/buried via, 채움 영역, 고속 임피던스 규칙을 지원하지 않습니다.

### 3. 간단한 자동 배선
**PCB 설계 → ③ 기판 설정 → ⚙ 양면 배선·자동 연결(펼침)**

1. **④ 연결할 핀 정하기**에서 신호 이름과 핀을 연결 계획에 먼저 지정합니다.
2. 자동 연결 설정을 열고 F.Cu/B.Cu, 비아 허용, 배선폭을 선택합니다.
3. **✦ 미배선 자동 연결**을 누르면 등록된 논리 넷 중 미배선 경로를 탐색합니다.
4. 성공한 배선만 프로젝트에 반영합니다. 실패한 신호/이유를 표시합니다. Undo(되돌리기)를 지원합니다.
5. 자동 배선 후 반드시 **⑤ 연결·간격 검사**, 공식 KiCad ERC/DRC, 실제 부품과 풋프린트 정합성을 확인해야 합니다.

구현: 최대 24개 자동 경로/회차, 1mm 직교 격자 기반 A* 탐색, 임시 비아 최대 2개/경로. 탐색은 타 신호 패드, 기존 트랙, 기존 비아를 장애물로 취급합니다. 복잡한 보드에서는 경로가 없거나 부적절할 수 있으며 **KiCad 공식 PNS 라우터 또는 실제 DRC를 대체하지 않습니다.**

### 4. 배선 무결성 보완
- 자동 배선 경로는 절대 위치를 저장하는 다중 구간의 형식입니다. 부품 이동·회전·풋프린트 변경으로 끝점이 무효가 되면 연결된 자동 경로를 **자동 삭제**하고 재배선을 요구합니다. Undo로 이전 상태를 복원할 수 있습니다.
- 레거시 직선 배선은 부품 패드 위치에 따라 자동 갱신됩니다.
- 비아의 기판 가장자리·타 패드·타 배선과의 거리 경고를 추가했습니다.
- 기존 논리 연결 계획의 오픈/쇼트 검사를 유지합니다. 로컬 거리 계산은 **정식 제조용 DRC가 아닙니다.**

## 자동 검증

```bash
node scripts/test-pcb-v26.cjs
python3 scripts/test-kicad-parity.py
```

회귀 테스트 **64/64** 통과(레거시 모델, 단면/양면, 강제 비아 우회, 비정상 비아 구조, 실제 패드/외형, 부품 이동 후 자동 배선 무효화 포함). 이 수치는 코드 기반 검사이지 실제 KiCad CLI 성공이 아닙니다.

GitHub Actions: `.github/workflows/robot-forge-pcb.yml`에서 소스 변경 시 Node/Python 검사와 KiCad CLI 파싱·ERC·DRC를 시도하도록 연결했습니다. 실행 결과는 [GitHub Actions](https://github.com/leehamin-cloud/AI-auto-CAD-PCB-by-just-describing-your-idea/actions)에서 확인해야 합니다.

## 제조 상태

**제조 승인 차단.** Gerber·드릴 진단 파일은 GitHub Actions에서 공식 KiCad 검사가 통과할 때만 예제용으로 생성하도록 설계되었고, 사용자가 만든 임의 프로젝트의 제조 파일이 아닙니다.

미완료: 부품 데이터시트/정격 연결, 전체 공식 풋프린트 가져오기 및 실제 KiCad 풋프린트 동기화, 정식 ERC/DRC 결과 확인, BOM 부품 구매 검증, 복잡한 다층 설계, 강건한 자동 배선, 실제 PCB 시제품 시험.

## 소스
- `public/workspace/pcb-router-v30.js` — 제한적인 2층 A* 경로 탐색
- `public/workspace/pcb-footprint-graphics.js` — KiCad 원본 기반 외형선/원 추출
- `public/workspace/pcb-studio.js` — UI, 구리층 렌더, Via, 내보내기, 되돌리기
- `public/workspace/index.html` / `pcb-studio.css` — 접기 가능한 UI
- `scripts/test-pcb-v26.cjs` — 64개 회귀 검사
- `.github/workflows/robot-forge-pcb.yml` — KiCad 검증 절차

Upstream KiCad footprint repository: https://github.com/KiCad/kicad-footprints
