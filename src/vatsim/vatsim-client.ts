import axios from 'axios';
import { inject, injectable } from 'inversify';
import { VatsimConfig } from '../config';
import { TYPES } from '../inversify';
import { logGlobalError, logGlobalInfo } from '../logging';
import { RawVatsimData, VatsimData } from "./vatsim-data";

@injectable()
export class VatsimClient {
    private readonly config: VatsimConfig;
    private data: VatsimData | undefined;
    private updateTimer: NodeJS.Timer | undefined;

    constructor(@inject(TYPES.VatsimConfig) config: VatsimConfig) {
        this.config = config;
    }

    async getData(): Promise<VatsimData | undefined> {
        if (!this.data) {
            this.scheduleUpdates();
            
            await this.updateData();
        }

        return this.data;
    }

    scheduleUpdates(): void {
        if (this.updateTimer)
            return;

        this.updateTimer = setInterval(async () => await this.updateData(), this.config.dataRefreshInterval);

        logGlobalInfo('Scheduled updates of VATSIM data');
    }

    private async updateData(): Promise<void> {
        try {
            const response = await axios.get<RawVatsimData>(this.config.dataUrl);

            this.data = new VatsimData(response.data);

            logGlobalInfo('Retrieved VATSIM data');
        } catch (error) {
            logGlobalError('Error retrieving VATSIM data', error);
        }
    }
}