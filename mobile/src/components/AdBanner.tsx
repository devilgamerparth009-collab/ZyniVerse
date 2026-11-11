import React, { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface AdBannerProps {
  placement?: 'home-bottom' | 'forum-feed' | 'schedule-header' | 'search-card' | 'sidebar';
  size?: 'banner' | 'medium';
  style?: object;
}

/**
 * Real Adsterra Ad Unit with live script execution via native Android WebView.
 * Runs official Adsterra codes from src/lib/ads.ts:
 * - 300x250 Key: 72dd20ad744b4f992e4e2121cfa47172
 * - 728x90 Key:  e80028b0207a45ef76bfc3d9d4a0fe9e
 */

const ADSTERRA_KEYS = {
  banner: {
    key: 'e80028b0207a45ef76bfc3d9d4a0fe9e',
    width: 320,
    height: 50,
    frameHeight: 60,
  },
  medium: {
    key: '72dd20ad744b4f992e4e2121cfa47172',
    width: 300,
    height: 250,
    frameHeight: 260,
  },
};

export default function AdBanner({
  placement = 'home-bottom',
  size = 'banner',
  style,
}: AdBannerProps) {
  const [hasError, setHasError] = useState(false);
  const adConfig = size === 'medium' ? ADSTERRA_KEYS.medium : ADSTERRA_KEYS.banner;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background-color: transparent;
      width: 100%;
      height: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    iframe {
      border: none !important;
      max-width: 100%;
    }
  </style>
</head>
<body>
  <script type="text/javascript">
    atOptions = {
      'key' : '${adConfig.key}',
      'format' : 'iframe',
      'height' : ${adConfig.height},
      'width' : ${adConfig.width},
      'params' : {}
    };
  </script>
  <script type="text/javascript" src="https://formssternlystately.com/${adConfig.key}/invoke.js"></script>
</body>
</html>
`;

  if (hasError) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrapper,
        {
          height: adConfig.frameHeight,
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
        style={styles.webView}
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
        onError={() => setHasError(true)}
      />
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
    width: SCREEN_WIDTH - 24,
    backgroundColor: 'transparent',
  },
});
