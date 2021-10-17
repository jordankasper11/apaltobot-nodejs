import { constants } from 'fs';
import { access, readFile, writeFile } from 'fs/promises';

const FILE_ENCODING = 'utf-8';

interface Config {
    usersJsonPath: string;
    saveInterval: number;
}

export interface User {
    discordId?: string,
    username?: string,
    vatsimId: number
}

export class UserManager {
    private config: Config;

    private static users: Array<User>;
    private static updated: boolean = false;
    private static saveTimer: NodeJS.Timer;

    constructor(config?: Config) {
        this.config = config ?? {
            usersJsonPath: process.env.USERS_JSON_PATH!,
            saveInterval: parseInt(process.env.USERS_SAVE_INTERVAL!)
        };

        if (!UserManager.saveTimer)
            UserManager.saveTimer = setInterval(this.saveUsers.bind(this), this.config.saveInterval);
    }

    async getUsers(): Promise<Array<User>> {
        if (UserManager.users)
            return UserManager.users;

        try {
            await access(this.config.usersJsonPath, constants.F_OK)
        } catch {
            console.warn('Discord users file does not exist');

            UserManager.users = [];

            return UserManager.users;
        }

        try {
            const json = await readFile(this.config.usersJsonPath, { encoding: FILE_ENCODING });

            UserManager.users = json ? JSON.parse(json) : [];

            return UserManager.users;
        } catch (error) {
            console.error('Error loading Discord users', error);

            throw error;
        }
    }

    async getUser(id: string): Promise<User | undefined> {
        const users = await this.getUsers();

        return users.find(u => u.discordId == id);
    }

    async saveUsers(): Promise<void> {
        if (!UserManager.updated)
            return;

        const users = await this.getUsers();
        const json = JSON.stringify(users, null, 4);

        try {
            await writeFile(this.config.usersJsonPath, json, { encoding: FILE_ENCODING });

            UserManager.updated = false;

            console.info('Saved Discord users');
        } catch (error) {
            console.error('Error saving Discord users', error);
        }
    }

    async saveUser(user: User): Promise<void> {
        let users = await this.getUsers();

        users = users.filter(u => u.discordId != user.discordId);

        users.push(user);

        UserManager.users = users;
        UserManager.updated = true;

        console.info('Added Discord User', user);
    }

    async deleteDiscordUser(id: string): Promise<void> {
        let users = await this.getUsers();

        users = users.filter(u => u.discordId != id);

        UserManager.users = users;
        UserManager.updated = true;

        console.info('Deleted Discord user', id);
    }
}