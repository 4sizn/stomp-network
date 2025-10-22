# FSD + OOP 개발 가이드

Unity XR Game 프로젝트의 FSD(Feature-Sliced Design) 아키텍처에서 객체지향 프로그래밍(OOP) 원칙을 적용하는 종합 가이드입니다.

## 📚 목차

1. [FSD 레이어별 OOP 적용 원칙](#fsd-레이어별-oop-적용-원칙)
2. [SOLID 원칙 적용 가이드](#solid-원칙-적용-가이드)
3. [디자인 패턴 활용법](#디자인-패턴-활용법)
4. [실제 코드 예제](#실제-코드-예제)
5. [폴더별 사용 목적과 가이드라인](#폴더별-사용-목적과-가이드라인)

---

## 🏗️ FSD 레이어별 OOP 적용 원칙

### **1. `app/` - 애플리케이션 레이어**
**목적**: 최상위 설정, 의존성 주입, 글로벌 상태 관리

#### OOP 원칙:
- **Dependency Injection Container**: IoC(제어 역전) 패턴
- **Factory Pattern**: Provider 인스턴스 생성
- **Singleton Pattern**: 애플리케이션 전역 상태

```typescript
// app/providers/UnityProvider.tsx
export class UnityContainer {
  private static _instance: UnityContainer;
  private _services: Map<string, any> = new Map();

  public static getInstance(): UnityContainer {
    if (!UnityContainer._instance) {
      UnityContainer._instance = new UnityContainer();
    }
    return UnityContainer._instance;
  }

  public register<T>(key: string, factory: () => T): void {
    this._services.set(key, factory);
  }

  public resolve<T>(key: string): T {
    const factory = this._services.get(key);
    if (!factory) throw new Error(`Service ${key} not found`);
    return factory();
  }
}
```

---

### **2. `pages/` - 페이지 레이어**
**목적**: 라우팅, 페이지별 상태 관리, 전체 화면 레이아웃

#### OOP 원칙:
- **Template Method Pattern**: 페이지 구조 템플릿
- **Observer Pattern**: 페이지 상태 변화 감시
- **Command Pattern**: 페이지 액션 캡슐화

```typescript
// pages/GamePage.tsx
abstract class BasePage {
  protected abstract renderHeader(): React.ReactNode;
  protected abstract renderContent(): React.ReactNode;
  protected abstract renderFooter(): React.ReactNode;

  // Template Method
  public render(): React.ReactNode {
    return (
      <div className="page-container">
        {this.renderHeader()}
        {this.renderContent()}
        {this.renderFooter()}
      </div>
    );
  }
}

class GamePage extends BasePage {
  protected renderHeader() { return <GameHeader />; }
  protected renderContent() { return <UnityGameContainer />; }
  protected renderFooter() { return <GameControls />; }
}
```

---

### **3. `widgets/` - 위젯 레이어**
**목적**: 복합 UI 컴포넌트, 비즈니스 로직과 UI 연결

#### OOP 원칙:
- **Composite Pattern**: UI 컴포넌트 조합
- **Strategy Pattern**: 렌더링 전략 선택
- **Adapter Pattern**: 외부 라이브러리 통합

```typescript
// widgets/game-view/UnityView.tsx
interface RenderStrategy {
  render(props: UnityViewProps): React.ReactNode;
}

class LoadingStrategy implements RenderStrategy {
  render(props: UnityViewProps): React.ReactNode {
    return <LoadingSpinner progress={props.loadingProgress} />;
  }
}

class GameStrategy implements RenderStrategy {
  render(props: UnityViewProps): React.ReactNode {
    return <Unity unityProvider={props.unityProvider} />;
  }
}

class UnityViewWidget {
  private _strategy: RenderStrategy;

  constructor(strategy: RenderStrategy) {
    this._strategy = strategy;
  }

  public setStrategy(strategy: RenderStrategy): void {
    this._strategy = strategy;
  }

  public render(props: UnityViewProps): React.ReactNode {
    return this._strategy.render(props);
  }
}
```

---

### **4. `features/` - 기능 레이어**
**목적**: 특정 기능의 완전한 구현 (API, UI, 로직)

#### OOP 원칙:
- **Facade Pattern**: 복잡한 하위 시스템 단순화
- **Factory Method**: 기능별 객체 생성
- **Chain of Responsibility**: 요청 처리 체인

```typescript
// features/unity-integration/UnityIntegrationFacade.ts
export class UnityIntegrationFacade {
  private _repository: UnityGameRepository;
  private _loader: UnityLoaderAdapter;
  private _service: UnityGameService;

  constructor() {
    this._repository = new InMemoryUnityGameRepository();
    this._loader = new ReactUnityAdapter();
    this._service = new UnityGameService(this._repository, this._loader);
  }

  public async initializeGame(gameId: string): Promise<UnityGame> {
    // 복잡한 초기화 과정을 단순한 인터페이스로 제공
    const config = await this._loadGameConfig(gameId);
    const game = await this._service.initializeGame(gameId, config);
    await this._service.loadGame(game);
    return game;
  }

  private async _loadGameConfig(gameId: string): Promise<UnityGameConfig> {
    // 설정 로딩 로직
    return {
      loaderUrl: `/unity/${gameId}/Build/Build.loader.js`,
      dataUrl: `/unity/${gameId}/Build/Build.data.unityweb`,
      frameworkUrl: `/unity/${gameId}/Build/Build.framework.js.unityweb`,
      codeUrl: `/unity/${gameId}/Build/Build.wasm.unityweb`,
      companyName: 'RSupport',
      productName: 'RFICE',
      productVersion: '0.1.0.0'
    };
  }
}
```

---

### **5. `entities/` - 엔티티 레이어**
**목적**: 도메인 모델, 비즈니스 규칙, 핵심 로직

#### OOP 원칙:
- **Domain Model Pattern**: 풍부한 도메인 모델
- **Aggregate Root Pattern**: 일관성 경계
- **Value Object Pattern**: 불변 값 객체
- **Domain Service Pattern**: 도메인 서비스

```typescript
// entities/unity/model/UnityGame.ts (Aggregate Root)
export class UnityGame {
  private _id: string;
  private _state: GameState;
  private _session?: GameSession;

  constructor(id: string, name: string, version: string, config: UnityGameConfig) {
    this._id = id;
    this._state = GameState.INITIALIZING;
    // 생성 시 비즈니스 규칙 검증
    this._validateConfiguration(config);
  }

  // 비즈니스 규칙 메서드
  public startSession(playerId: PlayerId): GameSession {
    if (this._state !== GameState.READY) {
      throw new GameStateError(`Cannot start session from state: ${this._state}`);
    }

    this._session = new GameSession(
      SessionId.generate(),
      this._id,
      playerId
    );
    this._state = GameState.RUNNING;

    // 도메인 이벤트 발행
    DomainEvents.raise(new GameSessionStartedEvent(this._id, this._session.id));

    return this._session;
  }

  private _validateConfiguration(config: UnityGameConfig): void {
    if (!config.loaderUrl || !config.dataUrl) {
      throw new InvalidConfigurationError('Essential Unity files not configured');
    }
  }
}

// Value Object 예제
export class PlayerId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('PlayerId cannot be empty');
    }
    this._value = value.trim();
  }

  public get value(): string {
    return this._value;
  }

  public equals(other: PlayerId): boolean {
    return this._value === other._value;
  }
}
```

---

### **6. `shared/` - 공유 레이어**
**목적**: 재사용 가능한 유틸리티, 공통 컴포넌트, 인프라스트럭처

#### OOP 원칙:
- **Utility Classes**: 정적 메서드 모음
- **Helper Patterns**: 도우미 클래스
- **Infrastructure Patterns**: 외부 시스템 연동

```typescript
// shared/lib/ErrorHandler.ts
export abstract class BaseError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.timestamp = new Date();
    this.name = this.constructor.name;
  }

  public abstract getHttpStatusCode(): number;
}

export class UnityLoadError extends BaseError {
  constructor(message: string, public readonly details?: unknown) {
    super('UNITY_LOAD_ERROR', message);
  }

  public getHttpStatusCode(): number {
    return 500;
  }
}

// shared/infrastructure/UnityWebGLAdapter.ts
export class UnityWebGLAdapter implements UnityLoaderAdapter {
  private _loadingStrategy: LoadingStrategy;

  constructor(strategy: LoadingStrategy = new ProgressiveLoadingStrategy()) {
    this._loadingStrategy = strategy;
  }

  public async load(config: UnityGameConfig, onProgress?: ProgressCallback): Promise<void> {
    return this._loadingStrategy.load(config, onProgress);
  }

  public setLoadingStrategy(strategy: LoadingStrategy): void {
    this._loadingStrategy = strategy;
  }
}

interface LoadingStrategy {
  load(config: UnityGameConfig, onProgress?: ProgressCallback): Promise<void>;
}
```

---

## 🔧 SOLID 원칙 적용 가이드

### **S - Single Responsibility Principle (단일 책임 원칙)**

각 클래스는 하나의 책임만 가져야 합니다.

```typescript
// ❌ 잘못된 예: 여러 책임을 가진 클래스
class UnityGameManager {
  loadGame() { /* 게임 로딩 */ }
  savePlayerData() { /* 플레이어 데이터 저장 */ }
  renderUI() { /* UI 렌더링 */ }
  handleNetworking() { /* 네트워킹 */ }
}

// ✅ 올바른 예: 단일 책임으로 분리
class UnityGameLoader {
  loadGame() { /* 게임 로딩만 담당 */ }
}

class PlayerDataRepository {
  savePlayerData() { /* 데이터 저장만 담당 */ }
}

class UnityGameRenderer {
  renderUI() { /* UI 렌더링만 담당 */ }
}
```

### **O - Open/Closed Principle (개방-폐쇄 원칙)**

확장에는 열려있고 변경에는 닫혀있어야 합니다.

```typescript
// 기본 인터페이스 정의
interface GameState {
  handle(game: UnityGame): void;
}

// 새로운 상태 추가 시 기존 코드 수정 없이 확장 가능
class LoadingState implements GameState {
  handle(game: UnityGame): void {
    // 로딩 상태 처리
  }
}

class RunningState implements GameState {
  handle(game: UnityGame): void {
    // 실행 상태 처리
  }
}

// 새로운 상태 추가 (기존 코드 수정 없이)
class PausedState implements GameState {
  handle(game: UnityGame): void {
    // 일시정지 상태 처리
  }
}
```

### **L - Liskov Substitution Principle (리스코프 치환 원칙)**

파생 클래스는 기본 클래스를 완전히 대체할 수 있어야 합니다.

```typescript
abstract class UnityLoaderAdapter {
  abstract load(config: UnityGameConfig): Promise<void>;
  
  // 공통 검증 로직
  protected validateConfig(config: UnityGameConfig): void {
    if (!config.loaderUrl) throw new Error('Loader URL required');
  }
}

class WebGLLoaderAdapter extends UnityLoaderAdapter {
  async load(config: UnityGameConfig): Promise<void> {
    this.validateConfig(config); // 부모 검증 로직 사용
    // WebGL 특화 로딩 로직
  }
}

class MockLoaderAdapter extends UnityLoaderAdapter {
  async load(config: UnityGameConfig): Promise<void> {
    this.validateConfig(config); // 부모 검증 로직 사용
    // 테스트용 목 로딩 로직
  }
}

// 어떤 구현체든 동일하게 사용 가능
function initializeGame(loader: UnityLoaderAdapter) {
  return loader.load(config); // LSP 준수
}
```

### **I - Interface Segregation Principle (인터페이스 분리 원칙)**

클라이언트가 사용하지 않는 메서드에 의존하지 않도록 인터페이스를 분리합니다.

```typescript
// ❌ 너무 큰 인터페이스
interface UnityGameManager {
  load(): Promise<void>;
  start(): void;
  pause(): void;
  saveData(): void;
  loadData(): void;
  renderGraphics(): void;
  playAudio(): void;
}

// ✅ 작은 인터페이스들로 분리
interface Loadable {
  load(): Promise<void>;
}

interface Controllable {
  start(): void;
  pause(): void;
}

interface Persistable {
  saveData(): void;
  loadData(): void;
}

interface Renderable {
  renderGraphics(): void;
}

// 필요한 인터페이스만 구현
class UnityGameController implements Loadable, Controllable {
  load(): Promise<void> { /* 구현 */ }
  start(): void { /* 구현 */ }
  pause(): void { /* 구현 */ }
}
```

### **D - Dependency Inversion Principle (의존성 역전 원칙)**

고수준 모듈이 저수준 모듈에 의존하지 않도록 추상화에 의존합니다.

```typescript
// 추상화 정의
interface UnityRepository {
  save(game: UnityGame): Promise<void>;
  findById(id: string): Promise<UnityGame | null>;
}

interface UnityLoader {
  load(config: UnityGameConfig): Promise<void>;
}

// 고수준 모듈 - 추상화에만 의존
class UnityGameService {
  constructor(
    private _repository: UnityRepository,  // 추상화에 의존
    private _loader: UnityLoader           // 추상화에 의존
  ) {}

  async initializeGame(id: string, config: UnityGameConfig): Promise<UnityGame> {
    const game = await this._repository.findById(id);
    await this._loader.load(config);
    return game;
  }
}

// 저수준 모듈 - 인터페이스 구현
class InMemoryUnityRepository implements UnityRepository {
  async save(game: UnityGame): Promise<void> { /* 구현 */ }
  async findById(id: string): Promise<UnityGame | null> { /* 구현 */ }
}

class WebGLUnityLoader implements UnityLoader {
  async load(config: UnityGameConfig): Promise<void> { /* 구현 */ }
}
```

---

## 🎨 디자인 패턴 활용법

### **1. Factory Pattern - 객체 생성 캡슐화**

```typescript
// entities/unity/factories/UnityGameFactory.ts
export class UnityGameFactory {
  public static createGame(type: GameType, config: UnityGameConfig): UnityGame {
    switch (type) {
      case GameType.MULTIPLAYER:
        return new MultiplayerUnityGame(config);
      case GameType.SINGLEPLAYER:
        return new SingleplayerUnityGame(config);
      case GameType.TUTORIAL:
        return new TutorialUnityGame(config);
      default:
        throw new Error(`Unknown game type: ${type}`);
    }
  }
}

// 사용법
const game = UnityGameFactory.createGame(GameType.MULTIPLAYER, config);
```

### **2. Observer Pattern - 이벤트 시스템**

```typescript
// shared/lib/EventEmitter.ts
export class GameEventEmitter {
  private _listeners: Map<string, Array<(data: any) => void>> = new Map();

  public on(event: string, callback: (data: any) => void): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event)!.push(callback);
  }

  public emit(event: string, data: any): void {
    const callbacks = this._listeners.get(event) || [];
    callbacks.forEach(callback => callback(data));
  }

  public off(event: string, callback: (data: any) => void): void {
    const callbacks = this._listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
    }
  }
}

// entities/unity/model/UnityGame.ts
export class UnityGame {
  private _eventEmitter = new GameEventEmitter();

  public startSession(playerId: string): GameSession {
    // 비즈니스 로직...
    
    // 이벤트 발행
    this._eventEmitter.emit('sessionStarted', {
      gameId: this._id,
      playerId,
      timestamp: new Date()
    });
    
    return session;
  }

  public onSessionStarted(callback: (data: any) => void): void {
    this._eventEmitter.on('sessionStarted', callback);
  }
}
```

### **3. Command Pattern - 액션 캡슐화**

```typescript
// shared/lib/commands/Command.ts
export interface Command {
  execute(): Promise<void>;
  undo(): Promise<void>;
}

// features/unity-integration/commands/StartGameCommand.ts
export class StartGameCommand implements Command {
  constructor(
    private _gameService: UnityGameService,
    private _gameId: string,
    private _playerId: string
  ) {}

  async execute(): Promise<void> {
    await this._gameService.startGameSession(this._gameId, this._playerId);
  }

  async undo(): Promise<void> {
    await this._gameService.endGameSession(this._gameId);
  }
}

// widgets/game-controls/GameControlsWidget.tsx
export class GameControlsWidget {
  private _commandHistory: Command[] = [];

  async executeCommand(command: Command): Promise<void> {
    await command.execute();
    this._commandHistory.push(command);
  }

  async undoLastCommand(): Promise<void> {
    const lastCommand = this._commandHistory.pop();
    if (lastCommand) {
      await lastCommand.undo();
    }
  }
}
```

### **4. Strategy Pattern - 알고리즘 교체**

```typescript
// shared/lib/strategies/LoadingStrategy.ts
export interface LoadingStrategy {
  load(config: UnityGameConfig, onProgress?: (progress: number) => void): Promise<void>;
}

export class ProgressiveLoadingStrategy implements LoadingStrategy {
  async load(config: UnityGameConfig, onProgress?: (progress: number) => void): Promise<void> {
    // 점진적 로딩 구현
    for (let i = 0; i <= 100; i += 10) {
      onProgress?.(i / 100);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

export class FastLoadingStrategy implements LoadingStrategy {
  async load(config: UnityGameConfig, onProgress?: (progress: number) => void): Promise<void> {
    // 빠른 로딩 구현
    onProgress?.(1);
  }
}

// features/unity-integration/UnityLoader.ts
export class UnityLoader {
  constructor(private _strategy: LoadingStrategy) {}

  public setStrategy(strategy: LoadingStrategy): void {
    this._strategy = strategy;
  }

  public async load(config: UnityGameConfig, onProgress?: (progress: number) => void): Promise<void> {
    return this._strategy.load(config, onProgress);
  }
}
```

### **5. Plugin Pattern - 기능 확장**

```typescript
// shared/core/controllers/network/plugins/AbstractPlugin.ts
export abstract class AbstractPlugin {
  public abstract readonly name: string;
  protected controller: StompNetworkController | null = null;

  public attach(controller: StompNetworkController): void {
    this.controller = controller;
    this.onAttach();
  }

  public detach(): void {
    this.onDetach();
    this.controller = null;
  }

  // 라이프사이클 훅들
  public abstract onBeforeConnect(): Promise<void>;
  public abstract onAfterConnect(): Promise<void>;
  public abstract onBeforeDisconnect(): Promise<void>;
  public abstract onAfterDisconnect(): Promise<void>;

  protected abstract onAttach(): void;
  protected abstract onDetach(): void;
}

// shared/core/controllers/network/plugins/TopicPlugin.ts
export class TopicPlugin extends AbstractPlugin {
  public readonly name = "TopicPlugin";
  
  private topicSubscriptions = new Map<string, TopicSubscriptionInfo>();

  public subscribeTopic(topic: string, type: TopicSubscriptionType): void {
    // 연결 전에도 토픽 구독 등록 가능
    const subscriptionInfo: TopicSubscriptionInfo = {
      topic,
      type,
      isActive: false,
      createdAt: new Date()
    };
    this.topicSubscriptions.set(topic, subscriptionInfo);

    // 이미 연결된 상태라면 즉시 구독 시도
    if (this.controller && this.controller.isConnected()) {
      this._activateSubscription(topic);
    }
  }

  public async onAfterConnect(): Promise<void> {
    // 연결 후 모든 등록된 토픽을 활성화
    for (const topic of this.topicSubscriptions.keys()) {
      await this._activateSubscription(topic);
    }
  }

  public async onAfterDisconnect(): Promise<void> {
    // 임시 구독 토픽들만 제거, 영구 구독은 유지
    const temporaryTopics = this.getTemporaryTopics();
    for (const topic of temporaryTopics) {
      this.topicSubscriptions.delete(topic);
    }
  }
}

// 사용법
const controller = new StompNetworkController(stompClient);
const topicPlugin = new TopicPlugin();

controller.addPlugin(topicPlugin); // 플러그인 등록

// 연결 전에 토픽 등록 가능
topicPlugin.subscribeTopic("/topic/persistent", TopicSubscriptionType.PERSISTENT);
topicPlugin.subscribeTopic("/topic/temporary", TopicSubscriptionType.TEMPORARY);

await controller.connect(config); // 연결 시 등록된 토픽들이 자동으로 구독됨
```

---

## 📁 폴더별 사용 목적과 가이드라인

### **`src/app/`**
```
app/
├── providers/          # 의존성 주입 컨테이너
│   ├── UnityProvider.tsx    # Unity 서비스 제공
│   ├── ThemeProvider.tsx    # 테마 관리
│   └── AuthProvider.tsx     # 인증 관리
├── config/            # 애플리케이션 설정
│   ├── container.ts        # IoC 컨테이너 설정
│   └── constants.ts        # 전역 상수
└── App.tsx           # 메인 애플리케이션 컴포넌트
```

**사용 원칙:**
- Singleton 패턴으로 전역 상태 관리
- Dependency Injection으로 서비스 제공
- Factory 패턴으로 Provider 생성

### **`src/pages/`**
```
pages/
├── GamePage/          # 게임 페이지
│   ├── GamePage.tsx        # 페이지 컴포넌트
│   ├── GamePageController.ts  # 페이지 로직
│   └── useGamePage.ts      # 페이지 훅
├── InvitePage/        # 초대 페이지
└── shared/            # 공통 페이지 컴포넌트
    ├── PageLayout.tsx      # 페이지 레이아웃
    └── PageHeader.tsx      # 페이지 헤더
```

**사용 원칙:**
- Template Method 패턴으로 페이지 구조 통일
- Observer 패턴으로 라우팅 상태 관찰
- Controller 클래스로 페이지 로직 분리

### **`src/widgets/`**
```
widgets/
├── game-view/         # Unity 게임 뷰
│   ├── UnityView.tsx       # UI 컴포넌트
│   ├── UnityViewController.ts  # 위젯 컨트롤러
│   └── hooks/              # 위젯 전용 훅
├── game-controls/     # 게임 컨트롤
└── shared/            # 공통 위젯 컴포넌트
```

**사용 원칙:**
- Composite 패턴으로 위젯 조합
- Strategy 패턴으로 렌더링 방식 변경
- MVC 패턴으로 로직과 뷰 분리

### **`src/features/`**
```
features/
├── unity-integration/ # Unity 통합 기능
│   ├── api/               # API 레이어
│   │   ├── UnityRepository.ts
│   │   └── UnityAPI.ts
│   ├── model/             # 기능 모델
│   │   ├── UnitySession.ts
│   │   └── UnityEvent.ts
│   ├── services/          # 기능 서비스
│   │   └── UnityIntegrationService.ts
│   ├── ui/                # 기능 UI
│   │   ├── UnityGameContainer.tsx
│   │   └── UnityControls.tsx
│   └── index.ts          # 기능 진입점
├── multiplayer/       # 멀티플레이어 기능
└── analytics/         # 분석 기능
```

**사용 원칙:**
- Facade 패턴으로 복잡한 하위 시스템 단순화
- Repository 패턴으로 데이터 액세스 추상화
- Service Layer 패턴으로 비즈니스 로직 캡슐화

### **`src/entities/`**
```
entities/
├── unity/             # Unity 도메인
│   ├── model/             # 도메인 모델
│   │   ├── UnityGame.ts        # 집합 루트
│   │   ├── GameSession.ts      # 엔티티
│   │   └── PlayerId.ts         # 값 객체
│   ├── services/          # 도메인 서비스
│   │   ├── UnityGameService.ts
│   │   └── SessionManager.ts
│   ├── events/            # 도메인 이벤트
│   │   ├── GameStartedEvent.ts
│   │   └── SessionEndedEvent.ts
│   └── errors/            # 도메인 예외
│       ├── GameStateError.ts
│       └── SessionError.ts
├── user/              # 사용자 도메인
└── payment/           # 결제 도메인
```

**사용 원칙:**
- Domain Model 패턴으로 풍부한 도메인 모델
- Aggregate Root 패턴으로 일관성 경계 관리
- Value Object 패턴으로 불변 값 모델링
- Domain Event 패턴으로 도메인 이벤트 처리

### **`src/shared/`**
```
shared/
├── ui/                # 공통 UI 컴포넌트
│   ├── Button/
│   ├── Modal/
│   └── Form/
├── lib/               # 유틸리티 라이브러리
│   ├── utils.ts           # 순수 함수 유틸리티
│   ├── types.ts           # 공통 타입
│   ├── errors.ts          # 에러 클래스들
│   └── validators.ts      # 검증 함수들
├── hooks/             # 공통 React 훅
│   ├── useLocalStorage.ts
│   ├── useDebounce.ts
│   └── useUnityGame.ts
├── infrastructure/    # 인프라스트럭처
│   ├── http/             # HTTP 클라이언트
│   ├── storage/          # 저장소 어댑터
│   └── unity/            # Unity 어댑터들
└── constants/         # 공통 상수
```

**사용 원칙:**
- Utility 클래스로 순수 함수 제공
- Adapter 패턴으로 외부 시스템 통합
- Helper 패턴으로 공통 기능 제공

---

## 🚀 실제 개발 워크플로우

### **1. 새 기능 개발 단계**

```typescript
// 1단계: entities에서 도메인 모델 정의
// entities/payment/model/Payment.ts
export class Payment {
  constructor(
    private _id: PaymentId,
    private _amount: Money,
    private _method: PaymentMethod
  ) {}

  public process(): PaymentResult {
    // 비즈니스 규칙 검증
    if (this._amount.isZero()) {
      throw new InvalidPaymentError('Payment amount cannot be zero');
    }
    // 결제 처리 로직
    return this._method.process(this._amount);
  }
}

// 2단계: features에서 기능 구현
// features/payment/services/PaymentService.ts
export class PaymentService {
  constructor(
    private _paymentRepository: PaymentRepository,
    private _paymentProcessor: PaymentProcessor
  ) {}

  public async processPayment(paymentData: PaymentData): Promise<PaymentResult> {
    const payment = new Payment(
      PaymentId.generate(),
      new Money(paymentData.amount),
      PaymentMethod.fromString(paymentData.method)
    );

    const result = payment.process();
    await this._paymentRepository.save(payment);
    return result;
  }
}

// 3단계: widgets에서 UI 구현
// widgets/payment-form/PaymentForm.tsx
export const PaymentForm: React.FC = () => {
  const paymentService = usePaymentService();
  
  const handlePayment = async (data: PaymentFormData) => {
    const result = await paymentService.processPayment(data);
    // UI 업데이트
  };

  return (
    <form onSubmit={handlePayment}>
      {/* 폼 필드들 */}
    </form>
  );
};

// 4단계: pages에서 페이지 구성
// pages/CheckoutPage.tsx
export const CheckoutPage: React.FC = () => {
  return (
    <PageLayout>
      <CheckoutHeader />
      <PaymentForm />
      <CheckoutSummary />
    </PageLayout>
  );
};
```

### **2. 의존성 주입 설정**

```typescript
// app/config/container.ts
export class DIContainer {
  private static _instance: DIContainer;
  private _services = new Map<string, any>();

  public static getInstance(): DIContainer {
    if (!DIContainer._instance) {
      DIContainer._instance = new DIContainer();
    }
    return DIContainer._instance;
  }

  public register<T>(token: string, factory: () => T): void {
    this._services.set(token, factory);
  }

  public resolve<T>(token: string): T {
    const factory = this._services.get(token);
    if (!factory) {
      throw new Error(`Service ${token} not registered`);
    }
    return factory();
  }
}

// 서비스 등록
const container = DIContainer.getInstance();

container.register('UnityRepository', () => new InMemoryUnityRepository());
container.register('UnityLoader', () => new WebGLUnityLoader());
container.register('UnityGameService', () => 
  new UnityGameService(
    container.resolve('UnityRepository'),
    container.resolve('UnityLoader')
  )
);
```

### **3. 에러 처리 전략**

```typescript
// shared/lib/errors/ErrorBoundary.ts
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  private _errorHandler: ErrorHandler;

  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
    this._errorHandler = new ErrorHandler();
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this._errorHandler.handle(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

// shared/lib/errors/ErrorHandler.ts
export class ErrorHandler {
  private _strategies = new Map<string, ErrorHandlingStrategy>();

  constructor() {
    this._strategies.set('UnityLoadError', new UnityErrorStrategy());
    this._strategies.set('NetworkError', new NetworkErrorStrategy());
    this._strategies.set('ValidationError', new ValidationErrorStrategy());
  }

  public handle(error: Error, context?: any): void {
    const strategy = this._strategies.get(error.constructor.name);
    if (strategy) {
      strategy.handle(error, context);
    } else {
      // 기본 에러 처리
      console.error('Unhandled error:', error);
    }
  }
}
```

---

## ✅ 체크리스트

### **새 컴포넌트/클래스 생성 시**
- [ ] 단일 책임 원칙 준수 (하나의 역할만 담당)
- [ ] 적절한 FSD 레이어 선택
- [ ] 인터페이스 먼저 정의 후 구현
- [ ] 의존성 주입 패턴 적용
- [ ] 에러 처리 전략 포함

### **코드 리뷰 시**
- [ ] SOLID 원칙 준수 확인
- [ ] 적절한 디자인 패턴 사용
- [ ] FSD 레이어 규칙 준수
- [ ] 타입 안전성 확보
- [ ] 테스트 용이성 고려

이 가이드를 따라 개발하면 **확장 가능하고 유지보수하기 쉬운** Unity XR Game 프로젝트를 구축할 수 있습니다.