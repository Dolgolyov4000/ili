'use strict';

importScripts('../../lib/require.min.js');

require({
    'paths': {
        'utils': '../utility/utils'
    }
}, [
    'utils'
], function(Utils) {
    onmessage = function(e) {
        var fileNames = e.data.fileNames;
        var prefix = e.data.prefix ? e.data.prefix : '';
        var downloader = new Downloader(prefix);

        try {
            for (var i = 0; i < fileNames.length; i++) {
                downloader.add(fileNames[i]);
            }
            downloader.start();
        } catch (e) {
            postMessage({
                status: 'failed',
                message: e.toString(),
            });
        }
    };

    function Downloader(prefix) {
        this.items = [];
        this.prefix = prefix;
        this.completed = 0;
        this.failed = false;
    }

    Downloader.prototype = {
        add: function(fileName) {
            var item = new Downloader.Item(this.prefix + fileName);
            item.request.onprogress = this.onProgress.bind(this, item);
            item.request.onerror = this.onError.bind(this, item);
            item.request.onload = this.onLoad.bind(this, item);
            this.items.push(item);
        },

        start: function () {
            postMessage({
                status: 'working',
                message: 'Waiting for external data...'
            });
            for (var i = 0; i < this.items.length; i++) {
                this.items[i].request.send();
            }
        },

        onProgress: function(item, event) {
            item.total = event.total;
            item.loaded = event.loaded;

            let total = this._sum(function(item) {
                return item.total;
            });
            let loaded = this._sum(function(item) {
                return item.loaded;
            });

            const totalString = Utils.formatFileSize(total);
            const loadedString = Utils.formatFileSize(loaded);

            var progress = loaded > 0 ? loadedString + (total > 0 ? ' of ' + totalString : '') : '';
 
            postMessage({
                status: 'working',
                message: 'Downloading' + (progress ? ' ' + progress : '...'),
            });
        },

        onError: function(item, event) {
            if (this.failed) return;
            this.failed = true;

            console.info('Error loading ' + item.fileName + ': ' + item.request.statusText, event);
            this.items.forEach(function(item) {
                item.request.abort();
            });

            postMessage({
                status: 'failed',
                message: 'Can not download ' + item.fileName + '. See log for details.',
            });
        },

        onLoad: function(item, event) {
            if (item.request.status >= 300) {
                this.onError(item, event);
                return;
            }
            this.completed++;
            if (this.completed != this.items.length) return;

            postMessage({
                status: 'completed',
                items: this.items.map(function(item) {
                    return new Utils.File([item.request.response], item.fileName);
                }),
            });
        },

        _sum: function(f) {
            var r = 0;
            for (var i = 0; i < this.items.length; i++) {
                r += f(this.items[i]);
            }
            return r;
        },
    };

    Downloader.Item = function(fileName) {
        this.fileName = fileName;
        this.request = new XMLHttpRequest();
        this.request.open('GET', fileName, true);
        this.request.responseType = 'blob';
        this.total = NaN;
        this.loaded = 0;
    };
    postMessage({
        status: 'ready'
    });
});
