import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Linking,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type AdPlacement =
  | 'home-bottom'
  | 'forum-feed'
  | 'schedule-header'
  | 'search-card'
  | 'sidebar'
  | 'detail-inline'
  | 'tournaments-top'
  | 'tv-guide'
  | 'dub-schedule';

interface AdBannerProps {
  placement?: AdPlacement;
  size?: 'banner' | 'medium' | 'native';
  style?: object;
  /** Delay initial load so the first scroll/interaction stays smooth. */
  lazy?: boolean;
}

/**
 * Adsterra units rendered through the native Android WebView.
 *
 * - 300x250 Medium: 72dd20ad744b4f992e4e2121cfa47172
 * - 728x90 Leaderboard: e80028b0207a45ef76bfc3d9d4a0fe9e (scaled to mobile)
 * - Native Banner: 188115be46209eff2403f0d29b32d940
 *
 * A failed/throttled ad collapses to zero height instead of leaving a blank
 * rectangle, and a single retry is attempted with a cache-busted script URL.
 */
const UNITS = {
  medium: '72dd20ad744b4f992e4e2121cfa47172',
  banner: 'e80028b0207a45ef76bfc3d9d4a0fe9e',
  native: '188115be46209eff2403f0d29b32d940',
} as const;

const LOADER_HOST = 'formssternlystately.com';
const LOAD_TIMEOUT_MS = 12000;
const MAX_ATTEMPTS = 2;

const AD_HOSTS = [
  LOADER_HOST,
  'bauval.org',
  'adsterra.com',
  'adsterra.network',
  'zyverse.in',
];

function readyScript(size: 'banner' | 'medium' | 'native'): string {
  // Native ads inject markup into a container instead of an iframe. Checking
  // the empty container alone made every native ad report "ready" even when
  // the script was blocked, so require actual child content.
  const nativeCheck =
    size === 'native'
      ? `var host = document.getElementById('container-${UNITS.native}');
         if (host && host.innerHTML.trim().length > 0) ready();`
      : '';
  return `
    (function () {
      var sent = false;
      function ready() {
        if (sent || !window.ReactNativeWebView) return;
        sent = true;
        window.ReactNativeWebView.postMessage('ad-ready');
      }
      var ticks = 0;
      var timer = setInterval(function () {
        ticks += 1;
        if (document.querySelector('iframe')) ready();
        ${nativeCheck}
        if (sent || ticks > 100) clearInterval(timer);
      }, 100);
    })();
    true;
  `;
}

function adHtml(size: 'banner' | 'medium' | 'native', attempt: number): string {
  const cacheBust = attempt > 0 ? `?cb=${Date.now()}` : '';
  const loader = (key: string) => `https://${LOADER_HOST}/${key}/invoke.js${cacheBust}`;

  if (size === 'banner') {
    const scale = Math.min(1, (SCREEN_WIDTH - 24) / 728);
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:transparent; width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .scaler { width:728px; height:90px; transform:scale(${scale}); transform-origin:center center; }
  iframe { border:none !important; }
</style></head><body>
  <div class="scaler">
    <script type="text/javascript">
      atOptions = { 'key':'${UNITS.banner}', 'format':'iframe', 'height':90, 'width':728, 'params':{} };
    </script>
    <script type="text/javascript" src="${loader(UNITS.banner)}"></script>
  </div>
  <script>${readyScript(size)}</script>
</body></html>`;
  }

  if (size === 'native') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:transparent; width:100%; height:100%; overflow:hidden; font-family:Roboto, sans-serif; }
</style></head><body>
  <script async="async" data-cfasync="false" src="${loader(UNITS.native)}"></script>
  <div id="container-${UNITS.native}"></div>
  <script>${readyScript(size)}</script>
</body></html>`;
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:transparent; width:100%; height:100%; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  iframe { border:none !important; }
</style></head><body>
  <script type="text/javascript">
    atOptions = { 'key':'${UNITS.medium}', 'format':'iframe', 'height':250, 'width':300, 'params':{} };
  </script>
  <script type="text/javascript" src="${loader(UNITS.medium)}"></script>
  <script>${readyScript(size)}</script>
</body></html>`;
}

export default function AdBanner({
  placement = 'home-bottom',
  size = 'medium',
  style,
  lazy = true,
}: AdBannerProps) {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<'waiting' | 'loading' | 'loaded' | 'failed'>(
    lazy ? 'waiting' : 'loading'
  );
  const mounted = useRef(true);

  const contentWidth = SCREEN_WIDTH - 24;
  const scale = Math.min(1, contentWidth / 728);
  const frameHeight = size === 'banner' ? Math.round(90 * scale) + 10 : size === 'native' ? 320 : 260;
  const html = useMemo(() => adHtml(size, attempt), [size, attempt]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Let the host screen finish its first interaction before loading a WebView.
  useEffect(() => {
    if (!lazy || status !== 'waiting') return;
    const timer = setTimeout(() => setStatus('loading'), 450);
    return () => clearTimeout(timer);
  }, [lazy, status]);

  // If the ad script is blocked or the network stalls, retry once then hide.
  useEffect(() => {
    if (status !== 'loading') return;
    const timer = setTimeout(() => {
      if (!mounted.current) return;
      if (attempt < MAX_ATTEMPTS - 1) {
        setAttempt((a) => a + 1);
        setStatus('loading');
      } else {
        setStatus('failed');
      }
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [status, attempt]);

  if (status === 'failed') return null;

  return (
    <View
      style={[
        styles.wrapper,
        {
          // Keep the measured box while loading so the WebView can actually
          // render; a confirmed failure returns null below and collapses it.
          height: frameHeight,
          marginVertical: 8,
          width: '100%',
        },
        style,
      ]}
      accessibilityLabel={`Advertisement ${placement}`}
    >
      {status === 'loading' || status === 'loaded' ? (
        <WebView
          key={`${placement}-${attempt}`}
          source={{ html, baseUrl: `https://${LOADER_HOST}` }}
          style={[styles.webView, { width: contentWidth, height: frameHeight }]}
          javaScriptEnabled
          domStorageEnabled
          scalesPageToFit={false}
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          allowsInlineMediaPlayback
          androidLayerType="hardware"
          thirdPartyCookiesEnabled
          onMessage={(event) => {
            if (event.nativeEvent.data === 'ad-ready' && mounted.current) setStatus('loaded');
          }}
          onError={() => {
            if (!mounted.current) return;
            if (attempt < MAX_ATTEMPTS - 1) {
              setAttempt((a) => a + 1);
              setStatus('loading');
            } else {
              setStatus('failed');
            }
          }}
          renderError={() => <View />}
          onShouldStartLoadWithRequest={(request) => {
            const url = request.url || '';
            if (url === 'about:blank' || url.startsWith('data:') || url.startsWith('https://')) {
              // Ad networks load creatives from many rotating domains. Blocking
              // every host outside a short list killed the ad iframe itself.
              // Only top-level navigation should leave the WebView; subframes
              // and script/image requests must always be allowed through.
              if (request.isTopFrame === false) return true;
              if (AD_HOSTS.some((host) => url.includes(host))) return true;
              // An ad tap must leave the app, never navigate the WebView away.
              Linking.openURL(url).catch(() => {});
              return false;
            }
            return true;
          }}
        />
      ) : null}
      {status === 'loading' ? (
        <View style={[styles.placeholder, { height: frameHeight }]} pointerEvents="none">
          <ActivityIndicator size="small" color="#7c6cff" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  webView: {
    backgroundColor: 'transparent',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
