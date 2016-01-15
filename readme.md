# protractor-video-reporter

Captures video screen cast when running Protractor with a headless browser, e.g. under Xvfb.

# Install

    npm install --save-dev protractor-video-reporter

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


You have to start Xvfb before starting Protractor and define DISPLAY enviroment variable.

The reporter will capture the Xvdb display for every spec. If a spec fails or if it succeed and `saveSuccessVideos` is true we will keep the video and print a message to the console with the location. Otherwise, the video file is deleted.

The location of every video is `baseDirectory/{some UUID}`.

# Options

* `baseDirectory` (string, required) - The path to the directory where videos are stored. If not existing, it gets created.
* `saveSuccessVideos` (bool, false) - If true, will save the videos of the succussfull specs, as well as the failed specs.
* `singleVideo` (bool, false) - If true, will create a single video file for all the specs.
* `ffmpegCmd`: (string, "ffmpeg") - The command used to execute ffmpeg, e.g. /usr/bin/ffmpeg.
* `ffmpegArgs`: (array of strings and nunmbers, see code for defaults) - The argumetns passed to ffmpeg, not including the actual output file which will be appended.

