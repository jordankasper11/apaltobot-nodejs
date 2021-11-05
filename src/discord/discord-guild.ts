import { ApplicationCommandPermissionData, Channel, Client, CommandInteraction, Guild, GuildMember, Message, TextChannel } from 'discord.js';
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v9';
import { getDistance } from 'geolib';
import { DateTime } from 'luxon';
import { DiscordGuildConfig } from '../config';
import { AviationUtility } from '../aviation/aviation-utility';
import { VatsimClient } from '../vatsim/vatsim-client';
import { User, UserManager, UserManagerFactory } from '../users/user-manager';
import { logError, logInfo } from '../logging';

enum Command {
    AddVatsim = 'addvatsim',
    LinkVatsim = 'linkvatsim',
    RemoveVatsim = 'removevatsim',
    UnlinkVatsim = 'unlinkvatsim'
}

function isTextChannel(channel: Channel): channel is TextChannel {
    return channel.isText();
}

export class DiscordGuild {
    private readonly config: DiscordGuildConfig;
    private readonly discordApplicationId: string;
    private readonly discordToken: string;
    private readonly userManager: UserManager;
    private readonly vatsimClient: VatsimClient;
    private readonly aviationUtility: AviationUtility;
    private updateListingTimer?: NodeJS.Timer;
    private listingMessageId?: string;

    constructor(config: DiscordGuildConfig, discordApplicationId: string, discordToken: string, userManagerFactory: UserManagerFactory, vatsimClient: VatsimClient, aviationUtility: AviationUtility) {
        this.config = config;
        this.discordApplicationId = discordApplicationId;
        this.discordToken = discordToken;
        this.userManager = userManagerFactory.createUserManager(config.name);
        this.vatsimClient = vatsimClient;
        this.aviationUtility = aviationUtility;
    }

    async start(client: Client, updateListingInterval: number): Promise<void> {
        try {
            if (!this.config.displayFlights && !this.config.displayControllers)
                throw new Error('Server is not configured to display flights or controllers');

            const guild = client.guilds.cache.get(this.config.guildId);

            if (!guild)
                throw new Error(`Guild ${this.config.guildId} not found`);
            else if (guild.deleted)
                throw new Error(`Guild ${this.config.guildId} is deleted`);

            await this.registerCommands(client);
            await this.scheduleUpdates(client, updateListingInterval);

            client.on('interactionCreate', async (interaction) => {
                if (interaction.guildId != this.config.guildId || !interaction.isCommand())
                    return;

                await this.handleCommand(interaction);
            });

            logInfo(this.config.name, 'Started Discord bot');
        } catch (error) {
            logError(this.config.name, 'Error starting Discord bot', error);
        }
    }

    stop(): void {
        if (this.updateListingTimer)
            clearInterval(this.updateListingTimer);
    }

    private async registerCommands(client: Client): Promise<void> {
        const commands = [
            new SlashCommandBuilder()
                .setName(Command.LinkVatsim)
                .setDescription('Link your VATSIM account')
                .addIntegerOption(option => option.setName('cid').setDescription('VATSIM CID').setRequired(true)),
            new SlashCommandBuilder()
                .setName(Command.UnlinkVatsim)
                .setDescription('Unlink your VATSIM account')
        ];

        if (this.config.adminRoleId) {
            commands.push(
                new SlashCommandBuilder()
                    .setName(Command.AddVatsim)
                    .setDescription('Add a VATSIM user')
                    .addIntegerOption(option => option.setName('cid').setDescription('VATSIM CID').setRequired(true))
                    .addStringOption(option => option.setName('username').setDescription('Username').setRequired(true))
                    .setDefaultPermission(false),
                new SlashCommandBuilder()
                    .setName(Command.RemoveVatsim)
                    .setDescription('Remove a VATSIM user')
                    .addIntegerOption(option => option.setName('cid').setDescription('VATSIM CID').setRequired(true))
                    .setDefaultPermission(false)
            );
        }

        const rest = new REST({ version: '9' }).setToken(this.discordToken);

        try {
            await rest.put(Routes.applicationGuildCommands(this.discordApplicationId, this.config.guildId), { body: commands.map(c => c.toJSON()) });

            logInfo(this.config.name, 'Registered Discord commands');
        } catch (error) {
            logError(this.config.name, 'Error registering Discord commands', error);

            throw error;
        }

        if (this.config.adminRoleId)
            await this.setAdminCommandPermissions(client);
    }

    private async setAdminCommandPermissions(client: Client): Promise<void> {
        if (!this.config.adminRoleId)
            return;

        try {
            const commands = await client.guilds.cache.get(this.config.guildId)?.commands.fetch();
            const adminCommandNames = [Command.AddVatsim.toString(), Command.RemoveVatsim.toString()];
            const adminCommands = Array.from(commands?.values() ?? []).filter(c => adminCommandNames.includes(c.name));

            for (const command of adminCommands) {
                const permissions: Array<ApplicationCommandPermissionData> = [
                    {
                        id: this.config.adminRoleId,
                        type: 'ROLE',
                        permission: true
                    }
                ];

                await command.permissions.set({ permissions });
            }

            logInfo(this.config.name, 'Set Discord command permissions');
        } catch (error) {
            logError(this.config.name, 'Error setting Discord command permissions', error);

            throw error;
        }
    }

    private handleCommand(interaction: CommandInteraction): Promise<void> {
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
            content: 'VATSIM activity for this user will be displayed within a few minutes.',
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
            content: 'Thanks for your linking your account! Your VATSIM activity will be displayed within a few minutes.',
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
            content: 'VATSIM activity for this user will be removed within a few minutes.',
            ephemeral: true
        });
    }

    private async onUnlinkVatsimCommand(interaction: CommandInteraction): Promise<void> {
        await this.userManager.deleteUser({ discordId: interaction.member?.user.id });

        await interaction.reply({
            content: 'Your VATSIM activity will be removed within a few minutes.',
            ephemeral: true
        });
    }

    private async scheduleUpdates(client: Client, updateListingInterval: number): Promise<void> {
        if (this.updateListingTimer)
            clearInterval(this.updateListingTimer);

        const channel = client.channels.cache.get(this.config.channelId);

        if (!channel)
            throw new Error(`Channel ${this.config.channelId} not found`);
        else if (channel.deleted)
            throw new Error(`Channel ${this.config.channelId} is deleted`);
        else if (!isTextChannel(channel))
            throw new Error(`Channel ${this.config.channelId} is not a text channel`);

        await this.updateListing(channel);

        this.updateListingTimer = setInterval(async () => await this.updateListing(channel), updateListingInterval);

        logInfo(this.config.name, 'Scheduled VATSIM listing updates');
    }

    private async updateListing(channel: TextChannel): Promise<void> {
        try {
            let message: Message | undefined;

            if (this.listingMessageId) {
                try {
                    message = await channel.messages.fetch(this.listingMessageId, { cache: false, force: true });
                } catch {
                    this.listingMessageId = undefined;

                    logInfo(this.config.name, 'The previous VATSIM listing message no longer exists. A new message will be created.');
                }

                if (message && (!message.editable || DateTime.fromJSDate(message.createdAt).diffNow('days').days < -13)) {
                    this.listingMessageId = undefined;

                    message = undefined;

                    logInfo(this.config.name, 'The VATSIM listing message is no longer editable. It will be replaced by a new message.');
                }
            }

            const content = await this.getListingContent(channel.guild);

            if (!content)
                return;

            const messages = await channel.messages.fetch({ limit: 100 });

            if (messages.size) {
                const messagesToDelete = messages?.filter(m => m.id != message?.id);

                if (messagesToDelete?.size)
                    await channel.bulkDelete(messagesToDelete);
            }

            if (message)
                message = await message.edit(content);
            else
                message = await channel.send(content);

            this.listingMessageId = message.id;

            logInfo(this.config.name, 'Updated VATSIM listing');
        } catch (error) {
            logError(this.config.name, 'Error updating VATSIM listing', error);
        }
    }

    private async getListingContent(guild: Guild): Promise<string> {
        const [discordUsers, guildMembers, vatsimData] = await Promise.all([
            this.userManager.getUsers(),
            guild.members.fetch(),
            this.vatsimClient.getData()
        ]);

        function getUsername(user: User, guildMember?: GuildMember): string {
            return guildMember?.nickname ?? guildMember?.user?.username ?? user.username ?? '';
        }

        function getMaxLength(values: Array<string | undefined>): number {
            return values.reduce((maxLength, value) => {
                const length = value?.length ?? 0;

                return length > maxLength ? length : maxLength;
            }, 0);
        }

        interface Column {
            heading: string,
            width: number,
            padding: number,
            paddingDirection: string
        }

        function getColumn(heading: string, maxLength: number, padding: number, paddingDirection: 'left' | 'right' = 'right'): Column {
            const width = heading.length > maxLength ? heading.length : maxLength;

            return {
                heading,
                width,
                padding,
                paddingDirection
            };
        }

        function addValue(column: Column, value?: string): string {
            value = value ?? '';

            return column.paddingDirection == 'left' ? value.padStart(column.width + column.padding) : value.padEnd(column.width + column.padding);
        }

        const columnSeparator = 3;
        let content = '';

        if (this.config.displayFlights) {
            const pilotUsers = discordUsers.map(u => ({
                user: u,
                guildMember: guildMembers.find(m => m.id == u.discordId),
                pilot: vatsimData?.pilots?.find(p => p.id == u.vatsimId)
            }))
                .filter(u => !!u.pilot)
                .sort((x, y) => getUsername(x.user, x.guildMember).localeCompare(getUsername(y.user, y.guildMember)));

            content += '**Flights**\n';
            content += '```';

            if (pilotUsers.length) {
                const progressIntervals = 20;
                const usernameColumn = getColumn(' User', getMaxLength(pilotUsers.map(u => getUsername(u.user, u.guildMember))) + 1, columnSeparator);
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

                    row += addValue(usernameColumn, (pilotUser.guildMember ? '*' : ' ') + getUsername(pilotUser.user, pilotUser.guildMember));
                    row += addValue(callsignColumn, pilotUser.pilot?.callsign);
                    row += addValue(aircraftColumn, pilotUser.pilot?.flightPlan?.aircraftShort);

                    if (pilotUser.pilot?.flightPlan?.departureAirport) {
                        const departureAirport = await this.aviationUtility.getAirport(pilotUser.pilot.flightPlan.departureAirport);
                        const arrivalAirport = await this.aviationUtility.getAirport(pilotUser.pilot.flightPlan.arrivalAirport);

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
                    } else
                        row += addValue(departureColumn, 'No flightplan filed');

                    content += `${row}\n`;
                }
            } else
                content += 'No pilots are currently online.\n';

            content += '```\n';
        }

        if (this.config.displayControllers) {
            content += '**Air Traffic Control**\n';
            content += '```';

            const controllerUsers = discordUsers.map(u => ({
                user: u,
                guildMember: guildMembers.find(m => m.id == u.discordId),
                controller: vatsimData?.controllers?.find(c => c.id == u.vatsimId && c.callsign.includes('_') && !c.callsign.toLowerCase().endsWith('_atis'))
            }))
                .filter(u => !!u.controller)
                .sort((x, y) => getUsername(x.user, x.guildMember).localeCompare(getUsername(y.user, y.guildMember)));

            if (controllerUsers.length) {
                const usernameColumn = getColumn(' User', getMaxLength(controllerUsers.map(u => getUsername(u.user, u.guildMember))) + 1, columnSeparator);
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

                    row += addValue(usernameColumn, (controllerUser.guildMember ? '*' : ' ') + getUsername(controllerUser.user, controllerUser.guildMember));
                    row += addValue(callsignColumn, controllerUser.controller?.callsign);
                    row += addValue(onlineColumn, controllerUser?.controller?.onlineSince ? DateTime.utc().diff(DateTime.fromJSDate(controllerUser.controller?.onlineSince)).toFormat('hh:mm') : '');

                    content += `${row}\n`;
                }
            } else
                content += 'No controllers are currently online.\n';

            content += '```\n';
        }

        if (vatsimData)
            content += `_VATSIM data last updated on ${DateTime.fromJSDate(vatsimData.overview.lastUpdated).toFormat('yyyy-MM-dd HHmm')}Z_`;
        else
            content += `Unable to retriev_VATSIM data as of ${DateTime.now().toFormat('yyyy-MM-dd HHmm')}Z_`;

        return content;
    }
}
