'use strict';

var libQ = require('kew');
var config= new (require('v-conf'))();
var fs = require('fs');
var path = require('path');

module.exports = AlbumPlaylists;

function AlbumPlaylists(context) {
  var self = this;


  // Save a reference to the parent commandRouter
  self.context=context;
  self.commandRouter = self.context.coreCommand;
  self.configManager = self.context.configManager;
  self.logger = self.context.logger;
  self.playlistManager = self.context.playlistManager;


  // self.logger.info("################################AlbumPlaylists");
  // console.log('AlbumPlaylists ' );
  self.controllerMpd = self.commandRouter.pluginManager.getPlugin('music_service', 'mpd');
}

AlbumPlaylists.prototype.onVolumioStart = function() {
  var self = this;
  self.addToBrowseSources();

  return libQ.resolve();
};

AlbumPlaylists.prototype.onStart = function() {
  var self = this;

  return libQ.resolve();
};

AlbumPlaylists.prototype.onStop = function() {
  var self = this;
};

AlbumPlaylists.prototype.onRestart = function() {
console.log("AlbumPlaylists.onRestart");
  var self = this;
};

AlbumPlaylists.prototype.onInstall = function()
{
  var self = this;
};

AlbumPlaylists.prototype.onUninstall = function()
{
  var self = this;
};

AlbumPlaylists.prototype.addToBrowseSources = function () {
  var data = {
    name: 'Album playlists',
    uri: 'album-view',
    plugin_type:'music_service',
    plugin_name:'album_playlists',
    albumart: '/albumart?sourceicon=music_service/album_playlists/icon_albums.jpg'};
  this.commandRouter.volumioAddToBrowseSources(data);
};

AlbumPlaylists.prototype.handleBrowseUri = function(curUri) {
  var self = this;
  var response;

  // self.logger.info("################################handleBrowseUri");
  // console.log('handleBrowseUri '+ curUri);

  if(curUri.startsWith('album-view')){
    if(curUri == 'album-view')
      response = self.listPlaylists();
    else
    {
      response = self.listPlaylist(curUri.replace('album-view/', '/'));
    }
  }

  return response;
}

function getPlaylistFiles(dir, done) {
  var results = [];
  // console.log("reading " + dir);
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          getPlaylistFiles(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
         if (file.endsWith('.m3u') && !path.basename(file).startsWith('.')) {
           results.push(file);
         }
         if (!--pending) done(null, results);
       }
     });
    });
  });
}

AlbumPlaylists.prototype.listPlaylists = function()
{
  var self = this;
  var defer = libQ.defer();

  var response = {
    navigation: {
      prev: {
        uri: "/"
      },
      lists: [{
        "title": "Albums",
        "icon": "fa fa-music",
        "availableListViews": ["grid", "list"],
        "items": []
      }]
    }
  };
  var list = response.navigation.lists[0].items;

  getPlaylistFiles('/mnt/local/Albums/', function (err, files) {
    if (err) {
      defer.fail(new Error('An error occurred while listing playlists'));
    }

    for(var i in files) {
      var folder = path.dirname(files[i]);
      var folderName = folder.substring(folder.lastIndexOf('/') + 1);
      var regexRes = /(.*?) - (.*)/.exec(folderName);
      if (regexRes) {
        var artist = regexRes[1];
        var album = regexRes[2];
      } else {
        var artist = "<unknown>";
        var album = folderName;
      }

      list.push({
        service: 'album_playlists',
        type: 'playlist',
        title: album,
        artist: artist,
        //albumart: '/albumart?sourceicon=music_service/album_playlists/icon_albums.jpg',
        albumart: self.controllerMpd.getAlbumArt({artist: artist, album: album}, folder, 'dot-circle-o'),
        uri: 'album-view' + files[i]
      });

      // console.log('album-view' + files[i]);


    }

    list = list.sort(function (a, b) {
      return a.artist < b.artist ? -1 : a.artist > b.artist;
    });


    defer.resolve(response);
  });

  return defer.promise;
}

AlbumPlaylists.prototype.listPlaylist = function(m3uFile)
{
  var self = this;

  var defer = libQ.defer();
  var count = 10;

  var folder = path.dirname(m3uFile);
  var folderName = folder.substring(folder.lastIndexOf('/') + 1);

  var response = {
    navigation: {
      prev: {
        uri: "album-view"
      },
      lists: [{
        "title": folderName,
        "icon": "fa fa-music",
        "availableListViews": ["list"],
        albumart: '/albumart?sourceicon=music_service/album_playlists/icon_albums.jpg',
        "items": []
      }]
    }
  };

   this.parseM3u(m3uFile).then(function (items) {
     response.navigation.lists[0].items = items;
     defer.resolve(response);
   });


  return defer.promise;
}

AlbumPlaylists.prototype.parseM3u = function(m3uFile)
{
  //self.logger.info("Parsing m3u: " + m3uFile);
  //console.log('parseM3u ' + m3uFile);

  var self = this;
  var defer = libQ.defer();
  var folder = path.dirname(m3uFile);
  var m3uRegex = /\#EXTINF:(\d*),(.*?) - (.*)/;
  var lineReader = require('readline').createInterface({
    input: require('fs').createReadStream(m3uFile)
  });

  var folderName = folder.substring(folder.lastIndexOf('/') + 1);
  var split = folderName.split(' - ');
  var m3uArtist = split[0] && split[0].trim();
  var m3uAlbum = split[1] && split[1].replace(/\[\d*\]/, '').trim();

  var items = [];
  var meta = undefined;
  var track = 0;
  lineReader.on('line', function (line) {
    if (line.startsWith('#EXTINF:')) {
      var regexRes = m3uRegex.exec(line);
      if (regexRes) {
        meta = {
          "title": regexRes[3],
          "artist": regexRes[2],
          "duration": regexRes[1],
        }
      }
    } else if (meta) {
      items.push({
        "uri": "music-library/" + path.join(folder, line).replace('/mnt/', ''),
        "service": "mpd",
        "name": meta.title,
        "title": meta.title,
        "artist": meta.artist,
        "album": m3uAlbum,
        "type": "song", // NIET track
        "tracknumber": track++,
        "albumart": self.controllerMpd.getAlbumArt({artist: m3uArtist, album: m3uAlbum}, folder, 'dot-circle-o'),
        // "albumart": '/albumart?sourceicon=music_service/album_playlists/icon_albums.jpg',
        "duration": track.duration,
        "trackType":"mp3"
      });
      meta = undefined;
    }
  });

  lineReader.on('close', function () {
    defer.resolve(items);
  });

  return defer.promise;
}

AlbumPlaylists.prototype.explodeUri = function(uri)
{
  var self = this;

  return this.parseM3u(uri.replace('album-view/', '/'));
}
