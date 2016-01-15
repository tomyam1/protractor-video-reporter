"use strict";

var Joi = require('joi'),
  Path = require('path'),
  ChildProcess = require('child_process'),
  Fs = require('fs'),
  Mkdirp = require('mkdirp'),
  Uuid = require('node-uuid'),
  Debug = require('debug'),
  _ = require('lodash');


var debug = Debug('protractor-video-reporter');

function randomVideoName() {
  return Uuid.v4() + '.mov';
}

function VideoReporter(options) {

  var self = this;

  options = _.defaults({}, options, {
    saveSuccessVideos: false,
    singleVideo: false,
    ffmpegCmd: 'ffmpeg',
    ffmpegArgs: [
      '-y',
      '-r', '30',
      '-f', 'x11grab',
      '-s', '1024x768',
      '-i', process.env.DISPLAY,
      '-g', '300',
      '-vcodec', 'qtrle',
    ]
  });

  // validate options
  var result = Joi.validate(options, Joi.object().keys({
    baseDirectory: Joi.string()
        .description('The path to the directory where videos are stored. If not existing, it gets created.'),
    saveSuccessVideos: Joi.boolean()
        .description('If true, will save the videos of the succussfull specs, as well as the failed specs.'),

    singleVideo: Joi.boolean()
        .description('If true, will create a single video file for all the specs.'),

    ffmpegCmd: Joi.string()
        .description('The command used to execute ffmpeg, e.g. /usr/bin/ffmpeg.'),
    ffmpegArgs: Joi.array().items(Joi.string(), Joi.number())
        .description('The argumetns passed to ffmpeg, not including the actual output file which will be appended.')
  }));

  if (result.error) {
    throw result.error;
  }

  self.options = result.value;
}

VideoReporter.prototype._startScreencast = function(videoPath) {

  var self = this;

  self._videoPath = videoPath;
  debug('Saving video to ' + self._videoPath);

  // Make sure that directory exists
  Mkdirp.sync(Path.dirname(self._videoPath));

  var ffmpegArgs = _.clone(self.options.ffmpegArgs);
  ffmpegArgs.push(self._videoPath);

  debug('Spawning: ' + self.options.ffmpegCmd + ' ' + ffmpegArgs.join(' '));
  self._ffmpeg = ChildProcess.spawn(self.options.ffmpegCmd, ffmpegArgs);

  self._ffmpeg.stdout.on('data', function (data) {
    debug('ffmpeg (out): ' + data);
  });

  self._ffmpeg.stderr.on('data', function (data) {
    debug('ffmpeg (err): ' + data);
  });

  self._ffmpeg.on('close', function (code) {
    debug('ffmpeg exited with code ' + code);
  });

};


VideoReporter.prototype._stopScreencast = function(removeVideo) {
  var self = this;

  // Stop ffmpeg
  self._ffmpeg.kill();

  if (removeVideo) {
    debug('Removing video');
    Fs.unlinkSync(self._videoPath);
  } else {
    debug('Keeping the video');

    // Print the location of the video
    console.log('Spec video is in: ' + self._videoPath);
  }

  // Cleanup before next spec
  self._videoPath = null;
  self._ffmpeg = null;
};


VideoReporter.prototype.specStarted = function() {
  var self = this;
  if (!self.options.singleVideo) {
    var videoPath = Path.join(self.options.baseDirectory, randomVideoName());
    self._startScreencast(videoPath);
  }
};

VideoReporter.prototype.specDone = function(result) {
  var self = this;
  if (!self.options.singleVideo) {
    var keepVideo = result.status === 'failed' ||
        (result.status === 'passed' && self.options.saveSuccessVideos);
    self._stopScreencast(!keepVideo);
  }
};

VideoReporter.prototype.jasmineStarted = function() {
  var self = this;
  if (self.options.singleVideo) {
    var videoPath = Path.join(self.options.baseDirectory, 'protractor-specs.mov');
    self._startScreencast(videoPath);
  }
};

VideoReporter.prototype.jasmineDone = function() {
  var self = this;
  if (self.options.singleVideo) {
    self._stopScreencast();
  }
};

module.exports = VideoReporter;