/* eslint-disable @typescript-eslint/no-non-null-assertion */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { logGlobalError, logGlobalInfo } from './logging';

dotenv.config();

abstract class BaseConfig {
    protected getNumber(propertyName: string, value?: number, defaultValue?: number, required = true): number | undefined {
        value = value && !Number.isNaN(value) ? value : defaultValue;

        if (required && !value)
            throw new Error(`${propertyName} is required`);

        return value;
    }

    protected getString(propertyName: string, value?: string, defaultValue?: string, required = true): string | undefined {
        value = value ?? defaultValue;

        if (required && !value)
            throw new Error(`${propertyName} is required`);

        return value;
    }
}

export interface AviationConfig {
    airportsJsonPath: string;
}

class DefaultAviationConfig extends BaseConfig implements AviationConfig {
    readonly airportsJsonPath: string;

    constructor() {
        super();

        this.airportsJsonPath = this.getString('AVIATION_AIRPORTS_JSON_PATH', process.env.AVIATION_AIRPORTS_JSON_PATH)!;
    }
}

export interface DiscordGuildConfig {
    readonly name: string;
    readonly guildId: string;
    readonly channelId: string;
    readonly adminRoleId?: string;
    readonly displayFlights: boolean;
    readonly displayControllers: boolean;
}

export interface DiscordConfig {
    applicationId: string;
    publicKey: string;
    token: string;
    updateListingInterval: number;
    guilds: Array<DiscordGuildConfig>;
}

class DefaultDiscordConfig extends BaseConfig implements DiscordConfig {
    readonly applicationId: string;
    readonly publicKey: string;
    readonly token: string;
    readonly updateListingInterval: number;
    guilds: Array<DiscordGuildConfig> = [];

    constructor() {
        super();

        this.applicationId = this.getString('DISCORD_APPLICATION_ID', process.env.DISCORD_APPLICATION_ID)!;
        this.publicKey = this.getString('DISCORD_PUBLIC_KEY', process.env.DISCORD_PUBLIC_KEY)!;
        this.token = this.getString('DISCORD_TOKEN', process.env.DISCORD_TOKEN)!;
        this.updateListingInterval = this.getNumber('DISCORD_UPDATE_LISTING_INTERVAL', parseInt(process.env.DISCORD_UPDATE_LISTING_INTERVAL!), 60000)!;

        this.loadGuilds();
    }

    private loadGuilds(): void {
        const jsonPath = this.getString('DISCORD_GUILDS_JSON_PATH', process.env.DISCORD_GUILDS_JSON_PATH)!;

        try {
            const json = readFileSync(jsonPath, { encoding: 'utf-8' });
            const servers: Array<DiscordGuildConfig> = JSON.parse(json);

            this.guilds = servers;

            logGlobalInfo('Loaded Discord server data');
        } catch (error) {
            logGlobalError('Error loading Discord server data', error);

            throw error;
        }
    }
}

export interface UsersConfig {
    readonly jsonPath: string;
    readonly saveInterval: number;
}

class DefaultUsersConfig extends BaseConfig implements UsersConfig {
    readonly jsonPath: string;
    readonly saveInterval: number;

    constructor() {
        super();

        this.jsonPath = this.getString('jsonPath', process.env.USERS_JSON_PATH)!;
        this.saveInterval = this.getNumber('saveInterval', parseInt(process.env.USERS_SAVE_INTERVAL!), 15000)!;
    }
}

export interface VatsimConfig {
    readonly dataUrl: string;
    readonly dataRefreshInterval: number;
}

class DefaultVatsimConfig extends BaseConfig implements VatsimConfig {
    readonly dataUrl: string;
    readonly dataRefreshInterval: number;

    constructor() {
        super();

        this.dataUrl = this.getString('dataUrl', process.env.VATSIM_DATA_URL, 'https://data.vatsim.net/v3/vatsim-data.json')!;
        this.dataRefreshInterval = this.getNumber('dataRefreshInterval', parseInt(process.env.VATSIM_DATA_REFRESH_INTERVAL!), 120000)!;
    }
}

export const aviationConfig = new DefaultAviationConfig();
export const discordConfig = new DefaultDiscordConfig();
export const usersConfig = new DefaultUsersConfig();
export const vatsimConfig = new DefaultVatsimConfig();

export const defaultConfig = {
    aviation: aviationConfig,
    discord: discordConfig,
    users: usersConfig,
    vatsim: vatsimConfig
};
