/**
 * WebSocket Hook for Real-time Updates
 *
 * Provides real-time updates for:
 * - Price changes
 * - New transactions
 * - Token graduations
 * - New token launches
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Connection state management
 * - Message queue for offline resilience
 * - Heartbeat monitoring
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type WebSocketMessageType =
  | 'price_update'
  | 'transaction'
  | 'graduation'
  | 'new_token'
  | 'heartbeat'
  | 'subscribe'
  | 'unsubscribe';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: unknown;
  timestamp: number;
}

export interface PriceUpdateData {
  tokenAddress: string;
  price: string;
  priceChange: number;
  volume24h: string;
}

export interface TransactionData {
  id: string;
  type: 'buy' | 'sell';
  tokenAddress: string;
  tokenSymbol: string;
  amount: string;
  xlmAmount: string;
  userAddress: string;
  timestamp: number;
  txHash: string;
}

export interface GraduationData {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  pairAddress: string;
  timestamp: number;
}

export interface NewTokenData {
  tokenAddress: string;
  name: string;
  symbol: string;
  creator: string;
  imageUrl?: string;
  timestamp: number;
}

type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  onMessage?: (message: WebSocketMessage) => void;
  onPriceUpdate?: (data: PriceUpdateData) => void;
  onTransaction?: (data: TransactionData) => void;
  onGraduation?: (data: GraduationData) => void;
  onNewToken?: (data: NewTokenData) => void;
  onConnectionChange?: (state: ConnectionState) => void;
}

const DEFAULT_WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.astro-shiba.io/ws';
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_INTERVAL = 1000;
const MAX_RECONNECT_INTERVAL = 30000;
const HEARTBEAT_INTERVAL = 30000;

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = DEFAULT_WS_URL,
    autoConnect = true,
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS,
    reconnectInterval = INITIAL_RECONNECT_INTERVAL,
    heartbeatInterval = HEARTBEAT_INTERVAL,
    onMessage,
    onPriceUpdate,
    onTransaction,
    onGraduation,
    onNewToken,
    onConnectionChange,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [subscribedTokens, setSubscribedTokens] = useState<Set<string>>(new Set());

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<WebSocketMessage[]>([]);

  // Update connection state
  const updateConnectionState = useCallback((state: ConnectionState) => {
    setConnectionState(state);
    onConnectionChange?.(state);
  }, [onConnectionChange]);

  // Send message
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      // Queue message for later
      messageQueueRef.current.push(message);
    }
  }, []);

  // Process queued messages
  const processMessageQueue = useCallback(() => {
    while (messageQueueRef.current.length > 0) {
      const message = messageQueueRef.current.shift();
      if (message) {
        sendMessage(message);
      }
    }
  }, [sendMessage]);

  // Start heartbeat
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
    }

    heartbeatTimeoutRef.current = setInterval(() => {
      sendMessage({
        type: 'heartbeat',
        data: {},
        timestamp: Date.now(),
      });
    }, heartbeatInterval);
  }, [heartbeatInterval, sendMessage]);

  // Stop heartbeat
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  // Handle incoming message
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      setLastMessage(message);
      onMessage?.(message);

      // Route to specific handlers
      switch (message.type) {
        case 'price_update':
          onPriceUpdate?.(message.data as PriceUpdateData);
          break;
        case 'transaction':
          onTransaction?.(message.data as TransactionData);
          break;
        case 'graduation':
          onGraduation?.(message.data as GraduationData);
          break;
        case 'new_token':
          onNewToken?.(message.data as NewTokenData);
          break;
        case 'heartbeat':
          // Reset heartbeat timer
          break;
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }, [onMessage, onPriceUpdate, onTransaction, onGraduation, onNewToken]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    updateConnectionState('connecting');

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionState('connected');
        reconnectAttemptsRef.current = 0;
        startHeartbeat();
        processMessageQueue();

        // Re-subscribe to tokens
        subscribedTokens.forEach((tokenAddress) => {
          sendMessage({
            type: 'subscribe',
            data: { tokenAddress },
            timestamp: Date.now(),
          });
        });
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        updateConnectionState('disconnected');
        stopHeartbeat();

        // SAFETY: Clear any existing reconnection timeout before scheduling new one
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // Attempt reconnection
        if (reconnectAttemptsRef.current < reconnectAttempts) {
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectAttemptsRef.current),
            MAX_RECONNECT_INTERVAL
          );

          updateConnectionState('reconnecting');
          reconnectTimeoutRef.current = setTimeout(() => {
            // SAFETY: Check if component is still mounted (timeout ref is only cleared on unmount)
            if (reconnectTimeoutRef.current !== null) {
              reconnectAttemptsRef.current++;
              connect();
            }
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current.onmessage = handleMessage;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      updateConnectionState('disconnected');
    }
  }, [
    url,
    reconnectAttempts,
    reconnectInterval,
    updateConnectionState,
    startHeartbeat,
    stopHeartbeat,
    processMessageQueue,
    subscribedTokens,
    sendMessage,
    handleMessage,
  ]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    updateConnectionState('disconnected');
  }, [stopHeartbeat, updateConnectionState]);

  // Subscribe to token updates
  const subscribeToToken = useCallback((tokenAddress: string) => {
    setSubscribedTokens((prev) => new Set([...prev, tokenAddress]));

    sendMessage({
      type: 'subscribe',
      data: { tokenAddress },
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  // Unsubscribe from token updates
  const unsubscribeFromToken = useCallback((tokenAddress: string) => {
    setSubscribedTokens((prev) => {
      const next = new Set(prev);
      next.delete(tokenAddress);
      return next;
    });

    sendMessage({
      type: 'unsubscribe',
      data: { tokenAddress },
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  // Use ref to track if we should auto-connect (avoids circular dependency)
  const autoConnectRef = useRef(autoConnect);
  autoConnectRef.current = autoConnect;

  // Auto-connect on mount only - use refs to avoid infinite loops
  // The dependency array is intentionally empty to run only on mount/unmount
  useEffect(() => {
    if (autoConnectRef.current) {
      // Use setTimeout to ensure this runs after the component is fully mounted
      const timeoutId = setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          connect();
        }
      }, 0);

      return () => {
        clearTimeout(timeoutId);
        // Clean up on unmount
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        if (heartbeatTimeoutRef.current) {
          clearInterval(heartbeatTimeoutRef.current);
          heartbeatTimeoutRef.current = null;
        }
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - we want this to run once on mount

  return {
    connectionState,
    lastMessage,
    subscribedTokens,
    connect,
    disconnect,
    sendMessage,
    subscribeToToken,
    unsubscribeFromToken,
    isConnected: connectionState === 'connected',
    isConnecting: connectionState === 'connecting',
    isReconnecting: connectionState === 'reconnecting',
  };
}

/**
 * Simulated WebSocket for development/testing
 * Generates random events at regular intervals
 */
export function useSimulatedWebSocket(options: UseWebSocketOptions = {}) {
  const {
    onPriceUpdate,
    onTransaction,
    onGraduation,
    onNewToken,
    onConnectionChange,
  } = options;

  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    setConnectionState('connecting');
    onConnectionChange?.('connecting');

    // Simulate connection delay
    setTimeout(() => {
      setConnectionState('connected');
      onConnectionChange?.('connected');

      // Start generating events
      intervalRef.current = setInterval(() => {
        const eventType = Math.random();

        if (eventType < 0.6) {
          // Price update (60%)
          onPriceUpdate?.({
            tokenAddress: `CA${Math.random().toString(36).substr(2, 40).toUpperCase()}`,
            price: (Math.random() * 0.001).toFixed(7),
            priceChange: (Math.random() - 0.5) * 20,
            volume24h: (Math.random() * 100000).toFixed(0),
          });
        } else if (eventType < 0.9) {
          // Transaction (30%)
          const symbols = ['ASTRO', 'SHIBA', 'MOON', 'PEPE', 'BONK'];
          onTransaction?.({
            id: `tx-${Date.now()}`,
            type: Math.random() > 0.4 ? 'buy' : 'sell',
            tokenAddress: `CA${Math.random().toString(36).substr(2, 40).toUpperCase()}`,
            tokenSymbol: symbols[Math.floor(Math.random() * symbols.length)],
            amount: (Math.random() * 100000).toFixed(0),
            xlmAmount: (Math.random() * 1000).toFixed(0),
            userAddress: `G${Math.random().toString(36).substr(2, 55).toUpperCase()}`,
            timestamp: Date.now(),
            txHash: Math.random().toString(36).substr(2, 64),
          });
        } else if (eventType < 0.95) {
          // New token (5%)
          const names = ['Moon Dog', 'Space Cat', 'Rocket Frog', 'Star Fish'];
          const name = names[Math.floor(Math.random() * names.length)];
          onNewToken?.({
            tokenAddress: `CA${Math.random().toString(36).substr(2, 40).toUpperCase()}`,
            name,
            symbol: name.split(' ').map(w => w[0]).join(''),
            creator: `G${Math.random().toString(36).substr(2, 55).toUpperCase()}`,
            timestamp: Date.now(),
          });
        } else {
          // Graduation (5%)
          const symbols = ['ASTRO', 'SHIBA', 'MOON'];
          const symbol = symbols[Math.floor(Math.random() * symbols.length)];
          onGraduation?.({
            tokenAddress: `CA${Math.random().toString(36).substr(2, 40).toUpperCase()}`,
            tokenSymbol: symbol,
            tokenName: `${symbol} Token`,
            pairAddress: `CA${Math.random().toString(36).substr(2, 40).toUpperCase()}`,
            timestamp: Date.now(),
          });
        }
      }, 2000 + Math.random() * 3000);
    }, 500);
  }, [onConnectionChange, onPriceUpdate, onTransaction, onNewToken, onGraduation]);

  const disconnect = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setConnectionState('disconnected');
    onConnectionChange?.('disconnected');
  }, [onConnectionChange]);

  // Auto-connect on mount only - avoid infinite loop from connect/disconnect dependencies
  useEffect(() => {
    connect();
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally empty - run once on mount

  return {
    connectionState,
    connect,
    disconnect,
    isConnected: connectionState === 'connected',
  };
}

export default useWebSocket;
