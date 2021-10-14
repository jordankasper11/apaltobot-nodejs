import dotenv from 'dotenv';
import { DiscordBot } from './discord/discord-bot'
import { VatsimClient } from './vatsim/vatsim-client';

dotenv.config();

const vatsimClient = new VatsimClient();
const discordBot = new DiscordBot(vatsimClient);

discordBot.start();
