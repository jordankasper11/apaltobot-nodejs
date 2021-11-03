/* eslint-disable @typescript-eslint/no-non-null-assertion */

import dotenv from 'dotenv';

dotenv.config();

abstract class BaseConfig {
    protected setNumber(propertyName: string, value?: number, defaultValue?: number, required = true): number | undefined {
        value = value && value != null && !Number.isNaN(value) ? value : defaultValue;

        if (required && !value)
            throw new Error(`${propertyName} is required`);

        return value;
    }

    protected setString(propertyName: string, value?: string, defaultValue?: string, required = true): string | undefined {
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

        this.airportsJsonPath = this.setString('airportsJsonPath', process.env.AVIATION_AIRPORTS_JSON_PATH)!;
    }
}

export interface DiscordServerConfig {
    readonly name: string;
    readonly guildId: string;
    readonly channelId: string;
    readonly adminRoleId: string;
}

export interface DiscordConfig {
    applicationId: string;
    publicKey: string;
    token: string;
    updateListingInterval: number;
    servers: Array<DiscordServerConfig>;
}

class DefaultDiscordConfig extends BaseConfig implements DiscordConfig {
    readonly applicationId: string;
    readonly publicKey: string;
    readonly token: string;
    readonly updateListingInterval: number;
    readonly servers: Array<DiscordServerConfig>;

    constructor() {
        super();

        this.applicationId = this.setString('applicationId', process.env.DISCORD_APPLICATION_ID)!;
        this.publicKey = this.setString('publicKey', process.env.DISCORD_PUBLIC_KEY)!;
        this.token = this.setString('token', process.env.DISCORD_TOKEN)!;
        this.updateListingInterval = this.setNumber('updateListingInterval', parseInt(process.env.DISCORD_UPDATE_LISTING_INTERVAL!), 60000)!;
        this.servers = []; // TODO: load from file, if empty pull from .env
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

        this.jsonPath = this.setString('jsonPath', process.env.USERS_JSON_PATH)!;
        this.saveInterval = this.setNumber('saveInterval', parseInt(process.env.USERS_SAVE_INTERVAL!), 15000)!;
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

        this.dataUrl = this.setString('dataUrl', process.env.VATSIM_DATA_URL, 'https://data.vatsim.net/v3/vatsim-data.json')!;
        this.dataRefreshInterval = this.setNumber('dataRefreshInterval', parseInt(process.env.VATSIM_DATA_REFRESH_INTERVAL!), 120000)!;
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