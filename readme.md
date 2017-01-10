# protractor-video-reporter

A Jasmine 2 reporter that captures a screencast of Protractor specs running on a headless browser, e.g. under Xvfb.
This is especially usefull for debugging you e2e specs on you CI server.
The reporter also creates a SRT subtitles file to for the video so you can see which spec you are currently viewing and whether it passed or failed.

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

* `baseDirectory` (string): The path to the directory where videos are stored. If not existing, it gets created. Required.

* `singleVideo` (bool): If `true`, will create a single video file for all the specs. Defaults to `true`.
The file will be saved to `baseDirectory/protractor-specs.mov`.
If `singleVideo` is false, the reporter will create a separate video file for every spec and place it under the `baseDirectory`.
The exact location is determined by `singleVideoPath`.

* `singleVideoPath`: (string, function):

When `uuid` (default): Each spec video file will be placed at `baseDirectory/{some random UUID}.mov`.
If you prefer this option, you would have to look at the "Spec video is in: ..." messages that are printed to the console.

When `fullName`: Each spec video will be placed at `baseDirectory/{spec full name} - {spec status}.mov`.
The full name of the spec will be sanitized to be a valid file name

If you want to determine the full name yourself you can pass a function.
The function recieves a single argument, the result object passed to `specStarted`.
For example, you can do:

    singleVideoPath: function (result) {
        // don't actually do this, you need to make sure fullName is a valid file name
        result.fullName + '.mov';
    }

* `createSubtitles` (bool): If `true` and singleVideo is also true, will create a SRT subtitles file with the name details of the currently running spec. Defaults to `true`.
The file will be saves to `baseDirectory/protractor-specs.srt`.

* `saveSuccessVideos` (bool): If `true`, will save the videos of the succussfull specs, as well as the failed specs. This has no effect if `singleVideo` is `true` - we'll always capture all the specs then. Defaults to `false`.

* `ffmpegCmd` (string):  The command used to execute ffmpeg, e.g. `'/usr/bin/ffmpeg'`. Defaults to `'ffmpeg'`.

* `ffmpegArgs` (array): The argumetns passed to ffmpeg, not including the actual output file which will be appended. Defaults to:

    ```
        [
          '-y',
          '-r', '30',
          '-f', 'x11grab',
          '-s', '1024x768',
          '-i', process.env.DISPLAY,
          '-g', '300',
          '-vcodec', 'qtrle',
        ]
    ```

# Debugging

If you encouter any issues with the reporter, e.g. video files are not created,
turn on debugging by settings the `DEBUG` environment to `protractor-video-reporter`.
