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
    private readonly filePath: string;

    private users: Array<User> | undefined;
    private updated = false;
    private saveTimer: NodeJS.Timer;

    constructor(config: UsersConfig, name: string) {
        this.config = config;
        this.name = name;
        this.filePath = join(this.config.jsonPath, `${this.name}.json`);
        this.saveTimer = setInterval(this.saveUsers.bind(this), this.config.saveInterval);
    }

    private async loadUsers(): Promise<void> {
        if (this.users)
            return;

        try {
            await access(this.filePath, constants.F_OK)
        } catch {
            console.warn(`Discord users file does not exist for ${this.name}`);

            this.users = [];
            this.updated = true;

            return;
        }

        try {
            const json = await readFile(this.filePath, { encoding: FILE_ENCODING });

            this.users = json ? JSON.parse(json) : [];
        } catch (error) {
            console.error(`Error loading Discord users for ${this.name}`, error);

            throw error;
        }
    }

    async getUsers(): Promise<Array<User>> {
        await this.loadUsers();

        return this.users ?? [];
    }

    async getUser(filter: UserFilter): Promise<User | undefined> {
        if (!filter.discordId && !filter.vatsimId)
            return undefined;

        await this.loadUsers();

        const users = await this.getUsers();

        return users.find(u => (!filter.discordId || u.discordId == filter.discordId) && (!filter.vatsimId || u.vatsimId == filter.vatsimId));
    }

    async saveUsers(): Promise<void> {
        if (!this.updated)
            return;

        await this.loadUsers();

        const users = await this.getUsers();
        const json = JSON.stringify(users, null, 4);

        try {
            await writeFile(this.filePath, json, { encoding: FILE_ENCODING });

            this.updated = false;

            console.info(`Saved Discord users for ${this.name}`);
        } catch (error) {
            console.error(`Error saving Discord users for ${this.name}`, error);
        }
    }

    async saveUser(user: User): Promise<void> {
        await this.loadUsers();
        await this.deleteUser({ discordId: user.discordId, vatsimId: user.vatsimId }, false);

        this.users?.push(user);
        this.updated = true;

        console.info(`Added Discord User for ${this.name}`, user);
    }

    async deleteUser(filter: UserFilter, log = true): Promise<void> {
        if (!filter.discordId && !filter.vatsimId)
            return;

        await this.loadUsers();

        const user = await this.getUser(filter);

        if (!user)
            return;

        const users = await this.getUsers();

        this.users = users.filter(u => u != user);
        this.updated = true;

        if (log)
            console.info(`Deleted Discord user for ${this.name}`, user);
    }
}