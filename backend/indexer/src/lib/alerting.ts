/**
 * Alerting Utilities for Critical Indexer Events
 *
 * Uses structured logging + Prometheus metrics for production alerting.
 * Logs with severity=critical can trigger alerts via:
 * - CloudWatch Alarms
 * - Datadog Monitors
 * - Grafana Alert Rules
 * - External log aggregation webhooks
 */

import { logger } from './logger.js';
import { Counter, Gauge } from 'prom-client';
import { registry } from './metrics.js';

// ============================================================================
// Alert Metrics (Prometheus)
// ============================================================================

export const alertsTriggered = new Counter({
  name: 'indexer_alerts_triggered_total',
  help: 'Total number of critical alerts triggered',
  labelNames: ['alert_type', 'severity'],
  registers: [registry],
});

export const activeAlertsGauge = new Gauge({
  name: 'indexer_active_alerts',
  help: 'Number of currently active alerts',
  labelNames: ['alert_type'],
  registers: [registry],
});

// ============================================================================
// Alert Types
// ============================================================================

export type AlertSeverity = 'warning' | 'critical' | 'emergency';

export type AlertType =
  | 'dlq_event_abandoned'
  | 'dlq_threshold_exceeded'
  | 'gap_abandoned'
  | 'gap_threshold_exceeded'
  | 'stream_down'
  | 'database_error'
  | 'rpc_error';

export interface AlertContext {
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

// ============================================================================
// Alert Configuration
// ============================================================================

// Threshold for DLQ abandoned events before triggering threshold alert
const DLQ_ABANDONED_THRESHOLD = 5;

// Threshold for active gaps before triggering threshold alert
const GAP_ACTIVE_THRESHOLD = 3;

// ============================================================================
// Alert Functions
// ============================================================================

/**
 * Trigger a structured alert
 * This emits structured logs that can be picked up by alerting systems
 */
export function triggerAlert(context: AlertContext): void {
  const alertData = {
    ...context,
    timestamp: context.timestamp || new Date(),
    service: 'astro-indexer',
    // These fields help log aggregation systems identify alerts
    alert: true,
    severity: context.severity,
  };

  // Increment Prometheus counter
  alertsTriggered.inc({
    alert_type: context.alertType,
    severity: context.severity,
  });

  // Log based on severity
  switch (context.severity) {
    case 'emergency':
      logger.fatal(alertData, `ALERT [${context.alertType}]: ${context.message}`);
      break;
    case 'critical':
      logger.error(alertData, `ALERT [${context.alertType}]: ${context.message}`);
      break;
    case 'warning':
      logger.warn(alertData, `ALERT [${context.alertType}]: ${context.message}`);
      break;
  }
}

/**
 * Alert when a DLQ event is abandoned (max retries exceeded)
 */
export function alertDLQEventAbandoned(
  eventId: string,
  eventType: string,
  contract: string,
  errorMessage: string,
  retryCount: number
): void {
  triggerAlert({
    alertType: 'dlq_event_abandoned',
    severity: 'critical',
    message: `Event ${eventId} abandoned after ${retryCount} retries - manual intervention required`,
    metadata: {
      eventId,
      eventType,
      contract,
      errorMessage,
      retryCount,
      action: 'Review event in /dlq/list and retry manually or resolve',
    },
  });
}

/**
 * Alert when DLQ has too many abandoned events
 */
export function alertDLQThresholdExceeded(abandonedCount: number): void {
  if (abandonedCount >= DLQ_ABANDONED_THRESHOLD) {
    activeAlertsGauge.set({ alert_type: 'dlq_threshold_exceeded' }, 1);
    triggerAlert({
      alertType: 'dlq_threshold_exceeded',
      severity: 'emergency',
      message: `DLQ has ${abandonedCount} abandoned events - immediate attention required`,
      metadata: {
        abandonedCount,
        threshold: DLQ_ABANDONED_THRESHOLD,
        action: 'Check /dlq/stats and investigate root cause of failures',
      },
    });
  } else {
    activeAlertsGauge.set({ alert_type: 'dlq_threshold_exceeded' }, 0);
  }
}

/**
 * Alert when a ledger gap is abandoned
 */
export function alertGapAbandoned(
  gapId: string,
  contractName: string,
  fromLedger: string,
  toLedger: string,
  gapSize: number,
  reason: string
): void {
  triggerAlert({
    alertType: 'gap_abandoned',
    severity: 'critical',
    message: `Ledger gap ${gapId} abandoned - ${gapSize} ledgers may have missing events`,
    metadata: {
      gapId,
      contractName,
      fromLedger,
      toLedger,
      gapSize,
      abandonReason: reason,
      action: 'Review gap in /gaps/list and attempt manual recovery',
    },
  });
}

/**
 * Alert when too many gaps are active
 */
export function alertGapThresholdExceeded(activeGaps: number): void {
  if (activeGaps >= GAP_ACTIVE_THRESHOLD) {
    activeAlertsGauge.set({ alert_type: 'gap_threshold_exceeded' }, 1);
    triggerAlert({
      alertType: 'gap_threshold_exceeded',
      severity: 'critical',
      message: `${activeGaps} ledger gaps detected - indexer may be missing events`,
      metadata: {
        activeGaps,
        threshold: GAP_ACTIVE_THRESHOLD,
        action: 'Check RPC connectivity and review /gaps/stats',
      },
    });
  } else {
    activeAlertsGauge.set({ alert_type: 'gap_threshold_exceeded' }, 0);
  }
}

/**
 * Alert when event stream is down for extended period
 */
export function alertStreamDown(contractName: string, downSinceMs: number): void {
  const downMinutes = Math.round(downSinceMs / 60000);
  activeAlertsGauge.set({ alert_type: 'stream_down' }, 1);

  triggerAlert({
    alertType: 'stream_down',
    severity: downMinutes > 5 ? 'emergency' : 'critical',
    message: `Event stream for ${contractName} has been down for ${downMinutes} minutes`,
    metadata: {
      contractName,
      downSinceMs,
      downMinutes,
      action: 'Check RPC URL and Stellar network status',
    },
  });
}

/**
 * Clear stream down alert
 */
export function clearStreamDownAlert(): void {
  activeAlertsGauge.set({ alert_type: 'stream_down' }, 0);
}

/**
 * Alert on critical database errors
 */
export function alertDatabaseError(operation: string, error: Error): void {
  triggerAlert({
    alertType: 'database_error',
    severity: 'critical',
    message: `Database error during ${operation}: ${error.message}`,
    metadata: {
      operation,
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      action: 'Check database connectivity and logs',
    },
  });
}

/**
 * Alert on RPC errors
 */
export function alertRPCError(operation: string, error: Error, rpcUrl?: string): void {
  triggerAlert({
    alertType: 'rpc_error',
    severity: 'warning',
    message: `RPC error during ${operation}: ${error.message}`,
    metadata: {
      operation,
      rpcUrl: rpcUrl?.replace(/\/\/.*@/, '//***@'), // Mask credentials
      errorName: error.name,
      errorMessage: error.message,
      action: 'Check Stellar RPC status and connectivity',
    },
  });
}

logger.info('Alerting utilities initialized');
