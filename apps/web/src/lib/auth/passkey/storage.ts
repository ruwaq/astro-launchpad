/**
 * Passkey Local Storage Implementation
 *
 * Stores passkey account information in browser localStorage
 * In production, consider IndexedDB for better performance with large datasets
 */

'use client';

import type {
  IPasskeyStorage,
  PasskeyAccount,
  StoredPasskeyCredential,
} from './types';

const STORAGE_PREFIX = 'astro_passkey_';
const ACCOUNTS_KEY = `${STORAGE_PREFIX}accounts`;
const CREDENTIALS_KEY = `${STORAGE_PREFIX}credentials`;

/**
 * Local storage implementation for passkey data
 */
export class LocalPasskeyStorage implements IPasskeyStorage {
  async storeCredential(
    credentialId: string,
    credential: StoredPasskeyCredential
  ): Promise<void> {
    const credentials = await this.getAllCredentials();
    credentials[credentialId] = credential;
    localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
  }

  async getCredential(credentialId: string): Promise<StoredPasskeyCredential | null> {
    const credentials = await this.getAllCredentials();
    return credentials[credentialId] || null;
  }

  async storeAccount(account: PasskeyAccount): Promise<void> {
    const accounts = await this.getAllAccounts();
    accounts[account.stellarAddress] = account;
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  async getAccountByAddress(stellarAddress: string): Promise<PasskeyAccount | null> {
    const accounts = await this.getAllAccounts();
    return accounts[stellarAddress] || null;
  }

  async getAccountByCredentialId(credentialId: string): Promise<PasskeyAccount | null> {
    const accounts = await this.listAccounts();
    return accounts.find((acc) => acc.credentialId === credentialId) || null;
  }

  async listAccounts(): Promise<PasskeyAccount[]> {
    const accounts = await this.getAllAccounts();
    return Object.values(accounts);
  }

  async removeAccount(stellarAddress: string): Promise<void> {
    const accounts = await this.getAllAccounts();
    delete accounts[stellarAddress];
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }

  async updateLastUsed(credentialId: string): Promise<void> {
    const account = await this.getAccountByCredentialId(credentialId);
    if (account) {
      account.lastUsedAt = Date.now();
      await this.storeAccount(account);
    }
  }

  // ========== Private Helpers ==========

  private async getAllAccounts(): Promise<Record<string, PasskeyAccount>> {
    const data = localStorage.getItem(ACCOUNTS_KEY);
    return data ? JSON.parse(data) : {};
  }

  private async getAllCredentials(): Promise<Record<string, StoredPasskeyCredential>> {
    const data = localStorage.getItem(CREDENTIALS_KEY);
    return data ? JSON.parse(data) : {};
  }
}

/**
 * Clear all passkey data (use with caution!)
 */
export function clearAllPasskeyData(): void {
  localStorage.removeItem(ACCOUNTS_KEY);
  localStorage.removeItem(CREDENTIALS_KEY);
}
