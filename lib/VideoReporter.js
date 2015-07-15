"use strict";

var Joi = require('joi'),
  Path = require('path'),
  ChildProcess = require('child_process'),
  Fs = require('fs'),
  Mkdirp = require('mkdirp'),
  Uuid = require('node-uuid'),
  _ = require('lodash');


function defaultVideoPath(result) {
  return Uuid.v4() + '.mov';
}

function VideoReporter(options) {

  var self = this;

  options = _.defaults({}, options, {
    saveSuccessVideos: false,
    ffmpegCmd: 'ffmpeg',
    ffmpegArgs: [
      '-y',
      '-r', '30',
      '-f', 'x11grab',
      '-s', '1024x768',
      '-i', process.env.DISPLAY,
      '-g', '300',
      '-vcodec', 'qtrle',
    ],
    debug: false
  });

  // validate options
  var result = Joi.validate(options, Joi.object().keys({
    baseDirectory: Joi.string().description('The path to the directory where videos are stored. If not existing, it gets created.'),
    saveSuccessVideos: Joi.boolean().description('If true, will save the videos of the succussfull specs, as well as the failed specs.'),

    ffmpegCmd: Joi.string().description('The command used to execute ffmpeg, e.g. /usr/bin/ffmpeg.'),
    ffmpegArgs: Joi.array().items(Joi.string(), Joi.number()).description('The argumetns passed to ffmpeg, not including the actual output file which will be appended.'),

    debug: Joi.boolean().description('If true, will print debug information to the console')

  }));

  if (result.error) {
    throw result.error;
  }

  self.options = result.value;
}

VideoReporter.prototype.debug = function() {
  var self = this;
  if (self.options.debug) {
    console.log.apply(console, arguments);
  }
};

// Start ffmpeg before each spec
VideoReporter.prototype.specStarted = function(result) {

  var self = this;

  var videoPath = Path.join(self.options.baseDirectory, defaultVideoPath(result));

  // Make sure that directory exists
  Mkdirp.sync(Path.dirname(videoPath));

  self.debug('Saving video to ' + videoPath);

  var ffmpegCmd = self.options.ffmpegCmd;

  var ffmpegArgs = _.clone(self.options.ffmpegArgs);
  ffmpegArgs.push(videoPath);

  self._ffmpeg = ChildProcess.spawn(ffmpegCmd, ffmpegArgs);

  self.debug('Spawning: ' + ffmpegCmd + ' ' + ffmpegArgs.join(' '));

  self._ffmpeg.stdout.on('data', function (data) {
    self.debug('ffmpeg (out): ' + data);
  });

  self._ffmpeg.stderr.on('data', function (data) {
    self.debug('ffmpeg (err): ' + data);
  });

  self._ffmpeg.on('close', function (code) {
    self.debug('ffmpeg exited with code ' + code);
  });

  self._videoPath = videoPath;

};


VideoReporter.prototype.specDone = function(result) {

  var self = this;

  // Stop ffmpeg
  self._ffmpeg.kill();

  // Check if we need to keep the video
  if (result.status === 'failed' || (
    result.status === 'passed' && self.options.saveSuccessVideos
    )) {

      // Print the location of the video
      console.log('Spec video is in: ' + self._videoPath);

  // Remove it otherwise
  } else {
    self.debug('Video removed');
    Fs.unlinkSync(self._videoPath);
  }

  // Cleanup before next spec
  self._videoPath = null;
  self._ffmpeg = null;

};

module.exports = VideoReporter;