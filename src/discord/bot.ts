import { Channel, Client, Intents, TextChannel } from 'discord.js';

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

    constructor(config?: Config) {
        this.config = config ?? {
            applicationId: process.env.DISCORD_APPLICATIONID!,
            channelId: process.env.DISCORD_CHANNELID!,
            publicKey: process.env.DISCORD_PUBLICKEY!,
            serverId: process.env.DISCORD_SERVERID!,
            token: process.env.DISCORD_TOKEN!
        };
    }

    start(): void {
        const client = new Client({
            intents: [Intents.FLAGS.GUILDS]
        });

        client.login(this.config.token);

        client.once('ready', () => {
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