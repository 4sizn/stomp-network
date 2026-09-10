# Migration: @4sizn/stomp (stomp-network) → ws-pack

- **Deprecated:** 2026-09-10
- **Final release:** v1.0.6
- **Last commit:** `d3d54c6 chore(#0): wip`, 2025-12-16
- **Successor:** [ws-pack](https://github.com/4sizn/ws-pack)

This repository is frozen. It is kept for history and for the React and topic
material listed below, which has no replacement anywhere else. Nothing new
should be built here.

## Lineage

Three repositories have held this library. Each was a restart, not a refactor:

| Generation | Repository | Active | Ended as |
|---|---|---|---|
| 1 | **stomp-network** (this repo, `@4sizn/stomp` v1.0.6) | – 2025-12-16 | Deprecated 2026-09-10 |
| 2 | `ws-network` | 2026-03-02 – 2026-09-10 | Deprecated 2026-09-10 |
| 3 | `ws-pack` | 2026-09-10 – | Maintained |

Generation 2 was written from scratch and inherited nothing from this tree; it
dropped the controller, the reconnect policy, the React layer and the error
types, and built a plugin pipeline and a test suite instead. Generation 3
returns to this repository's layering and adds the type discipline generation 2
developed. So the design here was not abandoned — but the code was, and it was
never re-read on the way through.

## What ws-pack replaces, name for name

| Here | In ws-pack | Note |
|---|---|---|
| `AbstractController` | `core/abstract/AbstractController.ts` | Same role. |
| `StompNetworkController` (718 lines) | `core/controllers/NetworkController.ts` (`WebSocketController`, `StompWebSocketController`, `WindowWebSocketController`) | Split per transport instead of one STOMP-specific class. |
| `AbstractPlugin` | `core/plugins/AbstractPlugin.ts` | Hooks narrowed; `onError` added. See the gap below. |
| `ConnectionState` enum | `core/ConnectionState.ts` | Same five states, own module. |
| `ReconnectConfig`, `ReconnectInfo`, reconnect bookkeeping inside the adapter | `core/Reconnect.ts` (`ReconnectTimeMode`, `ReconnectConfig`, `ReconnectInfo`) | Extracted out of the adapter into its own policy module. |
| `StompStompError`, `StompWebsocketError` | `core/errors/` | Carried over. |
| `StompConnectionError`, `StompSubscriptionError`, `StompMessageError`, `StompReconnectionError` | — | **Dropped.** Four of the six error types have no counterpart. |
| `StompWebSocketClientAdapter` (636 lines, one class) | `core/adapters/{WebSocketClientAdapter,WindowWebSocketClientAdapter,StompWebSocketClientAdapter}.ts` | The god class is split; `send()` now takes typed options (`StompSendOptions`) rather than throwing. |
| `subscribe(destination)` / `subscribeWithFilter` | `StompWebSocketClient.subscribe(destination, headers?)` | Returns an `Observable<IMessage>` that re-subscribes after reconnect and tears the STOMP subscription down on unsubscribe. |

## Not carried over — no replacement exists

1. **The React integration — 368 lines, and nothing in ws-pack replaces it.**
   - `src/react/useStompClient.ts` (153) — `UseStompClientOptions`,
     `UseStompClientReturn`.
   - `src/react/useStompTopicPlugin.ts` (215) — `UseStompTopicPluginOptions`,
     `UseStompTopicPluginReturn`.
   ws-pack depends on React 19 and ships a React demo under `src/demo/`, but its
   library surface (`src/lib/index.ts`) exports no hooks. A consumer there wires
   RxJS streams into components by hand.
2. **`TopicPlugin` — 280 lines of subscription bookkeeping.** Persistent versus
   transient topics (`isPersistent`, `getPersistentTopics()`), per-topic message
   streams (`getTopicMessages(topic)`), introspection
   (`getSubscribedTopics()`, `getTopicInfo()`, `getAllTopicInfo()`), and
   activation and deactivation driven by the connect and disconnect hooks so
   subscriptions come back after a reconnect. ws-pack re-subscribes on reconnect
   inside `StompWebSocketController`, which covers the recovery case — but the
   registry, the persistent/transient distinction and the introspection surface
   are gone.
3. **The send-side and message-side plugin hooks.** Both this repository and
   ws-pack give plugins `onAttach`/`onDetach` and the four connect and
   disconnect hooks. Neither gives a plugin a hook on outbound sends or inbound
   messages. `ws-network` did (`onBeforeSend` could transform the payload,
   `onAfterSend`, `onMessage`, with protocol send options carried through the
   pipeline) — see that repository's `docs/MIGRATION.md`. If a ws-pack plugin
   ever needs to see traffic, that is where the design already exists.
4. **The published-package machinery.** `standard-version`, `CHANGELOG.md`,
   `tsconfig.build.json`, the `dist` `exports` map and the npm release
   workflow. ws-pack is `private: true` at `0.0.1` and publishes nothing.
5. **The guide documents.** `docs/FSD_OOP_DEVELOPMENT_GUIDE.md`,
   `docs/TOPIC_PLUGIN_GUIDE.md`, `docs/QUICK_REFERENCE.md` and
   `docs/E2E_TEST_SCENARIOS.md`. The last one is a scenario list that was never
   executed — see below.

## Known problems here — do not port these

Anything copied out of this tree should be read against this list first.

- **No tests. Not one, in any generation of this repository.** v1.0.6 was
  published to npm without a test file. `docs/E2E_TEST_SCENARIOS.md` describes
  scenarios that were never automated. No CI workflow either.
- **`StompWebSocketClientAdapter` is a god class** — 636 lines, one class, more
  than twenty-five public methods (`getReconnectInfo`, `resetReconnectState`,
  `setMaxReconnectAttempts`, `waitForConnection`, …).
- **`private subscriptions = new Map<string, any>()`** — the subscription
  registry is untyped.
- **`WebSocketClient`'s dependency is optional** —
  `constructor(private client?: WebSocketClientAdapter<T, C>)` allows a client
  with no adapter, so the class has no enforceable invariant.
- **The library logs to the console directly.** `StompNetworkController` calls
  `console.log`; there is no injected logger.
- **`AbstractController` is an empty shell** — two members, no behaviour.
- **The six error classes are 13–19 lines of identical boilerplate each.**
- **TypeScript 4.6.** ws-pack is on 5.9.
- **43% of the tree is demo code** — `src/demo/StompTestDemo.tsx` (1,262 lines)
  and `src/lib/.../StompClient.example.ts` (513) out of 4,066 total.

## Still to do outside this repository

Marking `deprecated` in `package.json` does not warn anyone installing from
npm. The published package needs `npm deprecate "@4sizn/stomp" "<message>"` run
against the registry, which is a separate, deliberate action.
