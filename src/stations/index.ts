import type { Station, StationContext } from './Station';
import { STATION_BY_ID } from '../content/stations';
import { RumahKampung } from './RumahKampung';
import { Padang } from './Padang';
import { AirTerjun } from './AirTerjun';
import { Wakaf } from './Wakaf';
import { Sawah } from './Sawah';
import { RumahPanjai } from './RumahPanjai';
import { JalanKenangan } from './JalanKenangan';
import { Tasik } from './Tasik';

/** All eight places around the lake, in walking order. */
export function createStations(ctx: StationContext): Station[] {
  return [
    new RumahKampung(ctx, STATION_BY_ID.rumah),
    new Padang(ctx, STATION_BY_ID.padang),
    new AirTerjun(ctx, STATION_BY_ID.airterjun),
    new Wakaf(ctx, STATION_BY_ID.wakaf),
    new Sawah(ctx, STATION_BY_ID.sawah),
    new RumahPanjai(ctx, STATION_BY_ID.panjai),
    new JalanKenangan(ctx, STATION_BY_ID.jalan),
    new Tasik(ctx, STATION_BY_ID.tasik),
  ];
}
