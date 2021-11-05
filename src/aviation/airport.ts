// JSON data retrieved from https://github.com/mwgg/Airports
export interface RawAirport {
    icao: string;
    name: string;
    city: string;
    state: string;
    country: string;
    elevation: string;
    lat: string;
    lon: string;
    tz: string;
}

export interface RawAirportData {
    [icao: string]: RawAirport
}

export class Airport {
    identifier!: string;
    name!: string;
    city!: string;
    state!: string;
    country!: string;
    elevation!: string;
    latitude!: string;
    longitude!: string;
    timeZone!: string;

    constructor(data?: RawAirport) {
        if (data) {
            this.identifier = data.icao;
            this.name = data.name;
            this.city = data.city;
            this.state = data.state;
            this.country = data.country;
            this.elevation = data.elevation;
            this.latitude = data.lat;
            this.longitude = data.lon;
            this.timeZone = data.tz;
        }
    }
}
