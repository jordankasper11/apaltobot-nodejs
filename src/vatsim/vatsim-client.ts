import axios from 'axios';
import { inject, injectable } from 'inversify';
import { VatsimConfig } from '../config';
import { TYPES } from '../inversify';
import { logGlobalError, logGlobalInfo } from '../logging';
import { RawVatsimData, VatsimData } from "./vatsim-data";

@injectable()
export class VatsimClient {
    private readonly config: VatsimConfig;

    private static data: VatsimData;
    private static updateTimer: NodeJS.Timer;

    constructor(@inject(TYPES.VatsimConfig) config: VatsimConfig) {
        this.config = config;
    }

    getData = async (): Promise<VatsimData> => {
        if (!VatsimClient.data)
            await this.updateData();

        return VatsimClient.data;
    };

    scheduleUpdate = async (): Promise<void> => {
        if (VatsimClient.updateTimer)
            return;

        await this.updateData();

        VatsimClient.updateTimer = setInterval(this.updateData, this.config.dataRefreshInterval);
    };

    private updateData = async (): Promise<void> => {
        try {
            const response = await axios.get<RawVatsimData>(this.config.dataUrl);
            
            VatsimClient.data = new VatsimData(response.data);

            logGlobalInfo('Retrieved VATSIM data');
        } catch (error) {
            logGlobalError('Error retrieving VATSIM data', error);
        }
    };
}