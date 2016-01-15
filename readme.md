# protractor-video-reporter

Captures video screen cast when running Protractor with a headless browser, e.g. under Xvfb.
This is especially usefull for debugging you e2e specs on you CI server.

# Install

    npm install --save-dev protractor-video-reporter

# Prerequisites

You have to start Xvfb before starting Protractor and set the `DISPLAY` enviroment variable.

If you're using Jenkins CI, you can use the [Xvfb plugin](https://wiki.jenkins-ci.org/display/JENKINS/Xvfb+Plugin) to easily achive that.

# Usage

In the protractor configuration file:

    var VideoReporter = require('protractor-video-reporter');

    ...

    onPrepare: function() {
      ...
      jasmine.getEnv().addReporter(new VideoReporter({
        baseDirectory: Path.join(__dirname, 'reports/videos/')
      }));
    }


# Options

*`baseDirectory` (string, required) - The path to the directory where videos are stored. If not existing, it gets created.
* `singleVideo` (bool, true) - If true, will create a single video file for all the specs.

The file will be saved to `baseDirectory/protractor-specs.mov`.

If `singleVideo` is false, the reporter will create a separate video file for every spec and place it at `baseDirectory/{some random UUID}.mov`.
If you prefer this option, you would have to look at the "Spec video is in: ..." messages that are printed to the console.

* `createSubtitles`, (bool, true) - If true and singleVideo is also true, will create a SRT subtitles file with the name details of the currently running spec.

The file will be saves to `baseDirectory/protractor-specs.srt`.

* `saveSuccessVideos` (bool, false) - If true, will save the videos of the succussfull specs, as well as the failed specs.

* `ffmpegCmd`: (string, "ffmpeg") - The command used to execute ffmpeg, e.g. /usr/bin/ffmpeg.
* `ffmpegArgs`: (array of strings and nunmbers, see code for defaults) - The argumetns passed to ffmpeg, not including the actual output file which will be appended.

