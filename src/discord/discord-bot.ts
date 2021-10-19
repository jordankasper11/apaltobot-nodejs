import { ApplicationCommandPermissionData, Channel, Client, CommandInteraction, Guild, GuildMember, Intents, Message, TextChannel } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { getDistance } from 'geolib';
import { DateTime } from 'luxon';
import { config, Config } from '../config';
import { AviationUtility } from '../aviation/aviation-utility';
import { VatsimClient } from '../vatsim/vatsim-client';
import { User, UserManager } from '../users/user-manager';

enum Command {
    AddVatsim = "addvatsim",
    LinkVatsim = 'linkvatsim',
    RemoveVatsim = "removevatsim",
    UnlinkVatsim = 'unlinkvatsim'
}

const isTextChannel = (channel: Channel): channel is TextChannel => channel.isText();

export class DiscordBot {
    private readonly config: Config;
    private readonly aviationUtility: AviationUtility;
    private readonly userManager: UserManager;
    private readonly vatsimClient: VatsimClient;
    private updateListingTimer?: NodeJS.Timer;
    private listingMessage?: Message;

    constructor(options?: {
        config?: Config,
        aviationUtility?: AviationUtility,
        userManager?: UserManager,
        vatsimClient?: VatsimClient
    }) {
        this.config = config ?? new Config();
        this.aviationUtility = options?.aviationUtility ?? new AviationUtility(this.config.aviation);
        this.userManager = options?.userManager ?? new UserManager(this.config.users);
        this.vatsimClient = options?.vatsimClient ?? new VatsimClient(this.config.vatsim);
    }

    async start(): Promise<void> {
        console.info('Discord bot starting');

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

        await client.login(this.config.discord.token);
        await this.registerCommands(client);
    }

    private async registerCommands(client: Client): Promise<void> {
        const commands = [
            new SlashCommandBuilder()
                .setName(Command.AddVatsim)
                .setDescription('Add a VATSIM user')
                .addIntegerOption(option => option.setName('cid').setDescription('VATSIM CID').setRequired(true))
                .addStringOption(option => option.setName('username').setDescription('Username').setRequired(true))
                .setDefaultPermission(false),
            new SlashCommandBuilder()
                .setName(Command.LinkVatsim)
                .setDescription('Link your VATSIM account')
                .addIntegerOption(option => option.setName('cid').setDescription('VATSIM CID').setRequired(true)),
            new SlashCommandBuilder()
                .setName(Command.RemoveVatsim)
                .setDescription('Remove a VATSIM user')
                .addIntegerOption(option => option.setName('cid').setDescription('VATSIM CID').setRequired(true)),
            new SlashCommandBuilder()
                .setName(Command.UnlinkVatsim)
                .setDescription('Unlink your VATSIM account')
                .setDefaultPermission(false)
        ].map(c => c.toJSON());

        const rest = new REST({ version: '9' }).setToken(this.config.discord.token);

        try {
            await rest.put(Routes.applicationGuildCommands(this.config.discord.applicationId, this.config.discord.guildId), { body: commands });

            console.info('Registered Discord commands');
        } catch (error) {
            console.error('Error registering Discord commands', error);

            throw error;
        }

        await this.setCommandPermissions(client);
    }

    private async setCommandPermissions(client: Client): Promise<void> {
        try {
            const commands = await client.guilds.cache.get(this.config.discord.guildId)?.commands.fetch();
            const adminCommandNames = [Command.AddVatsim.toString(), Command.RemoveVatsim.toString()];
            const adminCommands = Array.from(commands?.values() ?? []).filter(c => adminCommandNames.includes(c.name));

            for (const command of adminCommands) {
                const permissions: Array<ApplicationCommandPermissionData> = [
                    {
                        id: this.config.discord.adminRoleId,
                        type: 'ROLE',
                        permission: true
                    }
                ];

                await command.permissions.set({ permissions });
            }

            console.info('Set Discord command permissions');
        } catch (error) {
            console.error('Error setting Discord command permissions', error);

            throw error;
        }
    }

    private async onReady(client: Client): Promise<void> {
        console.info('Discord bot connected');

        const channel = client.channels.cache.get(this.config.discord.channelId);

        if (!channel)
            throw new Error(`Channel ${this.config.discord.channelId} not found`);

        if (channel.deleted)
            throw new Error(`Channel ${this.config.discord.channelId} is deleted`);

        if (!(isTextChannel(channel)))
            throw new Error(`Channel ${this.config.discord.channelId} is not a text channel`);

        await this.vatsimClient.scheduleUpdate();

        if (this.updateListingTimer)
            clearInterval(this.updateListingTimer);

        await this.updateListing(channel);

        setInterval(async () => await this.updateListing(channel), this.config.discord.updateListingInterval);
    }

    private onCommand(interaction: CommandInteraction): Promise<void> {
        switch (interaction.commandName) {
            case Command.AddVatsim:
                return this.onAddVatsimCommand(interaction);
            case Command.LinkVatsim:
                return this.onLinkVatsimCommand(interaction);
            case Command.RemoveVatsim:
                return this.onRemoveVatsimCommand(interaction);
            case Command.UnlinkVatsim:
                return this.onUnlinkVatsimCommand(interaction);
            default:
                throw new Error(`Unsupported Discord command: ${interaction.commandName}`);
        }
    }

    private async onAddVatsimCommand(interaction: CommandInteraction): Promise<void> {
        const cid = interaction.options.getInteger('cid');
        const username = interaction.options.getString('username');

        if (!cid)
            throw new Error(`cid argument is required for ${Command.AddVatsim} Discord command`);

        if (!username)
            throw new Error(`username argument is required for ${Command.AddVatsim} Discord command`);

        const user: User = {
            username: username,
            vatsimId: cid
        };

        await this.userManager.saveUser(user);

        await interaction.reply({
            content: 'VATSIM activity for this user will be included on the status board within a few minutes.',
            ephemeral: true
        });
    }

    private async onLinkVatsimCommand(interaction: CommandInteraction): Promise<void> {
        const cid = interaction.options.getInteger('cid');

        if (!cid)
            throw new Error(`cid argument is required for ${Command.LinkVatsim} Discord command`);

        const user: User = {
            discordId: interaction.member?.user.id,
            username: interaction.member?.user.username,
            vatsimId: cid
        };

        await this.userManager.saveUser(user);

        await interaction.reply({
            content: 'Thanks for your linking your account! Your VATSIM activity will be included on the status board within a few minutes.',
            ephemeral: true
        });
    }

    private async onRemoveVatsimCommand(interaction: CommandInteraction): Promise<void> {
        const vatsimId = interaction.options.getInteger('cid') ?? undefined;
        const userFilter = { vatsimId };
        const user = await this.userManager.getUser(userFilter);

        if (!user) {
            await interaction.reply({
                content: 'User not found',
                ephemeral: true
            });

            return;
        }

        await this.userManager.deleteUser(userFilter);

        await interaction.reply({
            content: 'VATSIM activity for this user will be removed from the status board within a few minutes.',
            ephemeral: true
        });
    }

    private async onUnlinkVatsimCommand(interaction: CommandInteraction): Promise<void> {
        await this.userManager.deleteUser({ discordId: interaction.member?.user.id });

        await interaction.reply({
            content: 'Your VATSIM activity will be removed from the status board within a few minutes.',
            ephemeral: true
        });
    }

    private async updateListing(channel: TextChannel): Promise<void> {
        try {
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
        let content = '';

        content += '**Flights**\n';
        content += '```';

        if (pilotUsers.length) {
            const progressIntervals = 20;
            const usernameColumn = getColumn('  User', getMaxLength(pilotUsers.map(u => getUsername(u.user, u.guildMember))) + 2, columnSeparator);
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

                row += addValue(usernameColumn, (pilotUser.guildMember ? '* ' : '  ') + getUsername(pilotUser.user, pilotUser.guildMember));
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
                        const remainingDistance = getDistance({ latitude: pilotUser.pilot.latitude, longitude: pilotUser.pilot.longitude }, { latitude: arrivalAirport.latitude, longitude: arrivalAirport.longitude }) / 1000;
                        const totalDistance = getDistance({ latitude: departureAirport.latitude, longitude: departureAirport.longitude }, { latitude: arrivalAirport.latitude, longitude: arrivalAirport.longitude }) / 1000;
                        const percentComplete = 100 * Math.abs(totalDistance - remainingDistance) / totalDistance;

                        for (let i = 0; i < progressIntervals; i++) {
                            const floor = 100 * i / progressIntervals;

                            departure += percentComplete > 0.5 && percentComplete >= floor || percentComplete >= 99.5 ? '+' : '-';
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
            const usernameColumn = getColumn('  User', getMaxLength(controllerUsers.map(u => getUsername(u.user, u.guildMember))) + 2, columnSeparator);
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

                row += addValue(usernameColumn, (controllerUser.guildMember ? '* ' : '  ') + getUsername(controllerUser.user, controllerUser.guildMember));
                row += addValue(callsignColumn, controllerUser.controller?.callsign);
                row += addValue(onlineColumn, controllerUser?.controller?.onlineSince ? DateTime.utc().diff(DateTime.fromJSDate(controllerUser.controller?.onlineSince)).toFormat('hh:mm') : '');

                content += `${row}\n`;
            }
        }
        else
            content += 'No controllers are currently online.\n';

        content += '```\n';
        content += `_VATSIM data last updated on ${DateTime.fromJSDate(vatsimData.overview.lastUpdated).toFormat('yyyy-MM-dd HHmm')}Z_`;

        return content;
    }
}