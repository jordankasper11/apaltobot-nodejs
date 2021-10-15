import { Channel, Client, CommandInteraction, Intents, TextChannel } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { VatsimClient } from '../vatsim/vatsim-client';
import { DiscordUser, DiscordUserManager } from './discord-users';

interface Config {
    applicationId: string;
    channelId: string;
    publicKey: string;
    serverId: string;
    token: string;
}

enum Commands {
    VatsimLink = 'vatsimlink',
    VatsimUnlink = 'vatsimunlink'
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

    async start(): Promise<void> {
        console.info('Discord bot starting');

        await this.registerCommands();

        const client = new Client({
            intents: [Intents.FLAGS.GUILDS]
        });

        await client.login(this.config.token);

        client.once('ready', () => this.onReady(client));

        client.on('interactionCreate', (interaction) => {
            if (!interaction.isCommand())
                return;

            return this.onCommand(interaction);
        });
    }

    private async registerCommands(): Promise<void> {
        const commands = [
            new SlashCommandBuilder()
                .setName(Commands.VatsimLink)
                .setDescription('Link your VATSIM account')
                .addIntegerOption(option => option.setName('cid').setDescription('VATSIM CID').setRequired(true)),
            new SlashCommandBuilder()
                .setName(Commands.VatsimUnlink)
                .setDescription('Unlink your VATSIM account')
        ].map(c => c.toJSON());

        const rest = new REST({ version: '9' }).setToken(this.config.token);

        try {
            await rest.put(Routes.applicationGuildCommands(this.config.applicationId, this.config.serverId), { body: commands });

            console.info('Registered Discord commands');
        } catch (error) {
            console.error('Error registering Discord commands', error);

            throw error;
        }
    }

    private async onReady(client: Client): Promise<void> {
        console.info('Discord bot connected');

        await this.vatsimClient.scheduleUpdate();

        const channel = client.channels.cache.get(this.config.channelId)!;

        if (!channel)
            throw new Error(`Channel ${this.config.channelId} not found`);

        if (channel.deleted)
            throw new Error(`Channel ${this.config.channelId} is deleted`);

        if (!(channel instanceof TextChannel))
            throw new Error(`Channel ${this.config.channelId} is not a text channel`);
    }

    private onCommand(interaction: CommandInteraction): Promise<void> {
        switch (interaction.commandName) {
            case Commands.VatsimLink:
                return this.onVatsimLinkCommand(interaction);
            case Commands.VatsimUnlink:
                return this.onVatsimUnlinkCommand(interaction);
            default:
                throw new Error(`Unsupported Discord command: ${interaction.commandName}`);
        }
    }

    private async onVatsimLinkCommand(interaction: CommandInteraction): Promise<void> {
        const cid = interaction.options.getInteger('cid');

        const discordUser: DiscordUser = {
            id: interaction.member!.user.id,
            username: interaction.member!.user.username,
            vatsimId: cid!
        };

        await this.userManager.saveUser(discordUser);

        await interaction.reply({
            content: 'Thanks for your linking your account! Your VATSIM activity will be included on the status board within a few minutes.',
            ephemeral: true
        });
    }

    private async onVatsimUnlinkCommand(interaction: CommandInteraction): Promise<void> {
        await this.userManager.deleteDiscordUser(interaction.member!.user.id);

        await interaction.reply({
            content: 'Your VATSIM activity will be removed from the status board within a few minutes.',
            ephemeral: true
        });
    }
}