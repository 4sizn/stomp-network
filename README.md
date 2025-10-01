# @rfice/stomp

A comprehensive STOMP WebSocket client library with React integration, built on top of [@stomp/stompjs](https://github.com/stomp-js/stompjs) and RxJS.

## 🚀 Features

- **Modern STOMP Client**: Built with TypeScript and RxJS for reactive programming
- **React Integration**: Ready-to-use React hooks for easy integration
- **Plugin System**: Extensible plugin architecture for advanced functionality
- **Connection Management**: Automatic reconnection with exponential backoff
- **Topic Management**: Advanced topic subscription with persistent subscriptions
- **TypeScript Support**: Full TypeScript definitions included
- **Observable Patterns**: RxJS-based reactive state management

## 📦 Installation

```bash
npm install @rfice/stomp
# or
yarn add @rfice/stomp
# or
bun install @rfice/stomp
```

### Peer Dependencies

```bash
npm install @stomp/stompjs rxjs react
```

## 🎯 Quick Start

### Basic Usage with React Hook

```typescript
import { useStompClient } from '@rfice/stomp';

function MyComponent() {
  const { connectionState, isConnected, subscribe, sendMessage } = useStompClient({
    config: {
      brokerURL: 'ws://localhost:8080/ws',
      connectHeaders: {
        Authorization: 'Bearer your-token'
      }
    },
    autoConnect: true
  });

  useEffect(() => {
    if (isConnected) {
      const unsubscribe = subscribe('/topic/messages', (message) => {
        console.log('Received:', message.body);
      });
      return unsubscribe;
    }
  }, [isConnected, subscribe]);

  const handleSend = () => {
    sendMessage('/app/chat', { text: 'Hello World!' });
  };

  return (
    <div>
      <p>Connection: {connectionState}</p>
      <button onClick={handleSend} disabled={!isConnected}>
        Send Message
      </button>
    </div>
  );
}
```

### Advanced Usage with Topic Plugin

```typescript
import { useStompTopicPlugin } from '@rfice/stomp';

function AdvancedComponent() {
  const {
    connectionState,
    isConnected,
    subscribeTopic,
    listenToTopic,
    sendMessage,
    getSubscribedTopics
  } = useStompTopicPlugin({
    config: {
      brokerURL: 'ws://localhost:8080/ws',
      connectHeaders: {
        Authorization: 'Bearer your-token'
      }
    },
    autoConnect: true,
    persistentTopics: ['/topic/notifications'] // Auto-subscribe on connect
  });

  // Subscribe to topic before connection
  useEffect(() => {
    subscribeTopic('/topic/chat');
  }, [subscribeTopic]);

  // Listen to specific topic messages
  useEffect(() => {
    if (isConnected) {
      const unsubscribe = listenToTopic('/topic/chat', (message) => {
        console.log('Chat message:', JSON.parse(message.body));
      });
      return unsubscribe;
    }
  }, [isConnected, listenToTopic]);

  return (
    <div>
      <p>Status: {connectionState}</p>
      <p>Subscribed topics: {getSubscribedTopics().join(', ')}</p>
      <button
        onClick={() => sendMessage('/app/chat', { user: 'me', text: 'Hi!' })}
        disabled={!isConnected}
      >
        Send Chat
      </button>
    </div>
  );
}
```

## 📚 Core API

### StompNetworkController

The main controller for STOMP connections:

```typescript
import { StompNetworkController, StompWebSocketClient } from '@rfice/stomp';

const stompClient = new StompWebSocketClient();
const controller = new StompNetworkController(stompClient);

// Connect
await controller.connect({
  brokerURL: 'ws://localhost:8080/ws',
  connectHeaders: { Authorization: 'Bearer token' },
  maxAttempts: 5,
  reconnectDelay: 3000
});

// Subscribe to messages
const subscription = controller.subscribe('/topic/updates');
subscription.subscribe(message => {
  console.log('Update:', message.body);
});

// Send message
controller.sendMessage('/app/update', { data: 'value' });

// Disconnect
await controller.disconnect();
```

### TopicPlugin

Advanced topic management:

```typescript
import { TopicPlugin } from '@rfice/stomp';

const topicPlugin = new TopicPlugin();
controller.addPlugin(topicPlugin);

// Subscribe to topic (works before connection)
topicPlugin.subscribeTopic('/topic/alerts');

// Get topic-specific message stream
const alertStream = topicPlugin.getTopicMessages('/topic/alerts');
alertStream.subscribe(message => {
  console.log('Alert:', message.body);
});

// Get all subscription info
const subscriptions = topicPlugin.getAllTopicInfo();
console.log('Active subscriptions:', subscriptions);
```

## 🔧 Configuration

### StompClientConfig

```typescript
interface StompClientConfig {
  brokerURL: string;
  connectHeaders?: Record<string, string>;
  disconnectHeaders?: Record<string, string>;
  heartbeatIncoming?: number;    // default: 4000ms
  heartbeatOutgoing?: number;    // default: 4000ms
  reconnectDelay?: number;       // default: 5000ms
  webSocketFactory?: () => WebSocket;
  debug?: (str: string) => void;
}
```

### Reconnection Settings

```typescript
interface ReconnectConfig {
  maxAttempts?: number;          // default: 10
  reconnectDelay?: number;       // default: 5000ms
  reconnectTimeMode?: 'INTERVAL' | 'EXPONENTIAL'; // default: 'EXPONENTIAL'
}
```

## 🪝 React Hooks API

### useStompClient

Basic STOMP functionality:

```typescript
const {
  connectionState,    // ConnectionState enum
  isConnected,        // boolean
  isConnecting,       // boolean
  connect,           // () => Promise<void>
  disconnect,        // () => Promise<void>
  sendMessage,       // (topic: string, message: unknown) => void
  subscribe,         // (topic: string, onMessage: (message: IMessage) => void) => () => void
  controller         // StompNetworkController | null
} = useStompClient(options);
```

### useStompTopicPlugin

Advanced topic management:

```typescript
const {
  connectionState,      // ConnectionState enum
  isConnected,         // boolean
  isConnecting,        // boolean
  connect,            // () => Promise<void>
  disconnect,         // () => Promise<void>
  sendMessage,        // (topic: string, message: unknown) => void
  subscribeTopic,     // (topic: string) => void
  unsubscribeTopic,   // (topic: string) => void
  listenToTopic,      // (topic: string, onMessage: (message: IMessage) => void) => () => void
  getSubscribedTopics, // () => string[]
  getAllTopicInfo,    // () => TopicSubscriptionInfo[]
  controller,         // StompNetworkController | null
  topicPlugin         // TopicPlugin | null
} = useStompTopicPlugin(options);
```

## 🔌 Plugin System

Create custom plugins by extending `AbstractPlugin`:

```typescript
import { AbstractPlugin } from '@rfice/stomp';

class MyCustomPlugin extends AbstractPlugin {
  public readonly name = "MyCustomPlugin";

  onConnect(): void {
    console.log('Custom plugin: Connected');
  }

  onDisconnect(): void {
    console.log('Custom plugin: Disconnected');
  }

  onMessage(destination: string, message: IMessage): void {
    console.log(`Custom plugin: Message on ${destination}`, message);
  }
}

// Register plugin
const plugin = new MyCustomPlugin();
controller.addPlugin(plugin);
```

## 🌐 Connection States

```typescript
enum ConnectionState {
  DISCONNECTED = "DISCONNECTED",
  CONNECTING = "CONNECTING",
  CONNECTED = "CONNECTED",
  RECONNECTING = "RECONNECTING",
  ERROR = "ERROR"
}
```

## 🚨 Error Handling

The library provides comprehensive error handling:

```typescript
// Connection errors
controller.connectionState.subscribe(state => {
  if (state === ConnectionState.ERROR) {
    console.error('Connection failed');
  }
});

// Message errors
controller.error$.subscribe(error => {
  console.error('STOMP Error:', error.message);
});

// Try-catch for connection attempts
try {
  await controller.connect(config);
} catch (error) {
  console.error('Failed to connect:', error);
}
```

## 🧪 Development & Testing

### Running the Demo

```bash
bun install
bun dev
```

Visit `http://localhost:3000` to see the interactive demo.

### Building the Library

```bash
# Build library for distribution
bun run build:lib

# Build demo application
bun run build

# Type checking
bun run type-check
```

### Testing

```bash
bun test
```

## 📁 Project Structure

```
network-stomp/
├── src/
│   ├── lib/                     # Core library code
│   │   ├── core/
│   │   │   ├── abstract/        # Abstract base classes
│   │   │   └── controllers/     # Network controllers and plugins
│   │   └── infrastructure/      # STOMP client implementations
│   ├── react/                   # React hooks
│   │   ├── useStompClient.ts
│   │   └── useStompTopicPlugin.ts
│   └── demo/                    # Demo application
└── dist/                        # Built library files
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [@stomp/stompjs](https://github.com/stomp-js/stompjs) - Core STOMP implementation
- [RxJS](https://rxjs.dev/) - Reactive programming library
- [React](https://reactjs.org/) - UI framework

## 📞 Support

For questions and support, please open an issue on GitHub.

---

Made with ❤️ by R-Support Team