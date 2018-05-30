const path = require('path');
const BannerPlugin = require('banner-webpack-plugin');

module.exports = {
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
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    devtool: 'cheap-source-map',
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        devtoolModuleFilenameTemplate: '[absolute-resource-path]'
    },
    plugins: [
        new BannerPlugin({chunks: {
            cli: {
                beforeContent: '#!/usr/bin/env node\n'
            }
        }})
    ]
};