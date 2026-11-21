import React, { useState } from 'react';
import { View, StyleSheet, Dimensions, Linking } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AdBannerProps {
  placement?: 'home-bottom' | 'forum-feed' | 'schedule-header' | 'search-card' | 'sidebar' | 'detail-inline';
  size?: 'banner' | 'medium' | 'native';
  style?: object;
}

/**
 * Real Adsterra Ad Unit with live script execution via native Android WebView.
 * Runs official Adsterra codes:
 * - 300x250 Medium: 72dd20ad744b4f992e4e2121cfa47172
 * - 728x90 Leaderboard: e80028b0207a45ef76bfc3d9d4a0fe9e (scaled to mobile)
 * - Native Banner: 188115be46209eff2403f0d29b32d940
 */

export default function AdBanner({
  placement = 'home-bottom',
  size = 'medium',
  style,
}: AdBannerProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const contentWidth = SCREEN_WIDTH - 24;

  // 728x90 Leaderboard requires exact dimensions in atOptions, so we scale it to fit mobile width
  const bannerScale = Math.min(1, contentWidth / 728);
  const bannerFrameHeight = Math.round(90 * bannerScale) + 8;

  let htmlContent = '';
  let frameHeight = 260;

  if (size === 'banner') {
    frameHeight = bannerFrameHeight;
    htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background-color: transparent;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    .scaler {
      width: 728px;
      height: 90px;
      transform: scale(${bannerScale});
      transform-origin: center center;
    }
    iframe { border: none !important; }
  </style>
</head>
<body>
  <div class="scaler">
    <script type="text/javascript">
      atOptions = {
        'key' : 'e80028b0207a45ef76bfc3d9d4a0fe9e',
        'format' : 'iframe',
        'height' : 90,
        'width' : 728,
        'params' : {}
      };
    </script>
    <script type="text/javascript" src="https://formssternlystately.com/e80028b0207a45ef76bfc3d9d4a0fe9e/invoke.js"></script>
  </div>
</body>
</html>
`;
  } else if (size === 'native') {
    frameHeight = 320;
    htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background-color: transparent;
      width: 100%;
      height: 100%;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>
</head>
<body>
  <script async="async" data-cfasync="false" src="https://formssternlystately.com/188115be46209eff2403f0d29b32d940/invoke.js"></script>
  <div id="container-188115be46209eff2403f0d29b32d940"></div>
</body>
</html>
`;
  } else {
    // 300x250 Medium rectangle (default - most reliable & highest eCPM on mobile)
    frameHeight = 260;
    htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      background-color: transparent;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    iframe { border: none !important; }
  </style>
</head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key' : '72dd20ad744b4f992e4e2121cfa47172',
      'format' : 'iframe',
      'height' : 250,
      'width' : 300,
      'params' : {}
    };
  </script>
  <script type="text/javascript" src="https://formssternlystately.com/72dd20ad744b4f992e4e2121cfa47172/invoke.js"></script>
</body>
</html>
`;
  }

  if (loadFailed) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrapper,
        {
          height: frameHeight,
          width: '100%',
        },
        style,
      ]}
    >
      <WebView
        source={{
          html: htmlContent,
          baseUrl: 'https://zyverse.in',
        }}
        style={[styles.webView, { width: contentWidth }]}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        scalesPageToFit={false}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        androidLayerType="hardware"
        thirdPartyCookiesEnabled={true}
        onShouldStartLoadWithRequest={(request) => {
          const url = request.url || '';
          // Allow internal ad loaders and scripts
          if (
            url === 'about:blank' ||
            url.startsWith('data:') ||
            url.includes('formssternlystately.com') ||
            url.includes('zyverse.in') ||
            url.includes('adsterra')
          ) {
            return true;
          }
          // If the user taps an ad link / redirect, open it in the phone's browser
          if (url.startsWith('http://') || url.startsWith('https://')) {
            Linking.openURL(url).catch(() => {});
            return false;
          }
          return true;
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  webView: {
    backgroundColor: 'transparent',
  },
});
