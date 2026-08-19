# 포착팜 쿠폰 등록 페이지

포착팜 사전등록 사용자를 위한 모바일 우선 쿠폰 등록 웹페이지입니다.

## 실행

별도 의존성 없이 정적 파일로 동작합니다.

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173/coupon` 또는 `http://localhost:4173`을 엽니다.

## 데모 코드

| 코드 | 결과 |
| --- | --- |
| `FARM2026` | 등록 성공 |
| `USED2026` | 이미 사용한 쿠폰 |
| `EXPIRED2026` | 만료된 쿠폰 |
| `SESSION2026` | 로그인 세션 만료 |
| `ERROR2026` | 서버 오류 |
| 그 외 코드 | 유효하지 않은 쿠폰 |

## 실제 서비스 연동

현재 저장소에는 기존 인증 및 API 코드가 없어 `app.js`의 `login`, `redeemCoupon`을 데모 어댑터로 구성했습니다. 운영 연결 시 다음 두 부분을 교체해야 합니다.

- `login`: 카카오·네이버·Apple의 기존 OAuth 로그인 주소로 이동하고 로그인 완료 후 `/coupon`으로 복귀
- `redeemCoupon`: 세션 쿠키를 포함해 `POST /api/coupons/redeem` 호출

### 소셜 로그인

카카오·네이버 로그인 버튼은 OAuth 상태와 토큰 교환을 백엔드가 관리하도록 다음 로그인 시작 API로 이동합니다.

```text
GET http://13.209.190.156/api/auth/oauth2/kakao
GET http://13.209.190.156/api/auth/oauth2/naver
```

Apple 로그인은 관련 백엔드 OAuth 설정이 제공되기 전까지 데모로 동작합니다. OAuth 콜백 성공 후에는 백엔드가 HttpOnly 세션 쿠키를 설정하고 쿠폰 페이지로 복귀시키는 구성을 권장합니다.

보상 지급, 쿠폰 유효성·만료·중복 검증은 반드시 서버에서 처리해야 합니다.
