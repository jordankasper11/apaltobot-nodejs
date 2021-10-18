import axios from 'axios';
import { VatsimConfig } from '../config';
import { RawVatsimData, VatsimData } from "./vatsim-data";

export class VatsimClient {
    private readonly config: VatsimConfig;

    private static data: VatsimData;
    private static updateTimer: NodeJS.Timer;

    constructor(config?: VatsimConfig) {
        this.config = config ??  new VatsimConfig();
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

            console.info('Retrieved VATSIM data');
        } catch (error) {
            console.error('Error retrieving VATSIM data', error);
        }
    };
}