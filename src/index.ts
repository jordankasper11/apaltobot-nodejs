import 'reflect-metadata';
import { Container } from 'inversify';
import { AviationUtility } from './aviation/aviation-utility';
import { AviationConfig, defaultConfig, DiscordConfig, UsersConfig, VatsimConfig } from './config';
import { DiscordBot } from './discord/discord-bot'
import { TYPES } from './inversify';
import { UserManagerFactory } from './users/user-manager';
import { VatsimClient } from './vatsim/vatsim-client';
import { logGlobalInfo } from './logging';

logGlobalInfo("Application starting", defaultConfig);

const container = new Container();

container.bind<AviationConfig>(TYPES.AviationConfig).toConstantValue(defaultConfig.aviation);
container.bind<DiscordConfig>(TYPES.DiscordConfig).toConstantValue(defaultConfig.discord);
container.bind<UsersConfig>(TYPES.UsersConfig).toConstantValue(defaultConfig.users);
container.bind<VatsimConfig>(TYPES.VatsimConfig).toConstantValue(defaultConfig.vatsim);
container.bind(AviationUtility).to(AviationUtility).inSingletonScope();
container.bind(UserManagerFactory).to(UserManagerFactory);
container.bind(VatsimClient).to(VatsimClient).inSingletonScope();
container.bind(DiscordBot).to(DiscordBot);

const discordBot = container.get(DiscordBot);

discordBot.start();
