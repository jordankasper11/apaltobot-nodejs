/* eslint-disable @typescript-eslint/no-explicit-any */

export function logError(category: string, message: string, ...args: Array<any>): void {
    console.error(`${category}: ${message}`, ...args);
}

export function logGlobalError(message: string, ...args: Array<any>): void {
    console.error(message, ...args);
}

export function logInfo(category: string, message: string, ...args: Array<any>): void { 
    console.info(`${category}: ${message}`, ...args);
}

export function logGlobalInfo(message: string, ...args: Array<any>): void { 
    console.info(message, ...args);
}

export function logWarning(category: string, message: string, ...args: Array<any>): void {
    console.warn(`${category}: ${message}`, ...args);
}

export function logGlobalWarning(message: string, ...args: Array<any>): void {
    console.warn(message, ...args);
}

/* eslint-enable @typescript-eslint/no-explicit-any */
