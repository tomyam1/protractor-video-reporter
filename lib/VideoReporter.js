"use strict";

var Joi = require('joi'),
  Path = require('path'),
  ChildProcess = require('child_process'),
  Fs = require('fs'),
  Mkdirp = require('mkdirp'),
  Uuid = require('node-uuid'),
  Debug = require('debug'),
  SubtitlesParser = require('subtitles-parser'),
  _ = require('lodash'),
  SanitizeFilename = require('sanitize-filename');


var debug = Debug('protractor-video-reporter');

function randomVideoName() {

  }

function VideoReporter(options) {

  var self = this;

  options = _.defaults({}, options, {
    saveSuccessVideos: false,
    singleVideo: true,
    singleVideoPath: 'uuid',
    createSubtitles: true,
    chmod: 'none',
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
    singleVideoPath: Joi.alternatives().try(
        Joi.valid('uuid', 'fullName'),
        Joi.func()
    ),
    createSubtitles: Joi.boolean()
        .description('If true and singleVideo is also true, will create a SRT subtitles file with the name details of the currently running spec.'),
    chmod: Joi.string()
        .description('Chmod to set after each saved video, e.g. "755"'),
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

  switch (removeVideo) {
    case 'yes':
      debug('Removing video');
      Fs.unlinkSync(self._videoPath);
      break;

    case 'try':
      debug('Trying to remove the video, maybe it was not created');
      if (Fs.existsSync(self._videoPath)) {
        Fs.unlinkSync(self._videoPath);
      }
      break;

    case 'no':
      debug('Keeping the video');
      console.log('Spec video is in: ' + self._videoPath);
      if (self.options.chmod !== 'none') {
        debug('Setting chmod settings for file');
        Fs.chmodSync(self._videoPath, self.options.chmod);
      }
      break;
  }

  // Cleanup before next spec
  self._videoPath = null;
  self._ffmpeg = null;
};

VideoReporter.prototype._singleVideoPath = function(result) {
  var self = this;
  if (self.options.singleVideoPath === 'uuid') {
    return Uuid.v4() + '.mov';
  } else if (self.options.singleVideoPath === 'fullName') {
    return SanitizeFilename(result.fullName + '.mov');
  } else {
    return self.options.singleVideoPath(result);
  }
}


VideoReporter.prototype.specStarted = function(result) {
  var self = this;
  if (!self.options.singleVideo) {
    var videoPath = Path.join(self.options.baseDirectory, self._singleVideoPath(result));
    self._startScreencast(videoPath);

  } else if (self.options.createSubtitles) {
    self._currentSubtitle = {
      id: self._subtitles.length + 1,
      startTime: new Date() - self._jasmineStartTime
    };
  }
};

VideoReporter.prototype.specDone = function(result) {
  var self = this;
  if (!self.options.singleVideo) {

    var removeVideo;

    if (result.status === 'failed' || (result.status === 'passed' && self.options.saveSuccessVideos)) {
      removeVideo = 'no';

    // If the spec was not run then the file probably was not created yet
    // so we just try to delete it
    } else if (result.status === 'pending' || result.status === 'disabled') {
      removeVideo = 'try';
    } else {
      removeVideo = 'yes';
    }

    self._stopScreencast(removeVideo);

  } else if (self.options.createSubtitles) {
    self._currentSubtitle.endTime = new Date() - self._jasmineStartTime;
    
    var text = '';
    switch (result.status) {
      case 'passed':
        text += '<font color="green">SUCCESS</font>';
        break;
      case 'failed':
        text += '<font color="red">FAILED</font>';
        break;
      case 'pending':
        text += '<font color="yellow">PENDING</font>';
        break;
    }
    text += ' ' + result.description;
    self._currentSubtitle.text = text;

    self._subtitles.push(self._currentSubtitle);
  }
};

VideoReporter.prototype.jasmineStarted = function() {
  var self = this;
  if (self.options.singleVideo) {
    var videoPath = Path.join(self.options.baseDirectory, 'protractor-specs.mov');
    self._startScreencast(videoPath);

    if (self.options.createSubtitles) {
      self._subtitles = [];
      self._jasmineStartTime = new Date();
    }
  }
};

VideoReporter.prototype.jasmineDone = function() {
  var self = this;
  if (self.options.singleVideo) {
    self._stopScreencast('no');

    if (self.options.createSubtitles) {
      Fs.writeFileSync(
          Path.join(self.options.baseDirectory, 'protractor-specs.srt'),
          SubtitlesParser.toSrt(self._subtitles),
          'utf8'
      );
    }
  }
};

module.exports = VideoReporter;