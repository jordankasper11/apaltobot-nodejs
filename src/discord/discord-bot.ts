import { Channel, Client, Intents, TextChannel } from 'discord.js';
import { VatsimClient } from '../vatsim/vatsim-client';

interface Config {
    applicationId: string;
    channelId: string;
    publicKey: string;
    serverId: string;
    token: string;
}

const isTextChannel = (channel: Channel): channel is TextChannel => channel.isText();

export class DiscordBot {
    private vatsimClient: VatsimClient;
    private config: Config;

    constructor(vatsimClient: VatsimClient, config?: Config) {
        this.vatsimClient = vatsimClient;

        this.config = config ?? {
            applicationId: process.env.DISCORD_APPLICATION_ID!,
            channelId: process.env.DISCORD_CHANNEL_ID!,
            publicKey: process.env.DISCORD_PUBLIC_KEY!,
            serverId: process.env.DISCORD_SERVER_ID!,
            token: process.env.DISCORD_TOKEN!
        };
    }

    start(): void {
        const client = new Client({
            intents: [Intents.FLAGS.GUILDS]
        });

        client.login(this.config.token);

        client.once('ready', async () => {
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