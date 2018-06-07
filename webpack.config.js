module.exports = (env, argv) => {
    const path = require('path');
    const BannerPlugin = require('banner-webpack-plugin');

    const isDev = argv.mode === 'development';
    const isProd = !isDev;

    const config = {
        entry: {
            'index': './src/index.ts',
            'cli': './src/cli.ts'
        },
        target: 'node',
        node: {
            __dirname: false,
            __filename: false
        },
        module: {
            rules: [{
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }]
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js']
        },
        output: {
            filename: '[name].js',
            path: path.resolve(__dirname, 'dist'),
            devtoolModuleFilenameTemplate: '[absolute-resource-path]'
        },
        plugins: []
    };

    if (isProd) {
        config.plugins.push(new BannerPlugin({
            chunks: {
                cli: {
                    beforeContent: '#!/usr/bin/env node\n'
                }
            }
        }))
    }

    return config;
}