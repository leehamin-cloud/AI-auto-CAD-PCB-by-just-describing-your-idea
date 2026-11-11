# Robot Forge PCB Studio v3.1 — 부품 데이터시트·KiCad 진단 보고서·원본 버전 확인

사이트: https://robot-forge-ui-preview.onrender.com/workspace/

## 구현 완료

### 1. 부품별 제조사·품번·데이터시트 수동 등록
PCB 설계 → **부품 선택** → **📄 부품 데이터시트 · 사용 조건**을 펼칩니다.

- 제조사(Manufacturer), 정확한 부품 번호(MPN), HTTPS 데이터시트 링크
- 데이터시트에 기록된 대표 핀 간격(mm)
- 사용자가 입력하는 최대 허용 전압·전류 / 설계에 예상되는 전압·전류
- **직접 데이터시트를 확인했다는 사용자 표시**. 자동 인증이나 제조 승인으로 취급하지 않습니다.
- 부품별 입력 데이터는 기존 브라우저 PCB 프로젝트 JSON에 보존되며, 다시 열고 수정하거나 되돌릴 수 있습니다.
- 브라우저에서는 사용자가 입력한 허용치를 설계 예상치가 초과하는지 비교합니다. 95% 이상 접근할 때는 주의 메시지를 표시합니다. **저항값·온도·전력·서지·역극성·소자 보호·회로 전체 동작 조건을 검증하지 않습니다.**

### 2. BOM CSV 내보내기
PCB 파일 메뉴에 **부품 확인 BOM CSV · 발주 검증 전** 항목을 추가했습니다. 부품번호·모델·참고 풋프린트·제조사·품번·데이터시트·사용자 입력 규격을 포함합니다.
UTF-8 BOM 및 CRLF 줄바꿈을 사용하고, 스프레드시트가 수식으로 해석할 수 있는 필드 시작 문자열(=, +, -, @)을 이스케이프합니다.

### 3. KiCad ERC/DRC JSON 보고서 가져오기
PCB 설계 → **📋 KiCad ERC·DRC 진단 보고서 가져오기**를 펼치면 KiCad 공식 도구가 생성한 `.json` 보고서를 사용자가 직접 불러올 수 있습니다.

- 회로도 ERC와 기판 DRC를 각각 선택
- 각 보고서의 `violations`, `unconnected_items`, `shorting_items` 항목을 보수적으로 파싱해 경고/오류 건수 표시
- 로컬 프로젝트별 저장, 파일 삭제 버튼
- 가져올 때의 PCB 로컬 데이터 지문(FNV32)을 기록해 이후 프로젝트가 수정되면 **현재 로컬 데이터와 다름**이라고 표시
- 파일 진위 및 원본 프로젝트와의 관계는 검증되지 않으며, 아무 문제도 보고되지 않았다고 해서 제조 승인을 자동 부여하지 않습니다.

**운영 제약**: Robot Forge 웹사이트는 현재 정적 사이트입니다. 브라우저에서 KiCad 엔진이 직접 실행되는 것은 아니므로 KiCad CLI 자동 검증과 웹사이트의 보고서 가져오기를 분리했습니다. GitHub Actions에서 생성한 보고서는 Actions의 Artifact를 내려받아 해당 메뉴에서 불러올 수 있습니다.

### 4. 공식 KiCad 풋프린트 최신 버전 비교
- 부품 규격 패널에 선택한 풋프린트의 **KiCad 공식 저장소 원본 링크와 기록된 blob SHA**를 추가했습니다.
- `node scripts/check-kicad-upstream-v31.cjs`: 6종 부품의 참고 패드/외형 데이터·원본 출처 경로·SHA 일치 검증(로컬).
- `node scripts/check-kicad-upstream-v31.cjs --online`: 현재 GitHub KiCad 원본의 SHA를 조회하고 기준 스냅샷과 비교. 버전이 달라지면 자동 반영하지 않고 실패를 보고하며, 공식 풋프린트 재검토를 요구합니다.
- GitHub Actions `.github/workflows/robot-forge-pcb.yml`에 두 검사를 모두 연결했습니다.
- 이번에 GitHub 연결을 통해 현재 원본 SHA를 다시 조회한 결과 **6/6개가 기록된 SHA와 일치**했습니다.

### 5. 실험적 KiCad 회로도 파일에 품번 추가
사용자가 입력한 제조사, MPN, 데이터시트 URL은 `.kicad_sch` 실험 초안의 부품 속성으로도 포함됩니다. 실제 KiCad CLI 파싱 결과는 별도로 확인이 필요합니다.

## 테스트
- PCB 로컬 회귀 테스트: **77/77개 통과**
- GitHub 공식 풋프린트 파일 SHA 연결 조회: **6/6 일치**
- GitHub Actions에서 KiCad 공식 ERC·DRC, 실제 PCB/회로도 정합성: **실행 결과 확인 필요**
- 제조용 부품 선택, 데이터시트 정격·핀맵 실측 검증: **미완료**

## 안전하고 정확한 활용
사용자가 데이터시트를 입력했다는 사실이 그 데이터시트가 진짜이거나 올바른 부품을 선택했다는 보증이 아닙니다. 허용치 아래의 전압/전류라도 온도·서지·역전압, 정격 여유, PCB 열 설계에 따라 위험할 수 있습니다.

참고 풋프린트는 KiCad 원본에서 추출한 일부 형상과 메타데이터를 사용하지만, 전체 공식 풋프린트를 실제 KiCad 엔진에서 불러온 결과 또는 제조사 부품 실측 승인 결과는 아닙니다.

**모든 출력물은 계속 제조 미승인 초안**으로 취급합니다. 실제 제작 전 정식 풋프린트/부품 핀맵 확인, KiCad ERC/DRC, 회로 검토 및 시제품 시험을 거쳐야 합니다.

## 소스 파일
- `public/workspace/pcb-quality-v31.js` — 사용자 입력 부품 규격 검사 및 외부 진단 JSON 파싱
- `public/workspace/pcb-studio.js` — 부품 정보 UI, 보고서 기록, CSV·KiCad 초안 내보내기
- `scripts/check-kicad-upstream-v31.cjs` — KiCad 원본 파일 SHA 변경 감지
- `scripts/test-pcb-v26.cjs` — 이전 모든 기능 포함 75개 자동 검사
- `.github/workflows/robot-forge-pcb.yml` — 연결 파이프라인

원본: https://github.com/KiCad/kicad-footprints

KiCad 공식 CLI: https://docs.kicad.org/9.0/en/cli/cli.html
