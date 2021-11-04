import { constants } from 'fs';
import { join } from 'path';
import { access, readFile, writeFile } from 'fs/promises';
import { inject, injectable } from 'inversify';
import { UsersConfig } from '../config';
import { TYPES } from '../inversify';

const FILE_ENCODING = 'utf-8';

export interface User {
    discordId?: string,
    username?: string,
    vatsimId: number
}

export interface UserFilter {
    discordId?: string,
    vatsimId?: number
}

@injectable()
export class UserManagerFactory {
    private readonly config: UsersConfig;

    constructor(@inject(TYPES.UsersConfig) config: UsersConfig) {
        this.config = config;
    }

    createUserManager(name: string): UserManager {
        return new UserManager(this.config, name);
    }
}

export class UserManager {
    private readonly config: UsersConfig;
    private readonly name: string;

    private static users: Array<User>;
    private static updated = false;
    private static saveTimer: NodeJS.Timer;

    constructor(config: UsersConfig, name: string) {
        this.config = config;
        this.name = name;

        if (!UserManager.saveTimer)
            UserManager.saveTimer = setInterval(this.saveUsers.bind(this), this.config.saveInterval);
    }

    private async loadUsers(): Promise<void> {
        if (UserManager.users)
            return;

        const fileName = `${this.name}.json`;
        const filePath = join(this.config.jsonPath, fileName);

        try {
            await access(filePath, constants.F_OK)
        } catch {
            console.warn(`Discord users file does not exist for ${this.name}`);

            UserManager.users = [];
        }

        try {
            const json = await readFile(filePath, { encoding: FILE_ENCODING });

            UserManager.users = json ? JSON.parse(json) : [];
        } catch (error) {
            console.error(`Error loading Discord users for ${this.name}`, error);

            throw error;
        }
    }

    async getUsers(): Promise<Array<User>> {
        await this.loadUsers();

        return UserManager.users;
    }

    async getUser(filter: UserFilter): Promise<User | undefined> {
        if (!filter.discordId && !filter.vatsimId)
            return undefined;

        await this.loadUsers();

        return UserManager.users.find(u => (!filter.discordId || u.discordId == filter.discordId) && (!filter.vatsimId || u.vatsimId == filter.vatsimId));
    }

    async saveUsers(): Promise<void> {
        if (!UserManager.updated)
            return;

        await this.loadUsers();

        const json = JSON.stringify(UserManager.users, null, 4);

        try {
            await writeFile(this.config.jsonPath, json, { encoding: FILE_ENCODING });

            UserManager.updated = false;

            console.info(`Saved Discord users for ${this.name}`);
        } catch (error) {
            console.error(`Error saving Discord users for ${this.name}`, error);
        }
    }

    async saveUser(user: User): Promise<void> {
        await this.loadUsers();
        await this.deleteUser({ discordId: user.discordId, vatsimId: user.vatsimId }, false);

        UserManager.users = UserManager.users.filter(u => u.discordId != user.discordId);
        UserManager.users.push(user);
        UserManager.updated = true;

        console.info(`Added Discord User for ${this.name}`, user);
    }

    async deleteUser(filter: UserFilter, log = true): Promise<void> {
        if (!filter.discordId && !filter.vatsimId)
            return;

        await this.loadUsers();

        const user = await this.getUser(filter);

        if (!user)
            return;

        UserManager.users = UserManager.users.filter(u => u != user);
        UserManager.updated = true;

        if (log)
            console.info(`Deleted Discord user for ${this.name}`, user);
    }
}