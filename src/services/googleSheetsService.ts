import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

interface GoogleSheetsConfig {
  clientEmail: string;
  privateKey: string;
  spreadsheetId: string;
}

class GoogleSheetsService {
  private config: GoogleSheetsConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {}

  async initialize(config: GoogleSheetsConfig) {
    this.config = {
      ...config,
      privateKey: this.formatPrivateKey(config.privateKey),
    };
    await this.getAccessToken();
  }

  private formatPrivateKey(key: string): string {
    // Remove the header, footer, and newlines
    return key
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\n/g, '')
      .trim();
  }

  private async getAccessToken() {
    if (!this.config) {
      throw new Error('Google Sheets service not initialized');
    }

    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: await this.createJWT(),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get access token: ${error.error_description || response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = Date.now() + (data.expires_in * 1000);
      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      throw error;
    }
  }

  private async createJWT() {
    if (!this.config) {
      throw new Error('Google Sheets service not initialized');
    }

    const header = {
      alg: 'RS256',
      typ: 'JWT',
      kid: this.config.clientEmail,
    };

    const now = Math.floor(Date.now() / 1000);
    const claim = {
      iss: this.config.clientEmail,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    // Encode header and claim
    const encodedHeader = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const encodedClaim = btoa(JSON.stringify(claim)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    // Create the signature
    const signature = await this.sign(`${encodedHeader}.${encodedClaim}`);

    return `${encodedHeader}.${encodedClaim}.${signature}`;
  }

  private async sign(data: string): Promise<string> {
    if (!this.config) {
      throw new Error('Google Sheets service not initialized');
    }

    try {
      // Import the private key
      const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        this.base64ToArrayBuffer(this.config.privateKey),
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: { name: 'SHA-256' },
        },
        false,
        ['sign']
      );

      // Sign the data
      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        new TextEncoder().encode(data)
      );

      // Convert the signature to base64url
      return btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    } catch (error) {
      console.error('Error signing JWT:', error);
      throw error;
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async ensureSheetExists(sheetName: string) {
    if (!this.config) {
      throw new Error('Google Sheets service not initialized');
    }

    try {
      const accessToken = await this.getAccessToken();
      
      // First, get the spreadsheet to check if the sheet exists
      const spreadsheetResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!spreadsheetResponse.ok) {
        throw new Error('Failed to get spreadsheet info');
      }

      const spreadsheet = await spreadsheetResponse.json();
      const sheetExists = spreadsheet.sheets.some((sheet: any) => sheet.properties.title === sheetName);

      if (!sheetExists) {
        // Create the sheet if it doesn't exist
        const createSheetResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}:batchUpdate`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              requests: [{
                addSheet: {
                  properties: {
                    title: sheetName
                  }
                }
              }]
            }),
          }
        );

        if (!createSheetResponse.ok) {
          throw new Error('Failed to create sheet');
        }
      }
    } catch (error) {
      console.error('Error ensuring sheet exists:', error);
      throw error;
    }
  }

  private flattenObject(obj: any, prefix = ''): any {
    return Object.keys(obj).reduce((acc: any, key: string) => {
      const pre = prefix.length ? prefix + '_' : '';
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (Array.isArray(obj[key])) {
          if (obj[key].length === 0) {
            // Handle empty arrays
            acc[pre + key] = '';
          } else if (typeof obj[key][0] === 'object' || Array.isArray(obj[key][0])) {
            // For arrays of objects or arrays of arrays, JSON stringify them
            acc[pre + key] = JSON.stringify(obj[key]);
          } else {
            // For simple arrays, join with commas
            acc[pre + key] = obj[key].join(', ');
          }
        } else {
          // Recursively flatten nested objects
          const flattened = this.flattenObject(obj[key], pre + key);
          // Only add non-empty flattened objects
          if (Object.keys(flattened).length > 0) {
            Object.assign(acc, flattened);
          } else {
            acc[pre + key] = '';
          }
        }
      } else if (Array.isArray(obj[key])) {
        acc[pre + key] =JSON.stringify(obj[key]);
      } else {
        // Handle primitive values
        acc[pre + key] = obj[key] === null || obj[key] === undefined ? '' : String(obj[key]);
      }
      
      return acc;
    }, {});
  }

  private async createRelatedSheets(sheetName: string, data: any[]) {
    if (!this.config) {
      throw new Error('Google Sheets service not initialized');
    }

    try {
      const accessToken = await this.getAccessToken();
      
      // Create a sheet for each related data type
      const relatedSheets = {
        'FormFields': 'formFields',
        'Attendees': 'attendees',
        'Events': 'events'
      };

      for (const [relatedSheetName, fieldName] of Object.entries(relatedSheets)) {
        // Extract related data
        const relatedData = data.flatMap(item => {
          if (item[fieldName] && Array.isArray(item[fieldName])) {
            return item[fieldName].map((relatedItem: any) => ({
              ...relatedItem,
              parentId: item.id // Add reference to parent
            }));
          }
          return [];
        });

        if (relatedData.length > 0) {
          // Create the related sheet if it doesn't exist
          await this.ensureSheetExists(relatedSheetName);
          
          // Sync the related data
          await this.syncData(relatedData, relatedSheetName);
        }
      }
    } catch (error) {
      console.error('Error creating related sheets:', error);
      throw error;
    }
  }

  private async getExistingData(sheetName: string) {
    if (!this.config) {
      throw new Error('Google Sheets service not initialized');
    }

    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${sheetName}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get existing data: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      return data.values || [];
    } catch (error) {
      console.error('Error getting existing data:', error);
      throw error;
    }
  }

  private async updateRow(sheetName: string, rowIndex: number, values: any[]) {
    if (!this.config) {
      throw new Error('Google Sheets service not initialized');
    }

    try {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${sheetName}!A${rowIndex + 1}:append?valueInputOption=RAW`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            values: [values],
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to update row: ${error.error?.message || response.statusText}`);
      }
    } catch (error) {
      console.error('Error updating row:', error);
      throw error;
    }
  }

  async syncData(data: any[], sheetName: string = 'Sheet1') {
    if (!this.config) {
      throw new Error('Google Sheets service not initialized');
    }

    if (!data || data.length === 0) {
      console.log(`No data to sync for sheet ${sheetName}`);
      return true;
    }

    try {
      // Ensure the sheet exists before trying to append data
      await this.ensureSheetExists(sheetName);
      
      const accessToken = await this.getAccessToken();
      
      // Create normalized tables for related data
      await this.createRelatedSheets(sheetName, data);
      
      // Flatten each object in the data array, excluding related data
      const flattenedData = data.map(item => {
        const { formFields, attendees, events, ...rest } = item;
        return this.flattenObject(rest);
      });
      
      // Ensure all objects have the same keys
      const headers = Object.keys(flattenedData[0]);
      
      // Get existing data
      const existingData = await this.getExistingData(sheetName);
      const existingHeaders = existingData[0] || [];
      const existingRows = existingData.slice(1);
      
      // Find the ID column index
      const idIndex = headers.indexOf('id');
      if (idIndex === -1) {
        throw new Error('No ID column found in data');
      }
      
      // Create a map of existing rows by ID
      const existingRowsMap = new Map();
      existingRows.forEach((row: any[], index: number) => {
        const id = row[idIndex];
        if (id) {
          existingRowsMap.set(id, index + 2); // +2 because of 0-based index and header row
        }
      });
      
      // Process each row
      for (const item of flattenedData) {
        const row: any[] = [];
        headers.forEach(header => {
          const value = item[header];
          row.push(value === null || value === undefined || value === '' ? '' : String(value));
        });
        
        const id = row[idIndex];
        if (existingRowsMap.has(id)) {
          // Update existing row
          await this.updateRow(sheetName, existingRowsMap.get(id), row);
        } else {
          // Append new row
          const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${sheetName}!A1:append?valueInputOption=RAW`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                values: [row],
              }),
            }
          );

          if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to append data: ${error.error?.message || response.statusText}`);
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
      throw error;
    }
  }

  async getData(sheetName: string = 'Sheet1') {
    if (!this.config) {
      throw new Error('Google Sheets service not initialized');
    }

    try {
      const accessToken = await this.getAccessToken();
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${sheetName}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to get data: ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const rows = data.values;
      if (!rows || rows.length === 0) {
        return [];
      }

      const headers = rows[0];
      return rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((header: string, index: number) => {
          obj[header] = row[index];
        });
        return obj;
      });
    } catch (error) {
      console.error('Error getting data from Google Sheets:', error);
      throw error;
    }
  }
}

export const googleSheetsService = new GoogleSheetsService(); 