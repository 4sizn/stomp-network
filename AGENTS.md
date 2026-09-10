# @4sizn/stomp (stomp-network)

## DEPRECATED — DO NOT ADD FEATURES HERE

This repository was deprecated on 2026-09-10. It last received a commit on
2025-12-16 and v1.0.6 is the final release. The maintained successor is
**ws-pack** (`https://github.com/4sizn/ws-pack`, checked out locally at
`../ws-pack`).

If you were asked to add a feature, fix a defect, or refactor the library, stop
and confirm the target repository first. Work belongs in ws-pack unless the
request is explicitly about archiving, migrating, or documenting this tree.

## Before you read any code here

This repository has **no tests and no CI**, in any commit of its history. Every
behaviour described in `README.md` and under `docs/` is unverified. Treat the
code as a design record, not as a reference implementation.

`docs/MIGRATION.md` records what ws-pack replaces name for name, what has no
replacement at all (the React hooks and `TopicPlugin`'s topic registry), and the
known defects that should not be ported. Read it before copying anything out.

## Layout

```
src/
├── lib/index.ts                                  # public barrel
├── lib/core/abstract/AbstractController.ts
├── lib/core/controllers/network/
│   ├── StompNetworkController.ts                 # 718 lines
│   ├── plugins/{AbstractPlugin,TopicPlugin}.ts
│   ├── errors/                                   # six error classes
│   └── types/NetworkControllerTypes.ts
├── lib/infrastructure/webSocket/stomp/StompClient.ts   # 636 lines, one class
├── react/{useStompClient,useStompTopicPlugin}.ts       # no ws-pack equivalent
└── demo/StompTestDemo.tsx                              # 1,262 lines, not the library
```
