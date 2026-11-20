import { TvChannelEntry } from '../types';

export const TV_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

export function getTodayDayName(): string {
  return TV_DAYS[new Date().getDay()];
}

export const FALLBACK_TV_CHANNELS: TvChannelEntry[] = [
  {
    channel: {
      id: 'sony_yay',
      name: 'SONY YAY!',
      shortName: 'SONY YAY',
      color: '#FF4081',
      region: 'India',
      website: 'https://zyverse.in/hindi-dub/schedule',
      dthNumbers: 'Tata Play 663 · Airtel 665 · Dish TV 975 · Sun Direct 538',
      type: 'tv',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/SONY_YAY_2022_Logo.png/250px-SONY_YAY_2022_Logo.png',
    },
    schedule: {
      day: getTodayDayName(),
      slots: [
        { show: 'Naruto: Shippuden (Morning Hindi Dub)', start: '09:00', end: '10:30', duration: 90, description: 'Sasuke and Itachi battle arc in official Hindi' },
        { show: 'Beyblade Burst QuadDrive', start: '10:30', end: '12:00', duration: 90, description: 'Bel Daizora battles in the Phantom' },
        { show: 'Oggy and the Cockroaches', start: '12:00', end: '13:30', duration: 90, description: 'Classic animated chases and slapstick comedy' },
        { show: 'Shin-chan Adventures', start: '13:30', end: '15:00', duration: 90, description: 'Nohara family daily fun episodes' },
        { show: 'Captain Tsubasa (Hindi Dub)', start: '15:00', end: '16:30', duration: 90, description: 'Nankatsu championship tournament match' },
        { show: 'Beyblade Burst Surge', start: '16:30', end: '18:00', duration: 90, description: 'Legendary Bladers Tournament' },
        { show: 'Naruto: Classic Series (Hindi)', start: '18:00', end: '19:30', duration: 90, description: 'Chunin Exam finals with Naruto vs Neji' },
        { show: 'Oggy and the Cockroaches (Evening Prime)', start: '19:30', end: '21:00', duration: 90, description: 'Hilarious prime-time episodes' },
        { show: 'Naruto: Shippuden (Night Prime Airing)', start: '21:00', end: '22:30', duration: 90, description: 'Fourth Great Ninja War climax episodes in Hindi Dub' },
        { show: 'Naruto: Shippuden (Late Night Uncut)', start: '22:30', end: '24:00', duration: 90, description: 'Uncut ninja action episodes in Hindi Dub' },
      ],
    },
  },
  {
    channel: {
      id: 'cn',
      name: 'Cartoon Network',
      shortName: 'CN',
      color: '#4CAF50',
      region: 'India',
      website: 'https://zyverse.in/hindi-dub/schedule',
      dthNumbers: 'Tata Play 667 · Airtel 666 · Dish TV 961 · Sun Direct 528',
      type: 'tv',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Cartoon_Network_2010_logo.svg/250px-Cartoon_Network_2010_logo.svg.png',
    },
    schedule: {
      day: getTodayDayName(),
      slots: [
        { show: 'Ben 10 (Hindi Dub)', start: '09:00', end: '10:30', duration: 90, description: 'Classic alien transformations with Hindi dub' },
        { show: 'Dragon Ball Z Kai (Hindi Dub)', start: '10:30', end: '12:00', duration: 90, description: 'Saiyan and Frieza Saga in Hindi' },
        { show: 'Teen Titans Go!', start: '12:00', end: '13:30', duration: 90, description: 'Superhero comedy adventures in Jump City' },
        { show: 'Digimon Adventure (Hindi Dub)', start: '13:30', end: '15:00', duration: 90, description: 'DigiDestined battle in the Digital World' },
        { show: 'Ben 10: Omniverse', start: '15:00', end: '16:30', duration: 90, description: 'Rook and Ben protect Undertown' },
        { show: 'Dragon Ball Z Kai (Hindi Dub)', start: '16:30', end: '18:00', duration: 90, description: 'Cell Games Tournament in Hindi' },
        { show: 'Teen Titans Go! Prime', start: '18:00', end: '19:30', duration: 90, description: 'Robin and the team hilarious schemes' },
        { show: 'Digimon Adventure', start: '19:30', end: '21:00', duration: 90, description: 'Dark Masters battle arc' },
        { show: 'Dragon Ball Z Kai (Night Prime)', start: '21:00', end: '22:30', duration: 90, description: 'Majin Buu saga uncut Hindi dub' },
        { show: 'Ben 10: Classic Action', start: '22:30', end: '24:00', duration: 90, description: 'Vilgax invasion battle arc' },
      ],
    },
  },
  {
    channel: {
      id: 'hungama',
      name: 'Hungama',
      shortName: 'HUNGAMA',
      color: '#FF6F00',
      region: 'India',
      website: 'https://zyverse.in/hindi-dub/schedule',
      dthNumbers: 'Tata Play 655 · Airtel 453 · Dish TV 957',
      type: 'tv',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Hungama_TV.svg/250px-Hungama_TV.svg.png',
    },
    schedule: {
      day: getTodayDayName(),
      slots: [
        { show: 'Pokemon: Master Journeys (Hindi Dub)', start: '09:00', end: '10:30', duration: 90, description: 'Ash & Goh journey across all regions in Hindi' },
        { show: 'Shin-chan Funfest', start: '10:30', end: '12:00', duration: 90, description: 'Nohara family nonstop comedy episodes' },
        { show: 'Kiteretsu (Hindi Dub)', start: '12:00', end: '13:30', duration: 90, description: 'Kitetsu genius inventions and Korosuke' },
        { show: 'Doraemon Classic', start: '13:30', end: '15:00', duration: 90, description: '22nd century gadgets with Nobita and Doraemon' },
        { show: 'Pokemon: Diamond and Pearl (Hindi)', start: '15:00', end: '16:30', duration: 90, description: 'Sinnoh League tournament battles' },
        { show: 'Shin-chan Marathon', start: '16:30', end: '18:00', duration: 90, description: 'Kasukabe defense group daily missions' },
        { show: 'Kiteretsu Prime', start: '18:00', end: '19:30', duration: 90, description: 'Time travel and gadget adventures' },
        { show: 'Doraemon Prime Time', start: '19:30', end: '21:00', duration: 90, description: 'Special gadget episodes with Hindi audio' },
        { show: 'Pokemon: Master Journeys (Night Prime)', start: '21:00', end: '22:30', duration: 90, description: 'World Coronation Series championship battles' },
        { show: 'Shin-chan Late Night', start: '22:30', end: '24:00', duration: 90, description: 'Classic episodes in official Hindi' },
      ],
    },
  },
  {
    channel: {
      id: 'crunchyroll',
      name: 'Crunchyroll India',
      shortName: 'CRUNCHYROLL',
      color: '#FF6400',
      region: 'India',
      website: 'https://zyverse.in/hindi-dub/schedule',
      dthNumbers: 'Available on Crunchyroll App & Web',
      type: 'youtube',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Crunchyroll_logo_2024.png/250px-Crunchyroll_logo_2024.png',
    },
    schedule: {
      day: getTodayDayName(),
      slots: [
        { show: 'Dragon Ball Super (Hindi Dub)', start: '12:00', end: '14:00', duration: 120, description: 'Tournament of Power saga in Hindi' },
        { show: 'Jujutsu Kaisen Season 2 (Hindi Dub)', start: '14:00', end: '16:00', duration: 120, description: 'Shibuya Incident arc episodes' },
        { show: 'Attack on Titan Final Season', start: '16:00', end: '18:00', duration: 120, description: 'The Rumbling in Hindi, Tamil & Telugu' },
        { show: 'Frieren: Beyond Journey\'s End (Hindi)', start: '18:00', end: '20:00', duration: 120, description: 'First Class Mage Exam in Hindi' },
        { show: 'Solo Leveling Season 2 (Hindi Dub)', start: '20:00', end: '21:30', duration: 90, description: 'Sung Jinwoo shadow monarch power in Hindi' },
        { show: 'One Piece (Egghead Arc Hindi)', start: '21:30', end: '23:00', duration: 90, description: 'Future Island Egghead arc drops in Hindi' },
        { show: 'Chainsaw Man (Hindi / Tamil / Telugu)', start: '23:00', end: '24:00', duration: 60, description: 'Full season available in Indian regional dubs' },
      ],
    },
  },
  {
    channel: {
      id: 'pogo',
      name: 'Pogo',
      shortName: 'POGO',
      color: '#0288D1',
      region: 'India',
      website: 'https://zyverse.in/hindi-dub/schedule',
      dthNumbers: 'Tata Play 660 · Airtel 664 · Dish TV 959',
      type: 'tv',
      logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/POGO-logo.svg/250px-POGO-logo.svg.png',
    },
    schedule: {
      day: getTodayDayName(),
      slots: [
        { show: 'Chhota Bheem (Hindi)', start: '09:00', end: '11:00', duration: 120, description: 'Dholakpur fun adventures' },
        { show: 'Mr. Bean: The Animated Series', start: '11:00', end: '13:00', duration: 120, description: 'Classic comedy in animation' },
        { show: 'Titoo (Hindi)', start: '13:00', end: '15:00', duration: 120, description: 'Titoo daily school adventures' },
        { show: 'Chhota Bheem: Kung Fu Dhamaka', start: '15:00', end: '17:30', duration: 150, description: 'Action movie broadcast' },
        { show: 'Grizzy and the Lemmings', start: '17:30', end: '19:30', duration: 120, description: 'Forest chases and comedy' },
        { show: 'Chhota Bheem (Prime)', start: '19:30', end: '21:30', duration: 120, description: 'Prime evening episodes' },
        { show: 'Mr. Bean: Animated Fun', start: '21:30', end: '24:00', duration: 150, description: 'Late night cartoon comedy' },
      ],
    },
  },
];
