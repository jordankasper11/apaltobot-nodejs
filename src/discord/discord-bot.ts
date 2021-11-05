import { Client, Intents } from 'discord.js';
import { DiscordConfig } from '../config';
import { AviationUtility } from '../aviation/aviation-utility';
import { VatsimClient } from '../vatsim/vatsim-client';
import { UserManagerFactory } from '../users/user-manager';
import { DiscordGuild } from './discord-guild';
import { inject, injectable } from 'inversify';
import { TYPES } from '../inversify';
import { logGlobalInfo } from '../logging';

@injectable()
export class DiscordBot {
    private readonly config: DiscordConfig;
    private readonly aviationUtility: AviationUtility;
    private readonly userManagerFactory: UserManagerFactory;
    private readonly vatsimClient: VatsimClient;
    private guilds: Array<DiscordGuild> = [];
    private client?: Client;

    constructor(
        @inject(TYPES.DiscordConfig) config: DiscordConfig,
        aviationUtility: AviationUtility,
        userManagerFactory: UserManagerFactory,
        vatsimClient: VatsimClient
    ) {
        this.config = config;
        this.aviationUtility = aviationUtility;
        this.userManagerFactory = userManagerFactory;
        this.vatsimClient = vatsimClient;
    }

    async start(): Promise<void> {
        logGlobalInfo('Discord bot is starting');

        const client = new Client({
            intents: [
                Intents.FLAGS.GUILDS,
                Intents.FLAGS.GUILD_MEMBERS
            ]
        });

        client.once('ready', () => this.onReady(client));

        await client.login(this.config.token);

        this.client = client;
    }

    async stop(): Promise<void> {
        logGlobalInfo('Discord bot is stopping');

        await Promise.all(this.guilds.map(g => g.stop()));

        this.guilds = [];
        this.client?.destroy();
    }

    private async onReady(client: Client): Promise<void> {
        logGlobalInfo('Discord bot is now connected');

        for (const guildConfig of this.config.guilds) {
            const guild = new DiscordGuild(
                guildConfig,
                this.config.applicationId,
                this.config.token,
                this.userManagerFactory,
                this.vatsimClient,
                this.aviationUtility
            );

            await guild.start(client, this.config.updateListingInterval);

            this.guilds.push(guild);
        }
    }
}