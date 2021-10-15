
interface RawVatsimOverview {
    version: number,
    connected_clients: number,
    unique_users: number,
    update_timestamp: Date
}

export class VatsimOverview {
    version!: number;
    connections!: number;
    users!: number;
    lastUpdated!: Date;

    constructor(data?: RawVatsimOverview) {
        if (data) {
            this.version = data.version;
            this.connections = data.connected_clients;
            this.users = data.unique_users;
            this.lastUpdated = new Date(data.update_timestamp);
        }
    }
}

interface RawVatsimFlightPlan {
    flight_rules: string,
    aircraft: string,
    aircraft_faa: string,
    aircraft_short: string,
    departure: string,
    arrival: string,
    alternate: string,
    cruise_tas: string,
    altitude: string,
    deptime: string,
    enroute_time: string,
    fuel_time: string,
    remarks: string,
    route: string,
    revision: number
}

export class VatsimFlightPlan {
    flightRules!: string;
    aircraft!: string;
    aircraftFaa!: string;
    aircraftShort!: string;
    departureAirport!: string;
    arrivalAirport!: string;
    alternateAirport!: string;
    cruiseAirspeed!: string;
    cruiseAltitude!: string;
    departureTime!: string;
    enrouteTime!: string;
    fuelTime!: string;
    remarks!: string;
    route!: string;
    revision!: number;

    constructor(data?: RawVatsimFlightPlan) {
        if (data) {
            this.flightRules = data.flight_rules;
            this.aircraft = data.aircraft;
            this.aircraftFaa = data.aircraft_faa;
            this.aircraftShort = data.aircraft_short;
            this.departureAirport = data.departure;
            this.arrivalAirport = data.arrival;
            this.alternateAirport = data.alternate;
            this.cruiseAirspeed = data.cruise_tas;
            this.cruiseAltitude = data.altitude;
            this.departureTime = data.deptime;
            this.enrouteTime = data.enroute_time;
            this.fuelTime = data.fuel_time;
            this.remarks = data.remarks;
            this.route = data.route;
            this.revision = data.revision;
        }
    }
}

interface RawVatsimPilot {
    cid: number,
    server: string,
    name: string,
    callsign: string,
    transponder: string,
    latitude: number,
    longitude: number,
    altitude: number,
    heading: number,
    groundspeed: number,
    qnh_i_hg: number,
    qnh_mb: number,
    logon_time: Date,
    last_updated: Date,
    flight_plan?: RawVatsimFlightPlan
}

export class VatsimPilot {
    id!: number;
    server!: string;
    name!: string;
    callsign!: string;
    transponder!: string;
    latitude!: number;
    longitude!: number;
    altitude!: number;
    heading!: number;
    groundSpeed!: number;
    altimeterInHg!: number;
    altimeterMb!: number;
    flightPlan?: VatsimFlightPlan;
    onlineSince!: Date;
    lastUpdated!: Date;

    constructor(data?: RawVatsimPilot) {
        if (data) {
            this.id = data.cid;
            this.server = data.server;
            this.name = data.name;
            this.callsign = data.callsign;
            this.transponder = data.transponder;
            this.latitude = data.latitude;
            this.longitude = data.longitude;
            this.altitude = data.altitude;
            this.heading = data.heading;
            this.groundSpeed = data.groundspeed;
            this.altimeterInHg = data.qnh_i_hg;
            this.altimeterMb = data.qnh_mb;
            this.flightPlan = data.flight_plan ? new VatsimFlightPlan(data.flight_plan) : undefined;
            this.onlineSince = new Date(data.logon_time);
            this.lastUpdated = new Date(data.last_updated);
        }
    }
}

interface RawVatsimController {
    cid: number,
    server: string,
    name: string,
    callsign: string,
    frequency: string,
    facility: number,
    rating: number,
    visual_range: number,
    text_atis: Array<string>,
    logon_time: Date,
    last_updated: Date
}

export class VatsimController {
    id!: number;
    server!: string;
    name!: string;
    callsign!: string;
    frequency!: string;
    facility!: number;
    rating!: number;
    visualRange!: number;
    atis!: Array<string>;
    onlineSince!: Date;
    lastUpdated!: Date;

    constructor(data?: RawVatsimController) {
        if (data) {
            this.id = data.cid;
            this.server = data.server;
            this.name = data.name;
            this.callsign = data.callsign;
            this.frequency = data.frequency;
            this.facility = data.facility;
            this.rating = data.rating;
            this.visualRange = data.visual_range;
            this.atis = data.text_atis;
            this.onlineSince = new Date(data.logon_time);
            this.lastUpdated = new Date(data.last_updated);
        }
    }
}

interface RawVatsimFacility {
    id: number,
    short: string,
    long: string
}

export class VatsimFacility {
    id!: number;
    abbreviation!: string;
    name!: string;

    constructor(data?: RawVatsimFacility) {
        if (data) {
            this.id = data.id;
            this.abbreviation = data.short;
            this.name = data.long;
        }
    }
}

interface RawVatsimPilotRating {
    id: number,
    short_name: string,
    long_name: string
}

export class VatsimPilotRating {
    id!: number;
    shortName!: string;
    longName!: string;

    constructor(data?: RawVatsimPilotRating) {
        if (data) {
            this.id = data.id;
            this.shortName = data.short_name;
            this.longName = data.long_name;
        }
    }
}

interface RawVatsimControllerRating {
    id: number,
    short: string,
    long: string
}

export class VatsimControllerRating {
    id!: number;
    shortName!: string;
    longName!: string;

    constructor(data?: RawVatsimControllerRating) {
        if (data) {
            this.id = data.id;
            this.shortName = data.short;
            this.longName = data.long;
        }
    }
}

export interface RawVatsimData {
    general: RawVatsimOverview;
    pilots: Array<RawVatsimPilot>;
    prefiles: Array<RawVatsimPilot>;
    pilot_ratings: Array<RawVatsimPilotRating>;
    controllers: Array<RawVatsimController>;
    ratings: Array<RawVatsimControllerRating>;
    facilities: Array<RawVatsimFacility>;
}

export class VatsimData {
    overview!: VatsimOverview;
    pilots!: Array<VatsimPilot>;
    prefiles!: Array<VatsimPilot>;
    pilotRatings!: Array<VatsimPilotRating>;
    controllers!: Array<VatsimController>;
    controllerRatings!: Array<VatsimControllerRating>;
    facilities!: Array<VatsimFacility>;

    constructor(data?: RawVatsimData) {
        if (data) {
            this.overview = new VatsimOverview(data.general);
            this.pilots = data.pilots?.map(p => new VatsimPilot(p));
            this.prefiles = data.prefiles?.map(p => new VatsimPilot(p));
            this.pilotRatings = data.pilot_ratings?.map(r => new VatsimPilotRating(r));
            this.controllers = data.controllers?.map(c => new VatsimController(c));
            this.controllerRatings = data.ratings?.map(r => new VatsimControllerRating(r));
            this.facilities = data.facilities?.map(f => new VatsimFacility(f));
        }
    }
};