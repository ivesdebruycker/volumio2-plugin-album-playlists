'use strict';

/**
* https://github.com/volumio/Volumio2-UI/blob/master/src/app/components/side-menu/elements/modal-alarm-clock.html
* https://github.com/volumio/volumio-plugins/blob/master/plugins/music_service/spotify/index.js
* https://github.com/balbuze/volumio-plugins/tree/master/plugins/miscellanea/unmutedigiamp
*/

var libQ = require('kew');
var fs=require('fs-extra');
var schedule = require('node-schedule');
var moment = require('moment');
var config= new (require('v-conf'))();
var fs = require('fs');
var path = require('path');

// Define the AlarmClock class
module.exports = AlbumPlaylists;

function AlbumPlaylists(context) {
  var self = this;

  // Save a reference to the parent commandRouter
  self.context=context;
  self.commandRouter = self.context.coreCommand;
  self.configManager = self.context.configManager;
  self.logger = self.context.logger;
  self.playlistManager = self.context.playlistManager;
}

AlbumPlaylists.prototype.onVolumioStart = function() {
  var self = this;
  //Perform startup tasks here
  self.addToBrowseSources();
};

AlbumPlaylists.prototype.onStart = function() {
  var self = this;
  //Perform startup tasks here
};

AlbumPlaylists.prototype.onStop = function() {
  var self = this;
  //Perform startup tasks here
};

AlbumPlaylists.prototype.onRestart = function() {
  var self = this;
  //Perform startup tasks here
};

AlbumPlaylists.prototype.onInstall = function()
{
  var self = this;
  //Perform your installation tasks here
};

AlbumPlaylists.prototype.onUninstall = function()
{
  var self = this;
  //Perform your installation tasks here
};

AlbumPlaylists.prototype.addToBrowseSources = function () {
  var data = {name: 'Albums', uri: 'album-view', plugin_type:'miscellanea', plugin_name:'album-playlists'};
  this.commandRouter.volumioAddToBrowseSources(data);
};

AlbumPlaylists.prototype.handleBrowseUri = function(curUri) {
  var self = this;
  var response;

  if(curUri.startsWith('album-view')){
    if(curUri == 'album-view')
      response = self.listPlaylists();
    else
    {
      response = self.listPlaylist(curUri);
    }
  }

  return response;
}

function getPlaylistFiles(dir, done) {
  var results = [];
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

  var response={
    navigation: {
      prev: {
        uri: ''
      },
      list: []
    }
  };

  getPlaylistFiles('/mnt/NAS/Albums/', function (err, files) {
    if (err) {
      defer.fail(new Error('An error occurred while listing playlists'));
    }

    for(var i in files) {
      var folder = path.dirname(files[i]);
      folder = folder.substring(folder.lastIndexOf('/') + 1);
      var split = folder.split(' - ');

      response.navigation.list.push({
        service: 'mpd',
        type: 'playlist',
        title: path.basename(files[i], '.m3u'),
        artist: split[0] && split[0].trim(),
        album: split[1] && split[1].trim(),
        icon: 'fa fa-list-ol',
        uri: files[i].replace('/mnt/', '/')
      });
    }

    defer.resolve(response);
  });

  return defer.promise;
}

AlbumPlaylists.prototype.listPlaylist = function(crUri)
{
}