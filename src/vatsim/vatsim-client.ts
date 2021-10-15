import axios from 'axios';
import { RawVatsimData, VatsimData } from "./vatsim-data";

interface Config {
    dataUrl: string;
    refreshInterval: number;
}

export class VatsimClient {
    private config: Config;

    private static data: VatsimData;
    private static updateTimer: NodeJS.Timer;

    constructor(config?: Config) {
        this.config = config ?? {
            dataUrl: process.env.VATSIM_DATA_URL!,
            refreshInterval: parseInt(process.env.VATSIM_REFRESH_INTERVAL!)
        };
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

        VatsimClient.updateTimer = setInterval(this.updateData, this.config.refreshInterval);
    };

    private updateData = async (): Promise<void> => {
        try {
            const response = await axios.get<RawVatsimData>(this.config.dataUrl);
            
            VatsimClient.data = new VatsimData(response.data);

            console.log('Retrieved VATSIM data');
        } catch (error) {
            console.error('Error retrieving VATSIM data', error);
        }
    };
};