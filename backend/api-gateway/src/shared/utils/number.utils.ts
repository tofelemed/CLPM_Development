/**
 * Utility functions for safe number operations and type conversion
 * Handles string-to-number conversion from database results
 */

/**
 * Safely converts a value to a number, returning null if conversion fails
 * @param value - Value to convert (can be string, number, null, undefined)
 * @returns number | null
 */
export function toNumber(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return isNaN(value) || !isFinite(value) ? null : value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined' || trimmed.toLowerCase() === 'nan') {
      return null;
    }
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) || !isFinite(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Safely converts a value to a number with a fallback default
 * @param value - Value to convert
 * @param defaultValue - Default value if conversion fails (default: 0)
 * @returns number
 */
export function toNumberOrDefault(value: any, defaultValue: number = 0): number {
  const result = toNumber(value);
  return result !== null ? result : defaultValue;
}

/**
 * Converts a numeric value to percentage string with specified decimals
 * @param value - Numeric value (0-1 range)
 * @param decimals - Number of decimal places (default: 1)
 * @returns string like "85.0%" or "N/A" if invalid
 */
export function toPercentage(value: any, decimals: number = 1): string {
  const num = toNumber(value);
  if (num === null || typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
    return 'N/A';
  }
  const result = num * 100;
  if (isNaN(result) || !isFinite(result)) {
    return 'N/A';
  }
  return `${result.toFixed(decimals)}%`;
}

/**
 * Formats a number to fixed decimal places, returns "N/A" if invalid
 * @param value - Value to format
 * @param decimals - Number of decimal places
 * @returns string
 */
export function formatNumber(value: any, decimals: number = 2): string {
  const num = toNumber(value);
  if (num === null || typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
    return 'N/A';
  }
  return num.toFixed(decimals);
}

/**
 * Safely performs arithmetic operations, returns null if any operand is invalid
 * @param operation - Operation function
 * @param values - Values to operate on
 * @returns number | null
 */
export function safeArithmetic(operation: (...args: number[]) => number, ...values: any[]): number | null {
  const numbers = values.map(toNumber);
  if (numbers.some(n => n === null)) {
    return null;
  }
  const result = operation(...(numbers as number[]));
  return isNaN(result) || !isFinite(result) ? null : result;
}

/**
 * Calculates average of an array of values, ignoring invalid values
 * @param values - Array of values
 * @returns number | null
 */
export function calculateAverage(values: any[]): number | null {
  const validNumbers = values.map(toNumber).filter(n => n !== null) as number[];
  if (validNumbers.length === 0) {
    return null;
  }
  const sum = validNumbers.reduce((a, b) => a + b, 0);
  return sum / validNumbers.length;
}

/**
 * Calculates sum of an array of values, ignoring invalid values
 * @param values - Array of values
 * @returns number
 */
export function calculateSum(values: any[]): number {
  const validNumbers = values.map(toNumber).filter(n => n !== null) as number[];
  return validNumbers.reduce((a, b) => a + b, 0);
}

/**
 * Finds minimum value in an array, ignoring invalid values
 * @param values - Array of values
 * @returns number | null
 */
export function findMin(values: any[]): number | null {
  const validNumbers = values.map(toNumber).filter(n => n !== null) as number[];
  if (validNumbers.length === 0) {
    return null;
  }
  return Math.min(...validNumbers);
}

/**
 * Finds maximum value in an array, ignoring invalid values
 * @param values - Array of values
 * @returns number | null
 */
export function findMax(values: any[]): number | null {
  const validNumbers = values.map(toNumber).filter(n => n !== null) as number[];
  if (validNumbers.length === 0) {
    return null;
  }
  return Math.max(...validNumbers);
}

/**
 * Checks if a value is a valid number (not NaN, not Infinity, not null/undefined)
 * @param value - Value to check
 * @returns boolean
 */
export function isValidNumber(value: any): boolean {
  return toNumber(value) !== null;
}

/**
 * Converts database row numeric fields to actual numbers
 * Useful for processing query results
 * @param row - Database row object
 * @param fields - Array of field names to convert
 * @returns Converted row object
 */
export function convertRowNumbers<T extends Record<string, any>>(
  row: T,
  fields: (keyof T)[]
): T {
  const converted = { ...row };
  fields.forEach(field => {
    if (field in converted) {
      converted[field] = toNumber(converted[field]) as any;
    }
  });
  return converted;
}

/**
 * Converts array of database rows, converting specified numeric fields
 * @param rows - Array of database rows
 * @param fields - Array of field names to convert
 * @returns Array of converted rows
 */
export function convertRowsNumbers<T extends Record<string, any>>(
  rows: T[],
  fields: (keyof T)[]
): T[] {
  return rows.map(row => convertRowNumbers(row, fields));
}

