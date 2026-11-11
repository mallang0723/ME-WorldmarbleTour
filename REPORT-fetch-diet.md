# 메시지 조회 경량화 보고서

작업 기준: `fix/fetch-diet`, 원본 커밋 `505ef5d`, 확장 버전 `1.0.2 → 1.0.3`.

NPC 결정에 필요한 것은 해당 캐릭터가 방금 생성한 응답 한 건의 본문입니다. 생성 응답의 `message_saved`와 같은 메시지 ID의 `text_rewrite`를 재사용하도록 변경했습니다. 정상 경로에서는 메시지 목록을 조회하지 않습니다. 저장 메시지가 없는 예외 경로만 `?limit=3`으로 한 번 조회하며, 과거 페이지를 순회하지 않습니다.

## 호스트 계약 재확인

읽기 전용으로 확인한 호스트: `/home/syhekate/dev/marinara-engine-ref`, HEAD `fc0333c3f`, [package.json:3](/home/syhekate/dev/marinara-engine-ref/package.json:3)의 버전 `2.5.2`.

- [chats.routes.ts:2673](/home/syhekate/dev/marinara-engine-ref/packages/server/src/routes/chats.routes.ts:2673): `GET /api/chats/:id/messages`의 양수 `limit`은 `listMessagesPaginated`로 전달됩니다. 제한이 없으면 2692행의 `listMessages`가 전체 목록을 반환합니다.
- [chats.storage.ts:721](/home/syhekate/dev/marinara-engine-ref/packages/server/src/services/storage/chats.storage.ts:721): `before` 값은 `createdAt|encodeURIComponent(id)`이며, 타임스탬프와 ID를 검증하고 ID를 디코딩합니다. URL에 넣을 때는 이 커서 전체를 쿼리 값으로 인코딩해야 합니다.
- [chats.storage.ts:2332](/home/syhekate/dev/marinara-engine-ref/packages/server/src/services/storage/chats.storage.ts:2332): 커서보다 작은 `createdAt`, 동률이면 작은 `id`만 조회하는 배타적 경계입니다. 최신 N개를 역순으로 선택한 뒤 오래된 순으로 반환합니다. 이번 확장은 `before`를 사용하지 않습니다.
- `chats.routes.ts`의 GET 라우트를 모두 검색해 단일 메시지 본문을 반환하는 `GET /:chatId/messages/:messageId`가 없음을 확인했습니다. 같은 모양의 경로는 [2996행의 DELETE](/home/syhekate/dev/marinara-engine-ref/packages/server/src/routes/chats.routes.ts:2996)와 [3064행의 PATCH](/home/syhekate/dev/marinara-engine-ref/packages/server/src/routes/chats.routes.ts:3064)입니다. swipes/game-state 등 별도 하위 리소스 GET은 존재합니다.
- [generate/sse.ts:96](/home/syhekate/dev/marinara-engine-ref/packages/server/src/routes/generate/sse.ts:96): 이벤트는 `data: JSON\n\n` 형식입니다. [generate.routes.ts:11925](/home/syhekate/dev/marinara-engine-ref/packages/server/src/routes/generate.routes.ts:11925)의 `message_saved.data`는 저장 메시지이며, [15532행](/home/syhekate/dev/marinara-engine-ref/packages/server/src/routes/generate.routes.ts:15532)의 `text_rewrite.data`는 `messageId`와 `editedText`를 제공합니다. 수정 대기 표시가 있는 응답도 이 이벤트로 최종 본문을 복원합니다. [16088행](/home/syhekate/dev/marinara-engine-ref/packages/server/src/routes/generate.routes.ts:16088)의 `done`을 확인한 후 결과를 사용합니다.

## 전체 호출부 조사 및 변경 전후

아래 행 번호는 모두 `extension/extension.js` 기준이며, 변경 전은 `505ef5d`입니다. 원시 네트워크 요청은 `mwtApi`의 `window.fetch`(542행) 한 곳으로 모입니다.

| 요청/호출부 | 변경 전 → 후 | 실행 계기 / 필요한 정보 / 처리 |
| --- | --- | --- |
| 메시지 목록 GET | 573 → 596 | 이전에는 생성마다 전체 목록을 받아 역순 검색. 이제 생성 응답에 일치하는 저장 메시지가 없을 때만 최근 3개를 한 번 조회. 필요한 것은 해당 캐릭터의 최신 assistant 본문. |
| 최초 결정의 메시지 읽기 | 611–612 → 629 | narrator 프롬프트 후 생성. 기존 generate 후 GET 대신 generate가 반환한 메시지를 직접 사용. |
| 정정 결정의 메시지 읽기 | 622–623 → 639 | 태그 누락/종류 불일치 때 한 번 재시도. 최초 결정과 같은 응답 재사용. |
| `POST /api/generate` | 559 → 559 | 최초 결정 및 정정 재시도. 요청 본문과 생성 횟수 유지. 이전에는 응답에서 오류/done만 확인했고, 이제 저장 메시지와 수정 이벤트도 읽음. |
| `POST /api/chats/:id/messages` | 549 → 549 | narrator 프롬프트, 정정 안내, 기본값 안내, 게임 시작/진행/결과 기록. 필요한 메시지 한 건을 쓰는 작업으로 변경 없음. |
| `GET /api/chats` | 693 → 709 | 패널을 열 때 관찰된 활성 채팅 ID가 없으면 `updatedAt`이 가장 최근인 채팅의 ID 선택. 메시지 본문을 포함하지 않는 목록이며 기존 동작 유지. 호스트 목록 라우트에는 limit/sort 옵션이 없음. |
| `GET /api/chats/:id` | 702 → 718 | 게임 설정 화면에서 참여 캐릭터 ID 목록(`characterIds`) 필요. 단일 채팅 메타데이터만 조회하며 메시지는 포함하지 않음. |
| `GET /api/characters/:id` | 724 → 740 | 상대 선택 목록을 표시할 때 캐릭터 ID/이름 필요. 기존 단일 카드 조회 유지. |

메타데이터 계약은 [chats.routes.ts:1067](/home/syhekate/dev/marinara-engine-ref/packages/server/src/routes/chats.routes.ts:1067)의 목록 응답과 [1452행](/home/syhekate/dev/marinara-engine-ref/packages/server/src/routes/chats.routes.ts:1452)의 단일 채팅 응답에서 확인했습니다. 관찰된 활성 채팅 ID를 먼저 사용하는 기존 경로도 유지합니다.

메시지 POST의 모든 호출부(전 → 후): 최초 결정 `610 → 628`, 정정 `616 → 633`, 기본값 안내 `629 → 645`, 시작 `1138 → 1154`, 무인도 탈출/대기 `1354/1358 → 1370/1374`, 사용자 이동 `1372 → 1388`, 사용자 결정 `1403 → 1419`, NPC 대기 `1460 → 1476`, NPC 이동 `1479 → 1495`, NPC 결정 결과 `1491 → 1507`.

`mwtRoutedFetch`(전 668, 후 684)는 다른 호출의 URL을 관찰하고 원래 fetch에 한 번 위임하는 래퍼입니다. 자체 메시지 조회나 응답 본문 읽기는 추가하지 않습니다. 수동/자동 새로고침은 기존 페이지 reload이며, 호스트의 자체 요청 횟수는 이번 확장 API 계측에서 제외했습니다.

## 호출 수

결정 함수 한 번의 실행 범위이며 게임 시작·주사위 이동·결정 적용 결과 기록은 제외했습니다. 변경 전 두 시나리오는 `git show 505ef5d:extension/extension.js`의 실제 함수를 Node VM에서 모의 fetch로 실행해 계측했습니다. 변경 후는 추가한 회귀 테스트로 검증했습니다.

| 시나리오 | 메시지 POST | 생성 POST | 메시지 GET | 합계 |
| --- | ---: | ---: | ---: | ---: |
| 변경 전 정상 결정 | 1 | 1 | 1 (무제한) | 3 |
| 변경 후 정상 결정 | 1 | 1 | 0 | 2 |
| 변경 전 정정 1회 포함 | 2 | 2 | 2 (무제한) | 6 |
| 변경 후 정정 1회 포함 | 2 | 2 | 0 | 4 |
| 변경 후 태그 실패 2회, 기본값 안내 | 3 | 2 | 0 | 5 |
| 저장 이벤트 없는 예외: 정상 결정 | 1 | 1 | 1 (`limit=3`) | 3 |
| 저장 이벤트 없는 예외: 정정 1회 포함 | 2 | 2 | 2 (각 `limit=3`) | 6 |
| 저장 이벤트/대상 메시지 모두 없음: 기본값 안내까지 | 3 | 2 | 2 (각 `limit=3`) | 7 |

예외 경로의 3개 제한은 대상 assistant 뒤에 narrator 또는 다른 캐릭터 메시지가 붙는 경우를 포함하기 위한 작은 고정 꼬리입니다. 테스트에는 대상 assistant + 다른 캐릭터 + narrator 순서를 포함했습니다. 1개 또는 2개만 읽으면 이 경우의 대상 응답을 찾지 못합니다. 정상 경로는 이미 응답을 가지고 있으므로 조회 자체가 없습니다.

## 검증 및 배포 파일

- `node tests/fetch-diet.test.cjs`: 15개 통과. 정상 결정/정정 호출 수, 구매·건설·세계여행 기본값, 마지막 대상 응답 선택, 다른 채팅/캐릭터/역할 배제, 수정 이벤트의 메시지 ID 일치, CRLF/다중 data/keepalive, 제한된 예외 조회와 페이지 순회 방지, SSE/HTTP 오류 및 비활성화 가드를 검증했습니다.
- 모의 fetch는 실행된 모든 `/messages` GET에서 정수 `1 ≤ limit ≤ 3`을 강제합니다. 파일 전체의 리터럴 메시지 목록 API 호출부도 별도 검사합니다.
- `node tests/floating-button.test.cjs`: 기존 16개 통과.
- `node --test tests/*.test.cjs`: 두 테스트 파일 모두 통과. 이 환경의 파일 단위 출력과 별개로 위 직접 실행에서 총 31개 테스트 통과를 확인했습니다.
- `node --check extension/extension.js`, `git diff --check`: 통과.
- `extension/manifest.json`의 `config.version`, 한국어/영어 README를 `1.0.3`으로 맞추고 CHANGELOG를 추가했습니다. manifest 형식 버전은 `1` 유지.
- 저장소에는 package.json, 빌드 스크립트, 번들/루트 JS 복사본이 없습니다. 배포 원본은 `extension/manifest.json`과 `extension/extension.js`이며 재빌드 대상이 없습니다. README의 수동 ZIP 명령은 그대로 사용 가능합니다.

## 미검증 및 작업 상태

- 브라우저·실서버 QA는 지시대로 실행하지 않았습니다. 리뷰어가 Marinara 2.5.2에서 실제 NPC 결정/정정, 후처리 수정, 네트워크 탭의 제한된 조회를 확인해야 합니다. 실제 전송 바이트 및 지연시간은 측정하지 않았습니다.
- 저장 이벤트가 없고 대상 응답이 최근 3개보다 오래된 예외 상황에서는 과거 전체 기록을 찾지 않고 기존 정정/기본값 흐름으로 진행합니다. 정상 생성 응답은 다른 캐릭터의 후속 메시지와 무관하게 대상 응답을 재사용합니다.
- 생성 요청 자체가 모델 컨텍스트를 구성하기 위해 호스트 내부에서 읽는 기록은 클라이언트 확장의 목록 다운로드와 별개이며 이번 변경 범위가 아닙니다.
- 이 세션의 파일시스템 권한에서 `.git`은 읽기 전용이므로 브리프의 예외 지시에 따라 커밋하지 않았습니다. 지정 작성자 `mallang0723 <308239590+mallang0723@users.noreply.github.com>`로 커밋하는 단계는 쓰기 가능한 환경에서 남아 있습니다. push는 하지 않았습니다.
