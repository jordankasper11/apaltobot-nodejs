import { readFile } from 'fs/promises';
import { inject, injectable } from 'inversify';
import { AviationConfig } from '../config';
import { TYPES } from '../inversify';
import { Airport, RawAirportData } from "./airport";

const FILE_ENCODING = 'utf-8';

@injectable()
export class AviationUtility {
    private readonly config: AviationConfig;

    private static airports: {
        [key: string]: Airport
    };

    constructor(@inject(TYPES.AviationConfig) config: AviationConfig) {
        this.config = config;
    }

    private async loadAirports(): Promise<void> {
        if (AviationUtility.airports)
            return;

        try {
            const json = await readFile(this.config.airportsJsonPath, { encoding: FILE_ENCODING });
            const airports: RawAirportData = JSON.parse(json);

            AviationUtility.airports = Object.fromEntries(Object.keys(airports).map(a => [a, new Airport(airports[a])]));

            console.info('Loaded airport data');
        } catch (error) {
            console.error('Error loading airport data', error);

            throw error;
        }
    }

    async getAirport(identifer: string): Promise<Airport | undefined> {
        await this.loadAirports();

        return AviationUtility.airports[identifer];
    }
}