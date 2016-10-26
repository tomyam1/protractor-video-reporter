"use strict";

var Joi = require('joi'),
  Path = require('path'),
  ChildProcess = require('child_process'),
  Fs = require('fs'),
  Mkdirp = require('mkdirp'),
  Debug = require('debug'),
  SubtitlesParser = require('subtitles-parser'),
  _ = require('lodash');


var debug = Debug('protractor-video-reporter');

function specVideoName(result) {
  return result.fullName.replace(/\s+/g, '-').toLowerCase() + '.mov';
}

function fileExists(filePath)
{
  try
  {
    return Fs.statSync(filePath).isFile();
  }
  catch (err)
  {
    return false;
  }
}

function VideoReporter(options) {

  var self = this;

  options = _.defaults({}, options, {
    saveSuccessVideos: false,
    singleVideo: true,
    createSubtitles: true,
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
    createSubtitles: Joi.boolean()
        .description('If true and singleVideo is also true, will create a SRT subtitles file with the name details of the currently running spec.'),

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
    var isFile = fileExists(self._videoPath); //checking for pending spec when video is not recorded
    if (isFile) {
      Fs.unlinkSync(self._videoPath);
    }
  } else {
    debug('Keeping the video');

    // Print the location of the video
    console.log('Spec video is in: ' + self._videoPath);
  }

  // Cleanup before next spec
  self._videoPath = null;
  self._ffmpeg = null;
};


VideoReporter.prototype.specStarted = function(result) {
  var self = this;
  if (!self.options.singleVideo) {
    var videoPath = Path.join(self.options.baseDirectory, specVideoName(result));
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
    var keepVideo = result.status === 'failed' ||
        (result.status === 'passed' && self.options.saveSuccessVideos);
    self._stopScreencast(!keepVideo);

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
    self._stopScreencast();

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
