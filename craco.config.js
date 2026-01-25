const webpack = require("webpack");
// `path` not required after removing shim alias

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.resolve = webpackConfig.resolve || {};
      webpackConfig.resolve.fallback = {
        ...(webpackConfig.resolve.fallback || {}),
        assert: require.resolve("assert/"),
        http: require.resolve("stream-http"),
        https: require.resolve("https-browserify"),
        stream: require.resolve("stream-browserify"),
        zlib: require.resolve("browserify-zlib"),
        url: require.resolve("url/"),
      };
      webpackConfig.resolve.alias = {
        ...(webpackConfig.resolve.alias || {}),
        "assert/": require.resolve("assert/"),
      };

      webpackConfig.plugins = [
        ...(webpackConfig.plugins || []),
        new webpack.ProvidePlugin({
          Buffer: ["buffer", "Buffer"],
        }),
      ];

      return webpackConfig;
    },
  },
};

