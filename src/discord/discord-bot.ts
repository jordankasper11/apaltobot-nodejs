import { Channel, Client, Intents, TextChannel } from 'discord.js';
import { DiscordConfig } from '../config';
import { AviationUtility } from '../aviation/aviation-utility';
import { VatsimClient } from '../vatsim/vatsim-client';
import { User, UserManager } from '../users/user-manager';
import { DiscordServer } from './discord-server';

const isTextChannel = (channel: Channel): channel is TextChannel => channel.isText();

export class DiscordBot {
    private readonly config: DiscordConfig;
    private readonly aviationUtility: AviationUtility;
    private readonly userManager: UserManager;
    private readonly vatsimClient: VatsimClient;
    private servers: Array<DiscordServer> = [];
    private client?: Client;

    constructor(config: DiscordConfig, aviationUtility: AviationUtility, userManager: UserManager, vatsimClient: VatsimClient) {
        this.config = config;
        this.aviationUtility = aviationUtility;
        this.userManager = userManager;
        this.vatsimClient = vatsimClient;
    }

    async start(): Promise<void> {
        console.info('Discord bot is starting');

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
        console.info('Discord bot is stopping');

        await Promise.all(this.servers.map(s => s.stop()));

        this.servers = [];
        this.client?.destroy();
    }

    private async onReady(client: Client): Promise<void> {
        console.info('Discord bot is now connected');

        for (const serverConfig of this.config.servers) {
            const server = new DiscordServer(
                serverConfig,
                this.config.applicationId,
                this.config.token,
                this.userManager,
                this.vatsimClient,
                this.aviationUtility
            );

            await server.start(client, this.config.updateListingInterval);

            this.servers.push(server);
        }
    }
}