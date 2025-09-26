// YipYap Webpack Performance Optimization Configuration
// Optimized webpack config to achieve <150KB gzip bundle size target

const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { SubresourceIntegrityPlugin } = require('webpack-subresource-integrity');

const isProduction = process.env.NODE_ENV === 'production';
const shouldAnalyze = process.env.ANALYZE === 'true';

module.exports = {
  mode: isProduction ? 'production' : 'development',

  entry: {
    // Main application bundle - target: <150KB gzip
    main: './src/index.js',

    // Separate vendor bundle for better caching
    vendor: ['react', 'react-dom'],

    // Service worker entry
    sw: './src/sw.js'
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: isProduction ? '[name].[contenthash:8].js' : '[name].js',
    chunkFilename: isProduction ? 'chunks/[name].[contenthash:8].js' : 'chunks/[name].js',
    publicPath: '/',
    clean: true,
    crossOriginLoading: 'anonymous', // Enable SRI
  },

  resolve: {
    modules: [path.resolve(__dirname, 'src'), 'node_modules'],
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],

    // Optimize module resolution
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@services': path.resolve(__dirname, 'src/services'),

      // Use production builds
      'react': 'react/index.js',
      'react-dom': 'react-dom/index.js',
    },

    // Fallbacks for lighter alternatives
    fallback: {
      'lodash': path.resolve(__dirname, 'src/utils/lightweight-utils.js'),
      'moment': 'dayjs',
    }
  },

  module: {
    rules: [
      // JavaScript/TypeScript
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: {
                    browsers: ['> 1%', 'last 2 versions', 'not dead']
                  },
                  modules: false,
                  useBuiltIns: 'usage',
                  corejs: 3,
                }],
                '@babel/preset-react',
                '@babel/preset-typescript'
              ],
              plugins: [
                // Enable tree shaking for React
                ['babel-plugin-import', {
                  libraryName: '@ant-design/icons',
                  libraryDirectory: 'es/icons',
                  camel2DashComponentName: false
                }, 'ant-design-icons'],

                // Remove console.log in production
                ...(isProduction ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),

                // Optimize React components
                'babel-plugin-transform-react-remove-prop-types',
                '@babel/plugin-proposal-optional-chaining',
                '@babel/plugin-proposal-nullish-coalescing-operator'
              ],
              cacheDirectory: true,
              cacheCompression: false,
            }
          }
        ]
      },

      // CSS/SCSS
      {
        test: /\.(css|scss|sass)$/,
        use: [
          isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
          {
            loader: 'css-loader',
            options: {
              modules: {
                auto: true,
                localIdentName: isProduction ? '[hash:base64:5]' : '[local]--[hash:base64:5]'
              },
              sourceMap: !isProduction
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  'autoprefixer',
                  ...(isProduction ? ['cssnano'] : [])
                ]
              }
            }
          },
          'sass-loader'
        ]
      },

      // Images
      {
        test: /\.(png|jpg|jpeg|gif|svg|webp)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024, // 8KB - inline small images
          }
        },
        generator: {
          filename: 'images/[name].[hash:8][ext]'
        }
      },

      // Fonts
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'fonts/[name].[hash:8][ext]'
        }
      }
    ]
  },

  optimization: {
    minimize: isProduction,
    minimizer: [
      // JavaScript minification
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.info'],
            passes: 2
          },
          mangle: {
            safari10: true
          },
          output: {
            comments: false,
            ascii_only: true
          }
        },
        extractComments: false,
        parallel: true
      }),

      // CSS minification
      new CssMinimimizerPlugin({
        minimizerOptions: {
          preset: [
            'default',
            {
              discardComments: { removeAll: true },
              normalizeWhitespace: true,
              colormin: true,
              convertValues: true,
              discardDuplicates: true,
              discardEmpty: true,
              mergeRules: true,
              minifySelectors: true
            }
          ]
        }
      })
    ],

    // Advanced chunk splitting for optimal caching
    splitChunks: {
      chunks: 'all',
      minSize: 20000,
      maxSize: 70000, // Keep chunks under 70KB
      cacheGroups: {
        // Vendor libraries bundle - target: <80KB
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendor',
          chunks: 'all',
          priority: 10,
          maxSize: 80000
        },

        // React-specific bundle
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'react',
          chunks: 'all',
          priority: 20,
          maxSize: 50000
        },

        // Common application code
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 5,
          maxSize: 30000,
          reuseExistingChunk: true
        },

        // CSS bundle
        styles: {
          name: 'styles',
          test: /\.(css|scss|sass)$/,
          chunks: 'all',
          priority: 15,
          maxSize: 25000
        }
      }
    },

    // Runtime chunk for webpack manifest
    runtimeChunk: {
      name: 'runtime'
    },

    // Enable module concatenation (scope hoisting)
    concatenateModules: true,

    // Provide better chunk names in development
    chunkIds: isProduction ? 'deterministic' : 'named',
    moduleIds: isProduction ? 'deterministic' : 'named'
  },

  plugins: [
    // Define environment variables
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      'process.env.API_BASE_URL': JSON.stringify(process.env.API_BASE_URL || '/api'),
      __DEV__: !isProduction
    }),

    // Extract CSS
    ...(isProduction ? [
      new MiniCssExtractPlugin({
        filename: '[name].[contenthash:8].css',
        chunkFilename: 'chunks/[name].[contenthash:8].css'
      })
    ] : []),

    // Compression
    ...(isProduction ? [
      new CompressionPlugin({
        filename: '[path][base].gz',
        algorithm: 'gzip',
        test: /\.(js|css|html|svg)$/,
        threshold: 8192,
        minRatio: 0.8,
        deleteOriginalAssets: false
      }),

      // Brotli compression for better performance
      new CompressionPlugin({
        filename: '[path][base].br',
        algorithm: 'brotliCompress',
        test: /\.(js|css|html|svg)$/,
        compressionOptions: {
          params: {
            [require('zlib').constants.BROTLI_PARAM_QUALITY]: 11,
          },
        },
        threshold: 8192,
        minRatio: 0.8,
        deleteOriginalAssets: false
      })
    ] : []),

    // Subresource Integrity
    ...(isProduction ? [
      new SubresourceIntegrityPlugin({
        hashFuncNames: ['sha256', 'sha384'],
        enabled: true
      })
    ] : []),

    // Bundle analyzer
    ...(shouldAnalyze ? [
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: false,
        reportFilename: 'bundle-report.html',
        generateStatsFile: true,
        statsFilename: 'bundle-stats.json'
      })
    ] : []),

    // Progress plugin for development
    ...(!isProduction ? [
      new webpack.ProgressPlugin({
        activeModules: false,
        entries: true,
        modules: true,
        modulesCount: 5000,
        profile: false,
        dependencies: true,
        dependenciesCount: 10000,
        percentBy: null
      })
    ] : [])
  ],

  // Development server configuration
  devServer: {
    contentBase: path.resolve(__dirname, 'dist'),
    historyApiFallback: true,
    compress: true,
    hot: true,
    port: 3000,
    open: false,
    overlay: {
      errors: true,
      warnings: false
    },
    stats: 'errors-warnings'
  },

  // Performance hints and budgets
  performance: {
    hints: isProduction ? 'error' : 'warning',
    maxAssetSize: 150000, // 150KB - our target bundle size
    maxEntrypointSize: 200000, // 200KB including CSS
    assetFilter: (assetFilename) => {
      // Only apply size limits to JS and CSS files
      return /\.(js|css)$/.test(assetFilename);
    }
  },

  // Source maps
  devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',

  // Target modern browsers for better optimization
  target: ['web', 'es2017'],

  // Stats configuration
  stats: {
    chunks: false,
    chunkModules: false,
    chunkOrigins: false,
    colors: true,
    modules: false,
    reasons: false,
    source: false,
    timings: true,
    version: false,
    warnings: true,

    // Show performance info
    performance: true,

    // Bundle size information
    assets: true,
    assetsSort: 'size',

    // Error details
    errorDetails: true
  },

  // Resolve loader modules
  resolveLoader: {
    modules: ['node_modules']
  },

  // Cache configuration for faster builds
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename]
    }
  },

  // Experiments for future webpack features
  experiments: {
    topLevelAwait: true,
    outputModule: false
  }
};

// Custom plugin for monitoring bundle size
class BundleSizeMonitorPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap('BundleSizeMonitorPlugin', (compilation) => {
      const assets = compilation.getAssets();
      const jsAssets = assets.filter(asset => asset.name.endsWith('.js'));

      let totalSize = 0;
      let gzipSize = 0;

      jsAssets.forEach(asset => {
        const size = asset.source.size();
        totalSize += size;

        // Estimate gzip size (roughly 30% of original)
        gzipSize += Math.round(size * 0.3);
      });

      console.log('\n📦 Bundle Size Analysis:');
      console.log(`Total JS: ${Math.round(totalSize / 1024)}KB`);
      console.log(`Estimated Gzip: ${Math.round(gzipSize / 1024)}KB`);
      console.log(`Target: 150KB gzip`);

      if (gzipSize > 150 * 1024) {
        console.warn(`⚠️  Bundle size exceeds target! Current: ${Math.round(gzipSize / 1024)}KB, Target: 150KB`);
      } else {
        console.log(`✅ Bundle size within target!`);
      }
    });
  }
}

// Add bundle size monitor in production
if (isProduction) {
  module.exports.plugins.push(new BundleSizeMonitorPlugin());
}

module.exports.externals = {
  // Optionally externalize large libraries if served from CDN
  // 'react': 'React',
  // 'react-dom': 'ReactDOM'
};