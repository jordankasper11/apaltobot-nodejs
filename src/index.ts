import { config } from './config';
import { DiscordBot } from './discord/discord-bot'

console.info("Application starting", config);

const discordBot = new DiscordBot({ config });

discordBot.start();
