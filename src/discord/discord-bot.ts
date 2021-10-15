import { Channel, Client, Intents, TextChannel } from 'discord.js';
import { VatsimClient } from '../vatsim/vatsim-client';
import { DiscordUserManager } from './discord-users';

interface Config {
    applicationId: string;
    channelId: string;
    publicKey: string;
    serverId: string;
    token: string;
}

const isTextChannel = (channel: Channel): channel is TextChannel => channel.isText();

export class DiscordBot {
    private config: Config;
    private userManager: DiscordUserManager;
    private vatsimClient: VatsimClient;    

    constructor(options?: {
        config?: Config,
        userManager?: DiscordUserManager,
        vatsimClient?: VatsimClient
    }) {
        this.config = options?.config ?? {
            applicationId: process.env.DISCORD_APPLICATION_ID!,
            channelId: process.env.DISCORD_CHANNEL_ID!,
            publicKey: process.env.DISCORD_PUBLIC_KEY!,
            serverId: process.env.DISCORD_SERVER_ID!,
            token: process.env.DISCORD_TOKEN!
        };

        this.userManager = options?.userManager ?? new DiscordUserManager();
        this.vatsimClient = options?.vatsimClient ?? new VatsimClient();
    }

    start(): void {
        console.info('Discord bot starting');

        const client = new Client({
            intents: [Intents.FLAGS.GUILDS]
        });

        client.login(this.config.token);

        client.once('ready', async () => {
            console.info('Discord bot connected');
            
            await this.vatsimClient.scheduleUpdate();

            const channel = client.channels.cache.get(this.config.channelId)!;

            if (!channel)
                throw new Error(`Channel ${this.config.channelId} not found`);

            if (channel.deleted)
                throw new Error(`Channel ${this.config.channelId} is deleted`);

            if (!(channel instanceof TextChannel))
                throw new Error(`Channel ${this.config.channelId} is not a text channel`);
        });
    }
}