# FSD + OOP 빠른 참조 가이드

Unity XR Game 프로젝트에서 각 폴더를 언제, 어떻게 사용할지에 대한 빠른 참조 가이드입니다.

## 🔍 "어떤 폴더에 코드를 작성해야 할까?" 판단 기준

### 📋 의사결정 트리

```
새로운 코드를 작성할 때:

1. 이것이 비즈니스 로직인가?
   ✅ YES → entities/ (도메인 모델, 비즈니스 규칙)
   ❌ NO → 2번으로

2. 이것이 특정 기능의 완전한 구현인가?
   ✅ YES → features/ (API + 로직 + UI가 모두 포함된 기능)
   ❌ NO → 3번으로

3. 이것이 복합 UI 컴포넌트인가?
   ✅ YES → widgets/ (여러 UI 요소를 조합한 위젯)
   ❌ NO → 4번으로

4. 이것이 페이지/화면인가?
   ✅ YES → pages/ (라우팅 가능한 전체 화면)
   ❌ NO → 5번으로

5. 이것이 전역 설정/의존성 주입인가?
   ✅ YES → app/ (애플리케이션 레벨 설정)
   ❌ NO → 6번으로

6. 이것이 재사용 가능한 공통 기능인가?
   ✅ YES → shared/ (유틸리티, 공통 UI, 인프라)
```

---

## 📁 폴더별 사용 시점과 예시

### **`entities/` - 언제 사용하나?**

**사용 시점:**
- 비즈니스 규칙을 캡슐화해야 할 때
- 데이터와 행동을 함께 묶어야 할 때
- 도메인 전문가와 소통할 수 있는 모델이 필요할 때

**실제 예시:**
```typescript
// ✅ entities/unity/model/UnityGame.ts
export class UnityGame {
  // 비즈니스 규칙: 게임이 READY 상태일 때만 세션 시작 가능
  public startSession(playerId: string): GameSession {
    if (this._state !== GameState.READY) {
      throw new GameStateError(`Cannot start session from state: ${this._state}`);
    }
    // ...
  }
}

// ✅ entities/user/model/Player.ts
export class Player {
  // 비즈니스 규칙: 레벨 업 조건
  public levelUp(): void {
    if (this._experience < this.getRequiredExpForNextLevel()) {
      throw new InsufficientExperienceError();
    }
    this._level++;
  }
}
```

**이런 경우 사용하지 마세요:**
```typescript
// ❌ entities에 속하지 않음 - 순수한 데이터 구조
interface ApiResponse {
  data: any;
  status: number;
}

// ❌ entities에 속하지 않음 - UI 상태
interface FormState {
  isSubmitting: boolean;
  errors: string[];
}
```

---

### **`features/` - 언제 사용하나?**

**사용 시점:**
- 하나의 완전한 기능을 구현할 때
- API, 비즈니스 로직, UI가 모두 필요한 기능
- 독립적으로 개발/배포 가능한 모듈

**실제 예시:**
```typescript
// ✅ features/unity-integration/ - Unity 게임 통합 기능 전체
features/unity-integration/
├── api/UnityRepository.ts      # 데이터 저장
├── services/UnityLoader.ts     # 비즈니스 로직  
├── ui/UnityGameContainer.tsx   # UI 컴포넌트
└── index.ts                    # 기능 진입점

// ✅ features/multiplayer/ - 멀티플레이어 기능
features/multiplayer/
├── api/MultiplayerAPI.ts
├── services/RoomService.ts
├── ui/LobbyWidget.tsx
└── hooks/useMultiplayer.ts

// ✅ features/payment/ - 결제 기능
features/payment/
├── api/PaymentAPI.ts
├── services/PaymentProcessor.ts  
├── ui/PaymentForm.tsx
└── types/PaymentTypes.ts
```

**이런 경우 사용하지 마세요:**
```typescript
// ❌ features에 속하지 않음 - 순수 UI 컴포넌트
const Button = () => <button>Click</button>;

// ❌ features에 속하지 않음 - 유틸리티 함수
const formatDate = (date: Date) => date.toISOString();
```

---

### **`widgets/` - 언제 사용하나?**

**사용 시점:**
- 여러 UI 요소를 조합한 복합 컴포넌트
- 특정 비즈니스 컨텍스트가 있는 UI
- 재사용 가능하지만 도메인 특화된 컴포넌트

**실제 예시:**
```typescript
// ✅ widgets/game-view/UnityView.tsx - Unity 게임 렌더링 위젯
export const UnityView: React.FC<UnityViewProps> = ({
  config,
  onGameLoaded,
  onError
}) => {
  // Unity 로딩, 에러 처리, 진행률 표시 등 복합 기능
  return (
    <div className="unity-game-view">
      {!isLoaded && <LoadingProgress />}
      <Unity unityProvider={unityProvider} />
      <GameControls />
    </div>
  );
};

// ✅ widgets/player-stats/PlayerStatsWidget.tsx
export const PlayerStatsWidget = () => (
  <div className="player-stats">
    <Avatar />
    <PlayerInfo />
    <StatsChart />
    <AchievementsBadge />
  </div>
);
```

**이런 경우 사용하지 마세요:**
```typescript
// ❌ widgets에 속하지 않음 - 순수 UI (shared/ui로)
const Button = ({ children, onClick }) => (
  <button onClick={onClick}>{children}</button>
);

// ❌ widgets에 속하지 않음 - 전체 페이지 (pages로)
const GamePage = () => (
  <div>
    <Header />
    <UnityView />
    <Footer />
  </div>
);
```

---

### **`pages/` - 언제 사용하나?**

**사용 시점:**
- 라우팅 가능한 전체 화면
- URL과 1:1 매핑되는 컴포넌트
- 여러 위젯을 조합한 완전한 페이지

**실제 예시:**
```typescript
// ✅ pages/GamePage.tsx - /game URL에 해당하는 페이지
export const GamePage: React.FC = () => (
  <PageLayout>
    <GameHeader />
    <UnityGameWidget gameId="rguys" />
    <PlayerStatsWidget />
    <GameControls />
  </PageLayout>
);

// ✅ pages/LobbyPage.tsx - /lobby URL에 해당하는 페이지  
export const LobbyPage: React.FC = () => (
  <PageLayout>
    <LobbyHeader />
    <RoomListWidget />
    <CreateRoomWidget />
  </PageLayout>
);
```

---

### **`app/` - 언제 사용하나?**

**사용 시점:**
- 애플리케이션 전역 설정
- 의존성 주입 컨테이너
- 전역 상태 관리 Provider

**실제 예시:**
```typescript
// ✅ app/providers/UnityProvider.tsx - Unity 서비스 의존성 주입
export const UnityProvider: React.FC = ({ children }) => {
  const contextValue = useMemo(() => {
    const repository = new InMemoryUnityRepository();
    const loader = new WebGLUnityLoader();
    return new UnityGameService(repository, loader);
  }, []);

  return (
    <UnityContext.Provider value={contextValue}>
      {children}
    </UnityContext.Provider>
  );
};

// ✅ app/config/constants.ts - 애플리케이션 전역 상수
export const APP_CONFIG = {
  UNITY_BUILD_PATH: '/unity/rguys',
  API_BASE_URL: process.env.REACT_APP_API_URL,
  WEBSOCKET_URL: process.env.REACT_APP_WS_URL
};
```

---

### **`shared/` - 언제 사용하나?**

**사용 시점:**
- 여러 레이어에서 재사용되는 코드
- 외부 라이브러리 래핑
- 순수 함수, 유틸리티
- 기본 UI 컴포넌트

**실제 예시:**
```typescript
// ✅ shared/ui/Button/Button.tsx - 기본 UI 컴포넌트
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  children,
  ...props
}) => (
  <button 
    className={`btn btn--${variant} btn--${size}`}
    {...props}
  >
    {children}
  </button>
);

// ✅ shared/lib/utils.ts - 순수 유틸리티 함수
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ✅ shared/hooks/useLocalStorage.ts - 재사용 가능한 훅
export const useLocalStorage = <T>(key: string, initialValue: T) => {
  // 로컬 스토리지 로직
};
```

---

## 🎯 실제 개발 시나리오별 가이드

### **시나리오 1: "Unity 게임에 점수 시스템을 추가하고 싶어"**

1. **entities/unity/model/Score.ts** - 점수 도메인 모델
```typescript
export class Score {
  constructor(private _value: number) {
    if (_value < 0) throw new InvalidScoreError();
  }
  
  add(points: number): Score {
    return new Score(this._value + points);
  }
}
```

2. **features/scoring/** - 점수 관련 모든 기능
```typescript
features/scoring/
├── api/ScoreRepository.ts      # 점수 저장/조회
├── services/ScoringService.ts  # 점수 계산 로직
├── ui/ScoreDisplay.tsx         # 점수 표시 UI
└── hooks/useScoring.ts         # 점수 관련 훅
```

3. **widgets/game-hud/ScoreWidget.tsx** - 게임 화면의 점수 위젯
```typescript
export const ScoreWidget = () => {
  const { currentScore, addScore } = useScoring();
  return <ScoreDisplay score={currentScore} />;
};
```

### **시나리오 2: "로그인 기능을 추가하고 싶어"**

1. **entities/user/model/User.ts** - 사용자 도메인 모델
```typescript
export class User {
  constructor(
    private _id: UserId,
    private _email: Email,
    private _password: HashedPassword
  ) {}
  
  authenticate(password: string): boolean {
    return this._password.verify(password);
  }
}
```

2. **features/authentication/** - 인증 기능 전체
```typescript
features/authentication/
├── api/AuthAPI.ts
├── services/AuthService.ts
├── ui/LoginForm.tsx
└── hooks/useAuth.ts
```

3. **pages/LoginPage.tsx** - 로그인 페이지
```typescript
export const LoginPage = () => (
  <PageLayout>
    <LoginForm />
  </PageLayout>
);
```

4. **app/providers/AuthProvider.tsx** - 전역 인증 상태
```typescript
export const AuthProvider = ({ children }) => {
  // 전역 인증 상태 관리
};
```

### **시나리오 3: "공통으로 사용할 모달 컴포넌트가 필요해"**

1. **shared/ui/Modal/Modal.tsx** - 기본 모달 컴포넌트
```typescript
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children
}) => {
  // 기본 모달 기능만
};
```

2. **widgets/confirm-dialog/ConfirmDialog.tsx** - 확인 다이얼로그 위젯
```typescript
export const ConfirmDialog = ({ 
  message, 
  onConfirm, 
  onCancel 
}) => (
  <Modal isOpen={true}>
    <p>{message}</p>
    <Button onClick={onConfirm}>확인</Button>
    <Button onClick={onCancel}>취소</Button>
  </Modal>
);
```

---

## 🚨 자주 하는 실수들

### **❌ 잘못된 폴더 선택**

```typescript
// ❌ shared에 비즈니스 로직 - entities로 이동해야 함
// shared/lib/gameLogic.ts
export const calculateScore = (level: number, time: number) => {
  return level * 1000 - time * 10; // 게임 비즈니스 규칙
};

// ✅ entities/game/model/ScoreCalculator.ts
export class ScoreCalculator {
  calculate(level: number, time: number): Score {
    const value = level * 1000 - time * 10;
    return new Score(value);
  }
}
```

```typescript
// ❌ features에 순수 UI - shared나 widgets로 이동해야 함
// features/game/Button.tsx
export const Button = ({ children }) => <button>{children}</button>;

// ✅ shared/ui/Button.tsx 또는 widgets/game-button/GameButton.tsx
```

### **❌ 의존성 방향 위반**

```typescript
// ❌ entities가 features에 의존 - 방향이 잘못됨
// entities/unity/UnityGame.ts
import { UnityAPI } from '@/features/unity-integration/api';

// ✅ features가 entities에 의존
// features/unity-integration/services/UnityService.ts
import { UnityGame } from '@/entities/unity';
```

### **❌ 너무 큰 컴포넌트를 shared에 배치**

```typescript
// ❌ shared에 복잡한 비즈니스 로직 포함 컴포넌트
// shared/ui/GameDashboard.tsx - 너무 복잡함

// ✅ widgets에 복잡한 컴포넌트, shared에는 기본 UI만
// widgets/game-dashboard/GameDashboard.tsx
// shared/ui/Card.tsx, shared/ui/Chart.tsx
```

---

## ✅ 빠른 체크리스트

### **새 파일/폴더 생성 전 확인사항:**

- [ ] 이 코드의 주요 책임이 무엇인가?
- [ ] 다른 레이어에서 재사용될 가능성이 있는가?
- [ ] 비즈니스 규칙을 포함하고 있는가?
- [ ] UI와 로직이 섞여 있는가?
- [ ] 의존성 방향이 올바른가? (app → pages → widgets → features → entities → shared)

### **코드 리뷰 시 확인사항:**

- [ ] 올바른 폴더에 위치하고 있는가?
- [ ] 단일 책임 원칙을 지키고 있는가?
- [ ] 의존성 주입을 사용하고 있는가?
- [ ] 적절한 추상화 레벨인가?
- [ ] 테스트 작성이 쉬운 구조인가?

이 가이드를 참조하여 **일관되고 확장 가능한** 코드 구조를 유지하세요!