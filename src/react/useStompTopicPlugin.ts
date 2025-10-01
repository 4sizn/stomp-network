/**
 * @TODO: AI가 짜준건데, 필요성을 못느낌 사용하지 말것
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { IMessage } from "@stomp/stompjs";
import { Subscription } from "rxjs";
import {
  StompWebSocketClient,
  StompNetworkController,
  TopicPlugin,
  ConnectionState,
  StompClientConfig,
  TopicSubscriptionInfo,
} from "../lib";

export interface UseStompTopicPluginOptions {
  config: StompClientConfig;
  autoConnect?: boolean;
  persistentTopics?: string[];
}

export interface UseStompTopicPluginReturn {
  connectionState: ConnectionState;
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  sendMessage: (topic: string, message: unknown) => void;
  subscribeTopic: (topic: string) => void;
  unsubscribeTopic: (topic: string) => void;
  listenToTopic: (
    topic: string,
    onMessage: (message: IMessage) => void
  ) => () => void;
  getSubscribedTopics: () => string[];
  getAllTopicInfo: () => TopicSubscriptionInfo[];
  controller: StompNetworkController | null;
  topicPlugin: TopicPlugin | null;
}

/**
 * TopicPlugin을 사용하는 STOMP 클라이언트를 위한 React Hook
 * 고급 토픽 관리 기능을 제공합니다.
 *
 * @example
 * ```typescript
 * const {
 *   connectionState,
 *   isConnected,
 *   subscribeTopic,
 *   listenToTopic,
 *   sendMessage
 * } = useStompTopicPlugin({
 *   config: {
 *     brokerURL: 'ws://localhost:8080/ws',
 *     connectHeaders: {
 *       Authorization: 'Bearer token'
 *     }
 *   },
 *   autoConnect: true,
 *   persistentTopics: ['/topic/common/broadcast']
 * });
 *
 * // 연결 전에도 토픽 구독 등록 가능
 * useEffect(() => {
 *   subscribeTopic('/topic/notifications');
 * }, []);
 *
 * // 특정 토픽 메시지 리스닝
 * useEffect(() => {
 *   if (isConnected) {
 *     const unsubscribe = listenToTopic('/topic/notifications', (message) => {
 *       console.log('Notification:', message.body);
 *     });
 *     return unsubscribe;
 *   }
 * }, [isConnected]);
 * ```
 */
export const useStompTopicPlugin = (
  options: UseStompTopicPluginOptions
): UseStompTopicPluginReturn => {
  const { config, autoConnect = false, persistentTopics = [] } = options;

  const controllerRef = useRef<StompNetworkController | null>(null);
  const topicPluginRef = useRef<TopicPlugin | null>(null);
  const subscriptionsRef = useRef<Subscription[]>([]);

  const [connectionState, setConnectionState] = useState<ConnectionState>(
    ConnectionState.DISCONNECTED
  );

  // Initialize controller with TopicPlugin
  useEffect(() => {
    const stompClient = new StompWebSocketClient();
    const controller = new StompNetworkController(stompClient);
    const topicPlugin = new TopicPlugin();

    controllerRef.current = controller;
    topicPluginRef.current = topicPlugin;

    // Register plugin
    controller.addPlugin(topicPlugin);

    // Subscribe to connection state changes
    const connectionStateSub =
      controller.connectionState.subscribe(setConnectionState);
    subscriptionsRef.current.push(connectionStateSub);

    // Register persistent topics
    persistentTopics.forEach((topic) => {
      topicPlugin.subscribeTopic(topic);
    });

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

      topicPluginRef.current = null;
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

  const subscribeTopic = useCallback((topic: string) => {
    if (topicPluginRef.current) {
      topicPluginRef.current.subscribeTopic(topic);
    }
  }, []);

  const unsubscribeTopic = useCallback((topic: string) => {
    if (topicPluginRef.current) {
      topicPluginRef.current.unsubscribeTopic(topic);
    }
  }, []);

  const listenToTopic = useCallback(
    (topic: string, onMessage: (message: IMessage) => void) => {
      if (!topicPluginRef.current) {
        return () => {};
      }

      const messageSubscription = topicPluginRef.current
        .getTopicMessages(topic)
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

  const getSubscribedTopics = useCallback(() => {
    return topicPluginRef.current?.getSubscribedTopics() || [];
  }, []);

  const getAllTopicInfo = useCallback(() => {
    return topicPluginRef.current?.getAllTopicInfo() || [];
  }, []);

  return {
    connectionState,
    isConnected: connectionState === ConnectionState.CONNECTED,
    isConnecting:
      connectionState === ConnectionState.CONNECTING ||
      connectionState === ConnectionState.RECONNECTING,
    connect,
    disconnect,
    sendMessage,
    subscribeTopic,
    unsubscribeTopic,
    listenToTopic,
    getSubscribedTopics,
    getAllTopicInfo,
    controller: controllerRef.current,
    topicPlugin: topicPluginRef.current,
  };
};
