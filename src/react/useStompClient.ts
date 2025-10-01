/**
 * @TODO: AI가 짜준건데, 필요성을 못느낌 사용하지 말것
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { IMessage } from "@stomp/stompjs";
import { Subscription } from "rxjs";
import {
  StompWebSocketClient,
  StompNetworkController,
  ConnectionState,
  StompClientConfig,
} from "../lib";

export interface UseStompClientOptions {
  config: StompClientConfig;
  autoConnect?: boolean;
}

export interface UseStompClientReturn {
  connectionState: ConnectionState;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (topic: string, message: unknown) => void;
  subscribe: (
    topic: string,
    onMessage: (message: IMessage) => void
  ) => () => void;
  controller: StompNetworkController | null;
}

/**
 * STOMP 클라이언트를 위한 React Hook
 *
 * @example
 * ```typescript
 * const { connectionState, isConnected, subscribe, sendMessage } = useStompClient({
 *   config: {
 *     brokerURL: 'ws://localhost:8080/ws',
 *     connectHeaders: {
 *       Authorization: 'Bearer token'
 *     }
 *   },
 *   autoConnect: true
 * });
 *
 * useEffect(() => {
 *   if (isConnected) {
 *     const unsubscribe = subscribe('/topic/messages', (message) => {
 *       console.log('Received:', message.body);
 *     });
 *     return unsubscribe;
 *   }
 * }, [isConnected]);
 * ```
 */
export const useStompClient = (
  options: UseStompClientOptions
): UseStompClientReturn => {
  const { config, autoConnect = false } = options;

  const controllerRef = useRef<StompNetworkController | null>(null);
  const subscriptionsRef = useRef<Subscription[]>([]);

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  );

  // Initialize controller
  useEffect(() => {
    const stompClient = new StompWebSocketClient();
    const controller = new StompNetworkController(stompClient);
    controllerRef.current = controller;

    // Subscribe to connection state changes
    const connectionStateSub =
      controller.connectionState.subscribe(setConnectionState);
    subscriptionsRef.current.push(connectionStateSub);

    // Auto-connect if enabled
    if (autoConnect) {
      controller.connect(config).catch(console.error);
    }

    return () => {
      // Cleanup subscriptions
      subscriptionsRef.current.forEach((sub) => sub.unsubscribe());
      subscriptionsRef.current = [];

      // Cleanup controller
      if (controllerRef.current) {
        controllerRef.current.destroy();
        controllerRef.current = null;
      }
    };
  }, []);

  const connect = useCallback(async () => {
    if (controllerRef.current && !controllerRef.current.isConnected()) {
      await controllerRef.current.connect(config);
    }
  }, [config]);

  const disconnect = useCallback(async () => {
    if (controllerRef.current && controllerRef.current.isConnected()) {
      await controllerRef.current.disconnect();
    }
  }, []);

  const sendMessage = useCallback((topic: string, message: unknown) => {
    if (controllerRef.current && controllerRef.current.isConnected()) {
      controllerRef.current.sendMessage(topic, message);
    }
  }, []);

  const subscribe = useCallback(
    (topic: string, onMessage: (message: IMessage) => void) => {
      if (!controllerRef.current) {
        return () => {};
      }

      const messageSubscription = controllerRef.current
        .subscribe(topic)
        .subscribe(onMessage);

      subscriptionsRef.current.push(messageSubscription);

      // Return unsubscribe function
      return () => {
        messageSubscription.unsubscribe();
        const index = subscriptionsRef.current.indexOf(messageSubscription);
        if (index > -1) {
          subscriptionsRef.current.splice(index, 1);
        }
      };
    },
    []
  );

  return {
    connectionState,
    isConnected: connectionState === ConnectionState.CONNECTED,
    isConnecting:
      connectionState === ConnectionState.CONNECTING ||
      connectionState === ConnectionState.RECONNECTING,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    controller: controllerRef.current,
  };
};
