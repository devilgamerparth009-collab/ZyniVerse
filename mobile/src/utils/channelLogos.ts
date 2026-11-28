import type { ImageSourcePropType } from 'react-native';

/**
 * Official channel artwork is bundled with the APK.
 *
 * The website serves these same PNGs from `public/channel-logos`. Keeping a
 * local copy means TV Guide, streaming rows and dub schedules never have to
 * wait for a network request (or get blocked by a proxy) just to show a logo.
 */
const CHANNEL_LOGOS: Record<string, ImageSourcePropType> = {
  cn: require('../../assets/channel-logos/cn.png'),
  sony_yay: require('../../assets/channel-logos/sony_yay.png'),
  hungama: require('../../assets/channel-logos/hungama.png'),
  super_hungama: require('../../assets/channel-logos/super_hungama.png'),
  pogo: require('../../assets/channel-logos/pogo.png'),
  nick: require('../../assets/channel-logos/nick.png'),
  nick_jr: require('../../assets/channel-logos/nick_jr.png'),
  sonic: require('../../assets/channel-logos/sonic.png'),
  disney_channel: require('../../assets/channel-logos/disney_channel.png'),
  disney_junior: require('../../assets/channel-logos/disney_junior.png'),
  epic_kids: require('../../assets/channel-logos/epic_kids.png'),
  animax: require('../../assets/channel-logos/animax.png'),
  discovery_kids: require('../../assets/channel-logos/discovery_kids.png'),
  sony_liv: require('../../assets/channel-logos/sony_liv.png'),
  jio_hotstar: require('../../assets/channel-logos/jio_hotstar.png'),
  muse_asia: require('../../assets/channel-logos/muse_asia.png'),
  muse_india: require('../../assets/channel-logos/muse_india.png'),
  crunchyroll: require('../../assets/channel-logos/crunchyroll.png'),
  netflix_anime: require('../../assets/channel-logos/netflix_anime.png'),
  prime_video: require('../../assets/channel-logos/prime_video.png'),
};

const LOCAL_BRAND_LOGO = require('../../assets/logo.png') as ImageSourcePropType;

/** Bundled official logo for a channel id, or null when the id is unknown. */
export function localChannelLogo(id?: string | null): ImageSourcePropType | null {
  if (typeof id !== 'string') return null;
  return CHANNEL_LOGOS[id.trim().toLowerCase()] || null;
}

/** Bundled ZyniVerse mark for seeded official accounts/channels. */
export function localBrandLogo(uri?: string | null): ImageSourcePropType | null {
  if (typeof uri !== 'string') return null;
  const value = uri.trim().toLowerCase();
  if (
    value === '/logo.png' ||
    value.endsWith('zyverse.in/logo.png') ||
    value.endsWith('www.zyverse.in/logo.png')
  ) {
    return LOCAL_BRAND_LOGO;
  }
  return null;
}
