import { constants } from 'fs';
import { access, readFile, writeFile } from 'fs/promises';

const FILE_ENCODING = 'utf-8';

interface Config {
    usersJsonPath: string;
    saveInterval: number;
}

export interface DiscordUser {
    id: string,
    username: string,
    vatsimId: number
}

export class DiscordUserManager {
    private config: Config;

    private static users: Array<DiscordUser>;
    private static updated: boolean = false;
    private static saveTimer: NodeJS.Timer;

    constructor(config?: Config) {
        this.config = config ?? {
            usersJsonPath: process.env.DISCORD_USERS_JSON_PATH!,
            saveInterval: parseInt(process.env.DISCORD_USERS_SAVE_INTERVAL!)
        };

        if (!DiscordUserManager.saveTimer)
            DiscordUserManager.saveTimer = setInterval(this.saveUsers.bind(this), this.config.saveInterval);
    }

    async getUsers(): Promise<Array<DiscordUser>> {
        if (DiscordUserManager.users)
            return DiscordUserManager.users;

        try {
            await access(this.config.usersJsonPath, constants.F_OK)
        } catch {
            console.warn('Discord users file does not exist');

            DiscordUserManager.users = [];

            return DiscordUserManager.users;
        }

        try {
            const json = await readFile(this.config.usersJsonPath, { encoding: FILE_ENCODING });

            DiscordUserManager.users = json ? JSON.parse(json) : [];

            return DiscordUserManager.users;
        } catch (error) {
            console.error('Error loading Discord users', error);

            throw error;
        }
    }

    async getUser(id: string): Promise<DiscordUser | undefined> {
        const users = await this.getUsers();

        return users.find(u => u.id == id);
    }

    async saveUsers(): Promise<void> {
        if (!DiscordUserManager.updated)
            return;

        const users = await this.getUsers();
        const json = JSON.stringify(users, null, 4);

        try {
            await writeFile(this.config.usersJsonPath, json, { encoding: FILE_ENCODING });

            DiscordUserManager.updated = false;

            console.info('Saved Discord users');
        } catch (error) {
            console.error('Error saving Discord users', error);
        }
    }

    async saveUser(user: DiscordUser): Promise<void> {
        let users = await this.getUsers();

        users = users.filter(u => u.id != user.id);

        users.push(user);

        DiscordUserManager.users = users;
        DiscordUserManager.updated = true;

        console.log('Added Discord User', user);
    }

    async deleteDiscordUser(id: string): Promise<void> {
        let users = await this.getUsers();

        users = users.filter(u => u.id != id);

        DiscordUserManager.users = users;
        DiscordUserManager.updated = true;

        console.info('Deleted Discord user', id);
    }
}