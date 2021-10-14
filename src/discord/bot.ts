export class DiscordBot {
    private token: string;

    constructor(config?: {
        token?: string
    }) {
        this.token = config?.token ?? process.env.DISCORD_TOKEN!;
    }

    start(): void {
        console.log(this.token);
    }
}