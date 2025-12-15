/**
 * useWebSocket Hook - Usage Examples
 *
 * This file demonstrates various ways to use the useWebSocket hook
 * in your React components.
 */

import { useEffect, useState } from 'react';
import { useWebSocket } from './useWebSocket';

// =============================================================================
// EXAMPLE 1: Token Page - Subscribe to Single Token Updates
// =============================================================================

export function TokenPageExample({ tokenAddress }: { tokenAddress: string }) {
  const [price, setPrice] = useState<string>('0');
  const [recentTrades, setRecentTrades] = useState<any[]>([]);

  const { isConnected, subscribeToToken, unsubscribeFromToken } = useWebSocket({
    // Handle price updates
    onPriceUpdate: (data) => {
      console.log('Price update:', data);
      if (data.tokenAddress === tokenAddress) {
        setPrice(data.price);
      }
    },

    // Handle new trades
    onTransaction: (data) => {
      console.log('New trade:', data);
      if (data.tokenAddress === tokenAddress) {
        setRecentTrades((prev) => [data, ...prev].slice(0, 10));
      }
    },

    // Handle graduation
    onGraduation: (data) => {
      if (data.tokenAddress === tokenAddress) {
        alert(`${data.tokenSymbol} has graduated! 🎉`);
      }
    },
  });

  useEffect(() => {
    if (isConnected) {
      subscribeToToken(tokenAddress);
    }

    return () => {
      unsubscribeFromToken(tokenAddress);
    };
  }, [isConnected, tokenAddress, subscribeToToken, unsubscribeFromToken]);

  return (
    <div>
      <div>Connection: {isConnected ? '🟢' : '🔴'}</div>
      <div>Current Price: ${price}</div>
      <div>
        <h3>Recent Trades</h3>
        {recentTrades.map((trade, i) => (
          <div key={i}>
            {trade.type === 'buy' ? '🟢' : '🔴'} {trade.tokenAmount} tokens for{' '}
            {trade.xlmAmount} XLM
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// EXAMPLE 2: Global Feed - All Platform Activity
// =============================================================================

export function GlobalFeedExample() {
  const [feed, setFeed] = useState<any[]>([]);

  const { isConnected } = useWebSocket({
    // All new tokens
    onNewToken: (data) => {
      setFeed((prev) =>
        [
          {
            type: 'new_token',
            message: `New token launched: ${data.symbol}`,
            data,
            timestamp: data.timestamp,
          },
          ...prev,
        ].slice(0, 50)
      );
    },

    // All graduations
    onGraduation: (data) => {
      setFeed((prev) =>
        [
          {
            type: 'graduation',
            message: `${data.tokenSymbol} graduated to DEX!`,
            data,
            timestamp: data.timestamp,
          },
          ...prev,
        ].slice(0, 50)
      );
    },

    // All trades (be careful with volume!)
    onTransaction: (data) => {
      setFeed((prev) =>
        [
          {
            type: 'trade',
            message: `${data.type === 'buy' ? 'Bought' : 'Sold'} ${
              data.tokenSymbol
            }`,
            data,
            timestamp: data.timestamp,
          },
          ...prev,
        ].slice(0, 50)
      );
    },
  });

  return (
    <div>
      <h2>Live Activity Feed {isConnected ? '🟢' : '🔴'}</h2>
      <div className="feed">
        {feed.map((item, i) => (
          <div key={i} className={`feed-item ${item.type}`}>
            <span>{new Date(item.timestamp).toLocaleTimeString()}</span>
            <span>{item.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// EXAMPLE 3: Portfolio - Multiple Token Subscriptions
// =============================================================================

export function PortfolioExample({ holdings }: { holdings: string[] }) {
  const [prices, setPrices] = useState<Record<string, string>>({});

  const { isConnected, subscribeToToken, unsubscribeFromToken } = useWebSocket({
    onPriceUpdate: (data) => {
      setPrices((prev) => ({
        ...prev,
        [data.tokenAddress]: data.price,
      }));
    },
  });

  useEffect(() => {
    if (isConnected && holdings.length > 0) {
      // Subscribe to all holdings
      holdings.forEach((tokenAddress) => {
        subscribeToToken(tokenAddress);
      });

      return () => {
        // Unsubscribe on unmount or when holdings change
        holdings.forEach((tokenAddress) => {
          unsubscribeFromToken(tokenAddress);
        });
      };
    }
  }, [isConnected, holdings, subscribeToToken, unsubscribeFromToken]);

  const totalValue = holdings.reduce((sum, addr) => {
    return sum + parseFloat(prices[addr] || '0');
  }, 0);

  return (
    <div>
      <h2>Portfolio Value: ${totalValue.toFixed(2)}</h2>
      {holdings.map((addr) => (
        <div key={addr}>
          Token: {addr.slice(0, 8)}... - Price: ${prices[addr] || 'Loading...'}
        </div>
      ))}
    </div>
  );
}

// =============================================================================
// EXAMPLE 4: Trading Widget - Real-time Price Display
// =============================================================================

export function TradingWidgetExample({ tokenAddress }: { tokenAddress: string }) {
  const [price, setPrice] = useState<string>('0');
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [connectionState, setConnectionState] = useState<string>('disconnected');

  const { subscribeToToken, unsubscribeFromToken } = useWebSocket({
    onPriceUpdate: (data) => {
      if (data.tokenAddress === tokenAddress) {
        const newPrice = parseFloat(data.price);
        setPrice(data.price);
        setPriceHistory((prev) => [...prev, newPrice].slice(-20)); // Last 20 prices
      }
    },
    onConnectionChange: (state) => {
      setConnectionState(state);
    },
  });

  useEffect(() => {
    subscribeToToken(tokenAddress);
    return () => unsubscribeFromToken(tokenAddress);
  }, [tokenAddress, subscribeToToken, unsubscribeFromToken]);

  // Calculate price trend
  const trend =
    priceHistory.length >= 2
      ? priceHistory[priceHistory.length - 1] > priceHistory[0]
        ? 'up'
        : 'down'
      : 'neutral';

  return (
    <div className="trading-widget">
      <div className="connection-status">{connectionState}</div>
      <div className={`price ${trend}`}>
        ${parseFloat(price).toFixed(7)}
        {trend === 'up' ? ' 📈' : trend === 'down' ? ' 📉' : ''}
      </div>
      <div className="price-chart">
        {priceHistory.map((p, i) => (
          <div
            key={i}
            style={{
              height: `${(p / Math.max(...priceHistory)) * 100}%`,
              width: '5px',
              backgroundColor: '#fa9427',
            }}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// EXAMPLE 5: Custom Hook - useTokenPrice
// =============================================================================

/**
 * Custom hook that wraps useWebSocket for a specific use case
 */
export function useTokenPrice(tokenAddress: string) {
  const [price, setPrice] = useState<string | null>(null);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const { isConnected, subscribeToToken, unsubscribeFromToken } = useWebSocket({
    onPriceUpdate: (data) => {
      if (data.tokenAddress === tokenAddress) {
        setPrice(data.price);
        setPriceChange(data.priceChange || 0);
        setLoading(false);
      }
    },
  });

  useEffect(() => {
    if (isConnected) {
      subscribeToToken(tokenAddress);
    }
    return () => unsubscribeFromToken(tokenAddress);
  }, [isConnected, tokenAddress, subscribeToToken, unsubscribeFromToken]);

  return {
    price,
    priceChange,
    loading,
    isConnected,
  };
}

// Usage:
export function TokenPriceDisplayExample({ tokenAddress }: { tokenAddress: string }) {
  const { price, priceChange, loading } = useTokenPrice(tokenAddress);

  if (loading) return <div>Loading price...</div>;

  return (
    <div>
      <span className="price">${price}</span>
      <span className={priceChange >= 0 ? 'positive' : 'negative'}>
        {priceChange >= 0 ? '+' : ''}
        {priceChange.toFixed(2)}%
      </span>
    </div>
  );
}

// =============================================================================
// EXAMPLE 6: Notification System
// =============================================================================

export function NotificationSystemExample() {
  const [notifications, setNotifications] = useState<any[]>([]);

  const { isConnected } = useWebSocket({
    onGraduation: (data) => {
      // Show notification for graduations
      const notification = {
        id: Date.now(),
        type: 'graduation',
        title: 'Token Graduated!',
        message: `${data.tokenSymbol} (${data.tokenName}) has graduated to the DEX`,
        timestamp: data.timestamp,
      };

      setNotifications((prev) => [notification, ...prev]);

      // Browser notification (if permitted)
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico',
        });
      }
    },

    onNewToken: (data) => {
      const notification = {
        id: Date.now(),
        type: 'new_token',
        title: 'New Token!',
        message: `${data.symbol} just launched`,
        timestamp: data.timestamp,
      };

      setNotifications((prev) => [notification, ...prev]);
    },
  });

  const clearNotification = (id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="notification-system">
      <div className="status">
        {isConnected ? 'Live updates enabled' : 'Connecting...'}
      </div>
      <div className="notifications">
        {notifications.map((notification) => (
          <div key={notification.id} className={`notification ${notification.type}`}>
            <strong>{notification.title}</strong>
            <p>{notification.message}</p>
            <button onClick={() => clearNotification(notification.id)}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// EXAMPLE 7: Conditional Subscription
// =============================================================================

export function ConditionalSubscriptionExample() {
  const [watchingToken, setWatchingToken] = useState<string | null>(null);

  const { subscribeToToken, unsubscribeFromToken, subscribedTokens } = useWebSocket({
    onPriceUpdate: (data) => {
      console.log('Price update for watched token:', data);
    },
  });

  const watchToken = (tokenAddress: string) => {
    if (watchingToken) {
      unsubscribeFromToken(watchingToken);
    }
    subscribeToToken(tokenAddress);
    setWatchingToken(tokenAddress);
  };

  const stopWatching = () => {
    if (watchingToken) {
      unsubscribeFromToken(watchingToken);
      setWatchingToken(null);
    }
  };

  return (
    <div>
      <p>Currently watching: {watchingToken || 'None'}</p>
      <p>Total subscriptions: {subscribedTokens.size}</p>
      <button onClick={() => watchToken('CAXXX...')}>Watch Token A</button>
      <button onClick={() => watchToken('CBXXX...')}>Watch Token B</button>
      <button onClick={stopWatching}>Stop Watching</button>
    </div>
  );
}

// =============================================================================
// Best Practices
// =============================================================================

/**
 * 1. Always unsubscribe on component unmount:
 *    useEffect(() => {
 *      subscribeToToken(address);
 *      return () => unsubscribeFromToken(address);
 *    }, [address]);
 *
 * 2. Check connection state before showing data:
 *    {isConnected ? <LiveData /> : <StaticData />}
 *
 * 3. Limit feed size to prevent memory leaks:
 *    setFeed((prev) => [...prev, newItem].slice(0, MAX_ITEMS));
 *
 * 4. Debounce high-frequency updates:
 *    Use useDebounce or throttle for updates that fire often
 *
 * 5. Handle reconnection gracefully:
 *    Show a banner when reconnecting, auto-resubscribe when connected
 *
 * 6. Use custom hooks for common patterns:
 *    Create hooks like useTokenPrice, useTokenTrades, etc.
 *
 * 7. Test with slow networks:
 *    Throttle network in DevTools to test reconnection logic
 */
