export type StationId =
  | 'rumah'
  | 'padang'
  | 'airterjun'
  | 'wakaf'
  | 'sawah'
  | 'panjai'
  | 'jalan'
  | 'tasik';

export type ZoneId = StationId;

export interface StationDef {
  id: StationId;
  order: number;
  /** Angle around the lake in degrees; position = (R sin a, y, R cos a). */
  angle: number;
  /** Radius from the lake centre. */
  radius: number;
  culture: string;
  names: { native: string; ms: string; en: string };
  hour: number;
  /** Shown on arrival. One line of atmosphere, one line of what to do. */
  intro: string;
  /** Shown faintly once the station's signature interaction is complete. */
  afterword: string;
  memories: Record<string, string>;
}

export const RING_RADIUS = 55;
export const LAKE_RADIUS = 40;

export const STATIONS: StationDef[] = [
  {
    id: 'rumah',
    order: 0,
    angle: 0,
    radius: RING_RADIUS,
    culture: 'Malay',
    names: { native: 'Rumah Kampung', ms: 'Pulang', en: 'Home, at dawn' },
    hour: 6.75,
    intro:
      'Dawn over the lake, and the tekukur is already awake. Wash your feet at the tempayan before you climb the stairs, then take a nasi lemak bungkus from the gerai. Breakfast first; the day can wait.',
    afterword: 'When you are ready, hold the round button (or W) and stroll on. The path knows the way.',
    memories: {
      tempayan: 'Wash your feet before you climb. The water is colder than the morning.',
      nasilemak: 'RM1. The paper is still warm. You save the egg for last.',
      congkak: 'Seven houses each side. Your grandmother always let you go first.',
      pelita: 'One flame for each stake. The last one is the house. You are home.',
      radio: 'The radio is on in the kitchen. Nobody is listening, and nobody turns it off.',
    },
  },
  {
    id: 'padang',
    order: 1,
    angle: 45,
    radius: RING_RADIUS,
    culture: 'Shared',
    names: { native: 'Padang', ms: 'Angin', en: 'The field, mid-morning' },
    hour: 9.5,
    intro:
      'A wide padang and a good wind. A wau bulan leans against the pondok. Pick it up, hold to let the string out, and listen for the hum of its bow.',
    afterword: 'Let the wau settle whenever you like. The forest is next, and you will hear the water before you see it.',
    memories: {
      wau: 'The bow hums when the wind is right. You learn to hear the sky.',
      van: 'Hari Sukan. The van is green. The cup sweats in your hand.',
      seremban: 'Five stones, one hand. You were better at this than anyone believed.',
    },
  },
  {
    id: 'airterjun',
    order: 2,
    angle: 90,
    radius: RING_RADIUS,
    culture: 'Shared',
    names: { native: 'Air Terjun', ms: 'Sejuk', en: 'The waterfall, noon' },
    hour: 12.5,
    intro:
      'Follow the sound of water. Someone has spread a tikar on the flattest rock and left a thermos behind. Sit for a while; there is nothing here that needs doing. If you must do something, the flat stones skip well.',
    afterword: 'Clouds are gathering over the hills. The wakaf up ahead has a good roof.',
    memories: {
      sit: 'The tikar is on the flattest rock. Someone\u2019s mother is saying don\u2019t go past the big stone.',
      stones: 'Three skips. The pool is colder than the air has any right to allow.',
    },
  },
  {
    id: 'wakaf',
    order: 3,
    angle: 135,
    radius: RING_RADIUS,
    culture: 'Shared',
    names: { native: 'Wakaf', ms: 'Hujan Petang', en: 'Shelter from the afternoon rain' },
    hour: 15.5,
    intro:
      'The rain arrives the way it always did, all at once. Sit under the zinc roof and listen. There is a sheet of exercise-book paper on the bench, if you feel like folding a boat for the longkang.',
    afterword: 'The rain is thinning into gold. The padi is just past the bend.',
    memories: {
      sit: 'Rain on zinc. Nobody says anything. Nobody needs to.',
      boat: 'Exercise-book paper, folded twice too many. It sails anyway.',
    },
  },
  {
    id: 'sawah',
    order: 4,
    angle: 180,
    radius: RING_RADIUS,
    culture: 'Kadazan-Dusun',
    names: { native: 'Kaamatan', ms: 'Sawah \u00b7 Tuai', en: 'Padi at golden hour' },
    hour: 17.5,
    intro:
      'Golden hour over the padi, and Kinabalu keeping its head in the clouds. Under the hut hangs a set of gongs. Tap any of them; every note belongs. Hold the sompoton for a breath underneath.',
    afterword: 'The gongs will ring a while after you leave. Follow the shore to the longhouse.',
    memories: {
      gongs: 'The gongs carry further than voices. Kinabalu keeps its head in the clouds.',
      sompoton: 'A gourd, seven bamboo pipes, and one long breath. The padi leans in to listen.',
      linopot: 'Rice in a tarap leaf, tied at dawn, opened at noon. It tastes like the walk.',
    },
  },
  {
    id: 'panjai',
    order: 5,
    angle: 225,
    radius: RING_RADIUS,
    culture: 'Iban',
    names: { native: 'Rumah Panjai', ms: 'Ruai', en: 'The longhouse verandah, sunset' },
    hour: 18.5,
    intro:
      'Climb onto the ruai. Pua kumbu hang from the beams and someone has left the loom set up. Drag the shuttle across to weave a row; the engkerumong at the far end is yours to play too.',
    afterword: 'Leave the cloth on the loom; someone will finish it. The town lights are coming on along the shore.',
    memories: {
      loom: 'Every pattern was dreamed before it was woven. You are only borrowing the thread.',
      engkerumong: 'Small gongs in a row, played fast at Gawai and slow tonight. The river keeps time.',
      lapis: 'Kek lapis, a hundred layers. Your aunt in Kuching says you must cut it thin.',
    },
  },
  {
    id: 'jalan',
    order: 6,
    angle: 270,
    radius: RING_RADIUS,
    culture: 'Indian \u00b7 Chinese',
    names: { native: 'Jalan Kenangan', ms: 'Senja', en: 'The shophouse street at dusk' },
    hour: 19.25,
    intro:
      'Two doorways face each other under the five-foot way. On one side, bowls of coloured rice and an unfinished kolam; on the other, a kopitiam with cellophane lanterns hanging from the awning. Draw, light the lamps, and take a lantern with you. It is getting dark.',
    afterword: 'The sampan is tied at the end of the street. Take your time.',
    memories: {
      kolam: 'Rice flour between finger and thumb. Draw it today; the sparrows will eat it tomorrow.',
      vilakku: 'Light one, then another. The doorway remembers who came.',
      lantern: 'Hold it low so the candle won\u2019t tip. It tips anyway.',
      egg: 'Two half-boiled eggs, a splash of soy, white pepper. The newspaper folded small.',
      putu: 'The putu bambu whistle at the far end of the street. You can smell the gula melaka from here.',
    },
  },
  {
    id: 'tasik',
    order: 7,
    angle: 315,
    radius: 28,
    culture: 'Shared',
    names: { native: 'Tasik', ms: 'Kelip-kelip', en: 'Across the lake, at night' },
    hour: 21,
    intro:
      'The sampan will find its own way across. Out on the water, hold anywhere to cup your hands and see if a firefly agrees to stay. The trees on the far bank breathe light together.',
    afterword: 'The jetty on the far side leads home. A row of pelita waits to be lit.',
    memories: {
      fireflies: 'The trees breathe light. You cup your hands and one of them agrees to stay.',
      water: 'You trail a hand in the water. It is warmer than the air, the way it always was at night.',
    },
  },
];

export const STATION_BY_ID = Object.fromEntries(STATIONS.map((s) => [s.id, s])) as Record<StationId, StationDef>;

export const ENDING_TEXT =
  'You walked the whole day. Sit on the anjung as long as you like; the garden will wait, and the tekukur will call again at dawn.';
