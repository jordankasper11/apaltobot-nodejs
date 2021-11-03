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

export class AviationConfig extends BaseConfig {
    readonly airportsJsonPath: string;

    constructor(data?: {
        airportsJsonPath?: string
    }) {
        super();

        this.airportsJsonPath = this.setString('airportsJsonPath', data?.airportsJsonPath ?? process.env.AVIATION_AIRPORTS_JSON_PATH)!;
    }
}

export interface DiscordServerConfig {
    readonly name: string;
    readonly guildId: string;
    readonly channelId: string;
    readonly adminRoleId: string;
}

export class DiscordConfig extends BaseConfig {
    readonly applicationId: string;
    readonly publicKey: string;
    readonly token: string;
    readonly updateListingInterval: number;
    readonly servers: Array<DiscordServerConfig>;

    constructor(data?: {
        applicationId?: string,
        publicKey?: string,
        token?: string,
        updateListingInterval?: number,
        servers?: Array<DiscordServerConfig>
    }) {
        super();

        this.applicationId = this.setString('applicationId', data?.applicationId ?? process.env.DISCORD_APPLICATION_ID)!;
        this.publicKey = this.setString('publicKey', data?.publicKey ?? process.env.DISCORD_PUBLIC_KEY)!;
        this.token = this.setString('token', data?.token ?? process.env.DISCORD_TOKEN)!;
        this.updateListingInterval = this.setNumber('updateListingInterval', data?.updateListingInterval ?? parseInt(process.env.DISCORD_UPDATE_LISTING_INTERVAL!), 60000)!;
        this.servers = []; // TODO: load from file, if empty pull from .env
    }
}

export class UsersConfig extends BaseConfig {
    readonly jsonPath: string;
    readonly saveInterval: number;

    constructor(data?: {
        jsonPath?: string,
        saveInterval?: number
    }) {
        super();

        this.jsonPath = this.setString('jsonPath', data?.jsonPath ?? process.env.USERS_JSON_PATH)!;
        this.saveInterval = this.setNumber('saveInterval', data?.saveInterval ?? parseInt(process.env.USERS_SAVE_INTERVAL!), 15000)!;
    }
}

export class VatsimConfig extends BaseConfig {
    readonly dataUrl: string;
    readonly dataRefreshInterval: number;

    constructor(data?: {
        dataUrl?: string,
        dataRefreshInterval?: number
    }) {
        super();

        this.dataUrl = this.setString('dataUrl', data?.dataUrl ?? process.env.VATSIM_DATA_URL, 'https://data.vatsim.net/v3/vatsim-data.json')!;
        this.dataRefreshInterval = this.setNumber('dataRefreshInterval', data?.dataRefreshInterval ?? parseInt(process.env.VATSIM_DATA_REFRESH_INTERVAL!), 120000)!;
    }
}

export class Config extends BaseConfig {
    readonly aviation: AviationConfig;
    readonly discord: DiscordConfig;
    readonly users: UsersConfig;
    readonly vatsim: VatsimConfig;

    constructor(data?: {
        aviation?: AviationConfig,
        discord?: DiscordConfig,
        users?: UsersConfig,
        vatsim?: VatsimConfig
    }) {
        super();

        this.aviation = data?.aviation ?? new AviationConfig();
        this.discord = data?.discord ?? new DiscordConfig();
        this.users = data?.users ?? new UsersConfig();
        this.vatsim = data?.vatsim ?? new VatsimConfig();
    }
}

export const aviationConfig = new AviationConfig();
export const discordConfig = new DiscordConfig();
export const usersConfig = new UsersConfig();
export const vatsimConfig = new VatsimConfig();

export const config = new Config({
    aviation: aviationConfig,
    discord: discordConfig,
    users: usersConfig,
    vatsim: vatsimConfig
});