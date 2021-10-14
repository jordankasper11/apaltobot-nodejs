import dotenv from 'dotenv';
import { DiscordBot } from './discord/bot'

dotenv.config();

const discordBot = new DiscordBot();

discordBot.start();
