/**
 * Admin Event Handler
 *
 * Handles admin-related events from the SAC Factory contract:
 * - RoleGranted: When a role is assigned to an account
 * - RoleRevoked: When a role is removed from an account
 * - OwnershipTransferred: When contract ownership changes
 * - ContractPaused: When contract is paused
 * - ContractUnpaused: When contract is unpaused
 */

import { PrismaClient } from '@astroshibapop/shared/prisma';
import { scValToNative } from '@stellar/stellar-sdk';
import { logger } from '../../lib/logger.js';

// Admin event types from contract
const ADMIN_EVENT_TOPICS = {
  ROLE_GRANTED: 'rolegranted',
  ROLE_REVOKED: 'rolerevoked',
  OWNERSHIP_TRANSFERRED: 'ownershiptransferred',
  CONTRACT_PAUSED: 'contractpaused',
  CONTRACT_UNPAUSED: 'contractunpaused',
};

export class AdminEventHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Main entry point for admin event handling
   */
  async handleEvent(event: any): Promise<void> {
    try {
      const eventType = this.getEventType(event);

      logger.info(`Processing admin event: ${eventType}`, {
        ledger: event.ledger,
        txHash: event.id,
      });

      switch (eventType) {
        case ADMIN_EVENT_TOPICS.ROLE_GRANTED:
          await this.handleRoleGranted(event);
          break;
        case ADMIN_EVENT_TOPICS.ROLE_REVOKED:
          await this.handleRoleRevoked(event);
          break;
        case ADMIN_EVENT_TOPICS.OWNERSHIP_TRANSFERRED:
          await this.handleOwnershipTransferred(event);
          break;
        case ADMIN_EVENT_TOPICS.CONTRACT_PAUSED:
          await this.handleContractPaused(event);
          break;
        case ADMIN_EVENT_TOPICS.CONTRACT_UNPAUSED:
          await this.handleContractUnpaused(event);
          break;
        default:
          logger.warn(`Unknown admin event type: ${eventType}`);
      }
    } catch (error) {
      logger.error('Error handling admin event', {
        error,
        eventId: event.id,
      });
      throw error;
    }
  }

  /**
   * Handle RoleGranted event
   */
  private async handleRoleGranted(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Role granted: ${data.role} to ${data.account}`);

    await this.prisma.adminEvent.create({
      data: {
        type: 'ROLE_GRANTED',
        account: this.scValToString(data.account),
        role: this.scValToString(data.role),
        executedBy: this.scValToString(data.account), // Grantor not in event, use account
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  /**
   * Handle RoleRevoked event
   */
  private async handleRoleRevoked(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Role revoked: ${data.role} from ${data.account}`);

    await this.prisma.adminEvent.create({
      data: {
        type: 'ROLE_REVOKED',
        account: this.scValToString(data.account),
        role: this.scValToString(data.role),
        executedBy: this.scValToString(data.account),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  /**
   * Handle OwnershipTransferred event
   */
  private async handleOwnershipTransferred(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Ownership transferred: ${data.previous_owner} -> ${data.new_owner}`);

    await this.prisma.adminEvent.create({
      data: {
        type: 'OWNERSHIP_TRANSFERRED',
        account: this.scValToString(data.new_owner),
        previousOwner: this.scValToString(data.previous_owner),
        newOwner: this.scValToString(data.new_owner),
        executedBy: this.scValToString(data.previous_owner),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  /**
   * Handle ContractPaused event
   */
  private async handleContractPaused(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.warn(`Contract PAUSED by ${data.paused_by}`);

    await this.prisma.adminEvent.create({
      data: {
        type: 'CONTRACT_PAUSED',
        account: 'contract',
        executedBy: this.scValToString(data.paused_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  /**
   * Handle ContractUnpaused event
   */
  private async handleContractUnpaused(event: any): Promise<void> {
    const data = this.parseEventData(event);

    logger.info(`Contract UNPAUSED by ${data.unpaused_by}`);

    await this.prisma.adminEvent.create({
      data: {
        type: 'CONTRACT_UNPAUSED',
        account: 'contract',
        executedBy: this.scValToString(data.unpaused_by),
        timestamp: this.getTimestamp(event),
        txHash: event.id,
        blockNumber: event.ledger?.toString(),
      },
    });
  }

  // Helper methods

  private parseEventData(event: any): any {
    try {
      const value = event.value;
      if (!value) return {};

      // If already decoded, return as-is
      if (typeof value === 'object' && !value._switch && !value._arm) {
        return value;
      }

      // Decode XDR
      return scValToNative(value);
    } catch (error) {
      logger.error('Error parsing admin event data:', error);
      return {};
    }
  }

  private getEventType(event: any): string {
    try {
      const topics = event.topic || [];
      if (topics.length === 0) return 'unknown';

      const firstTopic = topics[0];
      if (typeof firstTopic === 'string') {
        return firstTopic.toLowerCase();
      }

      try {
        const decoded = scValToNative(firstTopic);
        return (typeof decoded === 'string' ? decoded : decoded?.toString() || 'unknown').toLowerCase();
      } catch {
        return firstTopic?.toString()?.toLowerCase() || 'unknown';
      }
    } catch {
      return 'unknown';
    }
  }

  private getTimestamp(event: any): Date {
    if (event.ledger_close_time) {
      return new Date(event.ledger_close_time);
    }
    return new Date();
  }

  private scValToString(scVal: any): string {
    if (!scVal) return '';
    if (typeof scVal === 'string') return scVal;
    if (typeof scVal === 'number') return scVal.toString();
    if (scVal.toString) return scVal.toString();
    return String(scVal);
  }
}

export default AdminEventHandler;
