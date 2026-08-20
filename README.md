# 포착팜 쿠폰 등록 페이지

포착팜 사전등록 사용자를 위한 모바일 우선 쿠폰 등록 웹페이지입니다.

## 실행

Node.js 환경에서 의존성을 설치합니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:4173`을 엽니다. 인증 없이 쿠폰 화면을 작업할 때는 `http://localhost:4173/coupon-dev`를 사용합니다.

`/coupon-dev` 하단의 미리보기 도구로 API 호출 없이 쿠폰 입력, 보상 확인, 카드·배지·코인 결과, 등록 오류, 완료 오류 화면을 각각 열 수 있습니다. 입력 화면에서 임의의 쿠폰 번호를 입력해도 보상 확인 화면으로 전환됩니다.

`.env.example`을 `.env.local`로 복사한 뒤 환경에 맞는 API 주소를 입력합니다.

```env
VITE_API_BASE_URL=http://13.209.190.156
```

Vercel 프로젝트에서는 Settings → Environment Variables에 `VITE_API_BASE_URL`을 등록한 뒤 다시 배포해야 합니다. 이 값은 브라우저 번들에 포함되는 공개 API 주소이므로 비밀 키를 넣으면 안 됩니다.

## 실제 서비스 연동

웹 쿠폰 흐름은 포착팜 앱과 동일한 API를 사용합니다.

- 로그인 완료: `/coupon?accessToken={token}`
- 사용자 조회: `GET /api/users/me`
- 쿠폰 등록 및 보상 조회: `POST /api/coupons/redeem`
- 보상 수령 확정: `POST /api/coupons/complete`

인증 API 요청에는 `Authorization: Bearer {accessToken}` 헤더를 전달합니다. 등록 성공 후 `/coupon-result`에서 보상을 확인하고, 수령을 확정한 뒤 카드 → 1기 포착단 배지 → 코인 3,000개 순으로 결과를 표시합니다.

### 소셜 로그인

카카오·네이버 로그인 버튼은 OAuth 상태와 토큰 교환을 백엔드가 관리하도록 다음 로그인 시작 API로 이동합니다.

```text
GET {VITE_API_BASE_URL}/api/auth/oauth2/kakao
GET {VITE_API_BASE_URL}/api/auth/oauth2/naver
```

Apple 로그인은 관련 백엔드 OAuth 설정이 제공되기 전까지 데모로 동작합니다.

보상 지급, 쿠폰 유효성·만료·중복 검증은 반드시 서버에서 처리해야 합니다.
