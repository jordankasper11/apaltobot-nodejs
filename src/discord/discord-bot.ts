import { Channel, Client, CommandInteraction, Guild, GuildMember, Intents, Message, TextChannel } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { getDistance } from 'geolib';
import { DateTime } from 'luxon';
import { AviationUtility } from '../aviation/aviation-utility';
import { VatsimClient } from '../vatsim/vatsim-client';
import { User, UserManager } from '../users/user-manager';

interface Config {
    applicationId: string;
    channelId: string;
    guildId: string;
    publicKey: string;
    token: string;
    updateListingInterval: number;
}

enum Commands {
    VatsimLink = 'vatsimlink',
    VatsimUnlink = 'vatsimunlink'
}

const isTextChannel = (channel: Channel): channel is TextChannel => channel.isText();

export class DiscordBot {
    private config: Config;
    private aviationUtility: AviationUtility;
    private userManager: UserManager;
    private vatsimClient: VatsimClient;
    private updateListingTimer?: NodeJS.Timer;
    private listingMessage?: Message;

    constructor(options?: {
        config?: Config,
        aviationUtility?: AviationUtility,
        userManager?: UserManager,
        vatsimClient?: VatsimClient
    }) {
        this.config = options?.config ?? {
            applicationId: process.env.DISCORD_APPLICATION_ID!,
            channelId: process.env.DISCORD_CHANNEL_ID!,
            guildId: process.env.DISCORD_GUILD_ID!,
            publicKey: process.env.DISCORD_PUBLIC_KEY!,
            token: process.env.DISCORD_TOKEN!,
            updateListingInterval: parseInt(process.env.DISCORD_UPDATE_LISTING_INTERVAL!)
        };

        this.aviationUtility = options?.aviationUtility ?? new AviationUtility();
        this.userManager = options?.userManager ?? new UserManager();
        this.vatsimClient = options?.vatsimClient ?? new VatsimClient();
    }

    async start(): Promise<void> {
        console.info('Discord bot starting');

        await this.registerCommands();

        const client = new Client({
            intents: [
                Intents.FLAGS.GUILDS,
                Intents.FLAGS.GUILD_MEMBERS
            ]
        });

        client.once('ready', () => this.onReady(client));

        client.on('interactionCreate', (interaction) => {
            if (!interaction.isCommand())
                return;

            return this.onCommand(interaction);
        });

        await client.login(this.config.token);
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
            await rest.put(Routes.applicationGuildCommands(this.config.applicationId, this.config.guildId), { body: commands });

            console.info('Registered Discord commands');
        } catch (error) {
            console.error('Error registering Discord commands', error);

            throw error;
        }
    }

    private async onReady(client: Client): Promise<void> {
        console.info('Discord bot connected');

        const channel = client.channels.cache.get(this.config.channelId)!;

        if (!channel)
            throw new Error(`Channel ${this.config.channelId} not found`);

        if (channel.deleted)
            throw new Error(`Channel ${this.config.channelId} is deleted`);

        if (!(channel instanceof TextChannel))
            throw new Error(`Channel ${this.config.channelId} is not a text channel`);

        await this.vatsimClient.scheduleUpdate();

        if (this.updateListingTimer)
            clearInterval(this.updateListingTimer);

        await this.updateListing(channel);

        setInterval(async () => await this.updateListing(channel), this.config.updateListingInterval);
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

        const discordUser: User = {
            discordId: interaction.member!.user.id,
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

    private async updateListing(channel: TextChannel): Promise<void> {
        try {
            // TODO: Generate message
            let message = this.listingMessage;

            if (message && DateTime.fromJSDate(message.createdAt).diffNow('days').days < -13) {
                message = undefined;

                console.info('VATSIM listing message is too old to modify so replacing it with a new one');
            }

            const content = await this.getListingContent(channel.guild);

            if (!content)
                return;

            const messages = await channel.messages.fetch({ limit: 100 });

            await channel.bulkDelete(messages.filter(m => m.id != message?.id));

            if (message)
                this.listingMessage = await message.edit(content)
            else
                this.listingMessage = await channel.send(content);

            console.info('Updated VATSIM listing');
        } catch (error) {
            console.error('Error updating VATSIM listing', error);
        }
    }

    private async getListingContent(guild: Guild): Promise<string> {
        const [discordUsers, guildMembers, vatsimData] = await Promise.all([
            this.userManager.getUsers(),
            guild.members.fetch(),
            this.vatsimClient.getData()
        ]);

        const getUsername = (user: User, guildMember?: GuildMember): string => {
            return guildMember?.nickname ?? guildMember?.user?.username ?? user.username ?? '';
        }

        const getMaxLength = (values: Array<string | undefined>): number => {
            return values.reduce((maxLength, value) => {
                const length = value?.length ?? 0;

                return length > maxLength ? length : maxLength;
            }, 0);
        };

        interface Column {
            heading: string,
            width: number,
            padding: number,
            paddingDirection: string
        }

        const getColumn = (heading: string, maxLength: number, padding: number, paddingDirection: 'left' | 'right' = 'right'): Column => {
            const width = heading.length > maxLength ? heading.length : maxLength;

            return {
                heading,
                width,
                padding,
                paddingDirection
            };
        };

        const addValue = (column: Column, value?: string): string => {
            value = value ?? '';

            return column.paddingDirection == 'left' ? value.padStart(column.width + column.padding) : value.padEnd(column.width + column.padding);
        };

        const pilotUsers = discordUsers.map(u => ({
            user: u,
            guildMember: guildMembers.find(m => m.id == u.discordId),
            pilot: vatsimData.pilots?.find(p => p.id == u.vatsimId)
        }))
            .filter(u => !!u.pilot)
            .sort((x, y) => getUsername(x.user, x.guildMember).localeCompare(getUsername(y.user, y.guildMember)));

        const columnSeparator = 3;
        let content: string = '';

        content += '**Flights**\n';
        content += '```';

        if (pilotUsers.length) {
            const progressIntervals = 20;
            const usernameColumn = getColumn('User', getMaxLength(pilotUsers.map(u => getUsername(u.user, u.guildMember))), columnSeparator);
            const callsignColumn = getColumn('ID', getMaxLength(pilotUsers.map(u => u.pilot?.callsign)), columnSeparator);
            const aircraftColumn = getColumn('A/C', getMaxLength(pilotUsers.map(u => u.pilot?.flightPlan?.aircraftShort)), columnSeparator);
            const departureColumn = getColumn('DEP', 4, 1 + progressIntervals + 1);
            const arrivalColumn = getColumn('ARR', 4, 0, 'left');

            let header = '';

            header += addValue(usernameColumn, usernameColumn.heading);
            header += addValue(callsignColumn, callsignColumn.heading);
            header += addValue(aircraftColumn, aircraftColumn.heading);
            header += addValue(departureColumn, departureColumn.heading);
            header += addValue(arrivalColumn, arrivalColumn.heading);

            content += `${header}\n`;
            content += `${''.padStart(header.length, '-')}\n`;

            for (const pilotUser of pilotUsers) {
                let row = '';

                row += addValue(usernameColumn, getUsername(pilotUser.user, pilotUser.guildMember));
                row += addValue(callsignColumn, pilotUser.pilot?.callsign);
                row += addValue(aircraftColumn, pilotUser.pilot?.flightPlan?.aircraftShort);

                if (pilotUser.pilot?.flightPlan?.departureAirport) {
                    const [departureAirport, arrivalAirport] = await Promise.all([
                        this.aviationUtility.getAirport(pilotUser.pilot.flightPlan.departureAirport),
                        this.aviationUtility.getAirport(pilotUser.pilot.flightPlan.arrivalAirport)
                    ]);

                    let departure = '';

                    departure += pilotUser.pilot.flightPlan.departureAirport.padEnd(5);

                    if (departureAirport && arrivalAirport) {
                        const remainingDistance = getDistance({ latitude: pilotUser.pilot.latitude, longitude: pilotUser.pilot.longitude }, { latitude: arrivalAirport.latitude, longitude: arrivalAirport.longitude });
                        const totalDistance = getDistance({ latitude: departureAirport.latitude, longitude: departureAirport.longitude }, { latitude: arrivalAirport.latitude, longitude: arrivalAirport.longitude });
                        const percentComplete = 100 * Math.abs(totalDistance - remainingDistance) / totalDistance;

                        for (let i = 0; i < progressIntervals; i++) {
                            const floor = i / progressIntervals;

                            departure += percentComplete >= floor || percentComplete >= 99.5 ? '+' : '-';
                        }
                    }

                    row += addValue(departureColumn, departure);
                    row += addValue(arrivalColumn, pilotUser.pilot.flightPlan?.arrivalAirport);
                }
                else
                    row += addValue(departureColumn, 'No flightplan filed');

                content += `${row}\n`;
            }
        }
        else
            content += 'No pilots are currently online.\n';

        content += '```\n';
        content += '**Air Traffic Control**\n';
        content += '```';

        const controllerUsers = discordUsers.map(u => ({
            user: u,
            guildMember: guildMembers.find(m => m.id == u.discordId),
            controller: vatsimData.controllers?.find(c => c.id == u.vatsimId && c.callsign.includes('_') && !c.callsign.toLowerCase().endsWith('_atis'))
        }))
            .filter(u => !!u.controller)
            .sort((x, y) => getUsername(x.user, x.guildMember).localeCompare(getUsername(y.user, y.guildMember)));

        if (controllerUsers.length) {
            const usernameColumn = getColumn('User', getMaxLength(controllerUsers.map(u => getUsername(u.user, u.guildMember))), columnSeparator);
            const callsignColumn = getColumn('ID', getMaxLength(controllerUsers.map(u => u.controller?.callsign)), columnSeparator);
            const onlineColumn = getColumn('Online', 6, 0);

            let header = '';

            header += addValue(usernameColumn, usernameColumn.heading);
            header += addValue(callsignColumn, callsignColumn.heading);
            header += addValue(onlineColumn, onlineColumn.heading);

            content += `${header}\n`;
            content += `${''.padStart(header.length, '-')}\n`;

            for (const controllerUser of controllerUsers) {
                let row = '';

                row += addValue(usernameColumn, getUsername(controllerUser.user, controllerUser.guildMember));
                row += addValue(callsignColumn, controllerUser.controller?.callsign);
                row += addValue(onlineColumn, DateTime.utc().diff(DateTime.fromJSDate(controllerUser.controller?.onlineSince!)).toFormat('hh:mm'));

                content += `${row}\n`;
            }
        }
        else
            content += 'No controllers are currently online.\n';

        content += '```\n';
        content +=`_VATSIM Activity last updated on ${DateTime.utc().toFormat('yyyy-MM-dd HHmm')}Z_`;

        return content;
    }
}