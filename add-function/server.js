const express = require("express");
const fileUpload = require("express-fileupload");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const fs = require("fs");
const os = require("os");

// Set FFmpeg path - using relative path from project root
const ffmpegPath = path.join(__dirname, "ffmpeg", "bin", "ffmpeg.exe");
const ffprobePath = path.join(__dirname, "ffmpeg", "bin", "ffprobe.exe");
const audioPath = path.join(__dirname, "hard-to-miss.mp3");
const hasAudio = fs.existsSync(audioPath);

// Ensure the paths exist before setting them
if (fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath)) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffprobePath);
} else {
  console.error(
    "FFmpeg executables not found. Please ensure they are in the correct location.",
  );
  console.error("Expected ffmpeg at:", ffmpegPath);
  console.error("Expected ffprobe at:", ffprobePath);
}

const app = express();
const port = process.env.PORT || 3002;

// Middleware
app.use(express.static("public"));
app.use(
  fileUpload({
    createParentPath: true,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max file size
  }),
);

// Create necessary directories if they don't exist
const uploadsDir = path.join(__dirname, "uploads");
const outputDir = path.join(__dirname, "output");
[uploadsDir, outputDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Function to safely delete a file with retries
function safeDeleteFile(filePath, maxRetries = 5, delay = 1000) {
  return new Promise((resolve) => {
    let attempts = 0;

    const attemptDelete = () => {
      attempts++;
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        resolve(true);
      } catch (error) {
        if (error.code === "EBUSY" && attempts < maxRetries) {
          // File is busy, wait and retry
          setTimeout(attemptDelete, delay);
        } else {
          // Either max retries reached or different error
          console.warn(`Could not delete file ${filePath}:`, error.message);
          resolve(false);
        }
      }
    };

    attemptDelete();
  });
}

// Function to convert a single file
function getRandomDuration(min = 8, max = 15) {
  return Math.random() * (max - min) + min;
}

function convertFile(file, duration) {
  return new Promise((resolve, reject) => {
    const fileExt = path.extname(file.name).toLowerCase();
    const isWebm = fileExt === ".webm";

    // Create temporary file path with unique name
    const tempPath = path.join(
      uploadsDir,
      `temp_${Date.now()}_${Math.random().toString(36).slice(2)}${fileExt}`,
    );

    // Create output filename
    let outputFilename;
    if (isWebm) {
      let baseName = path
        .basename(file.name, ".webm")
        .replace(/\.(png|jpg|jpeg|gif)\.webm$/i, ".webm")
        .replace(/\.(png|jpg|jpeg|gif)$/i, "");
      outputFilename = baseName + ".mp4";
    } else {
      outputFilename = `video_${path.basename(
        file.name,
        path.extname(file.name),
      )}.mp4`;
    }

    // Ensure filename is safe and unique
    outputFilename = outputFilename.replace(/[^a-zA-Z0-9-_.]/g, "_");
    if (fs.existsSync(path.join(outputDir, outputFilename))) {
      const timestamp = Date.now();
      outputFilename = `${path.basename(
        outputFilename,
        ".mp4",
      )}_${timestamp}.mp4`;
    }

    const outputPath = path.join(outputDir, outputFilename);

    // Save temporary file
    file
      .mv(tempPath)
      .then(() => {
        const ffmpegCommand = ffmpeg();
        const effectiveDuration = duration || getRandomDuration();

        if (isWebm) {
          ffmpegCommand.input(tempPath);
        } else {
          ffmpegCommand.input(tempPath).loop(effectiveDuration);
        }

        if (hasAudio && !isWebm) {
          ffmpegCommand.input(audioPath);
        }

        const outputOptions = [
          "-c:v libx264",
          "-pix_fmt yuv420p",
          "-preset medium",
          "-movflags +faststart",
          "-framerate 24",
        ];

        if (hasAudio && !isWebm) {
          outputOptions.push("-c:a aac", "-shortest");
        }

        if (!isWebm) {
          outputOptions.push(`-t ${effectiveDuration}`);
        }

        ffmpegCommand
          .outputOptions(outputOptions)
          .videoBitrate("2000k")
          .save(outputPath);

        ffmpegCommand
          .on("end", async () => {
            // Wait a bit before cleaning up to ensure ffmpeg has fully released the file
            setTimeout(async () => {
              // Cleanup temp file with retry mechanism
              await safeDeleteFile(tempPath);

              // Verify output file
              if (
                fs.existsSync(outputPath) &&
                fs.statSync(outputPath).size > 0
              ) {
                resolve({
                  success: true,
                  videoPath: `/output/${outputFilename}`,
                  originalName: file.name,
                });
              } else {
                reject(new Error("Generated video file is invalid"));
              }
            }, 1000);
          })
          .on("error", async (err) => {
            console.error("FFmpeg error:", err);

            // Wait a bit before cleaning up
            setTimeout(async () => {
              // Cleanup files with retry mechanism
              await Promise.all([
                safeDeleteFile(tempPath),
                safeDeleteFile(outputPath),
              ]);

              reject(err);
            }, 1000);
          });
      })
      .catch(reject);
  });
}

app.post("/convert", async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: "No files were uploaded." });
    }

    const files = Array.isArray(req.files.files)
      ? req.files.files
      : [req.files.files];
    let duration = parseFloat(req.body.duration);
    const randomDuration = req.body.randomDuration === "true";
    if (randomDuration || Number.isNaN(duration)) {
      duration = null;
    }

    // Validate file types
    const hasWebm = files.some(
      (file) => path.extname(file.name).toLowerCase() === ".webm",
    );
    const hasImages = files.some((file) =>
      /\.(jpg|jpeg|png|gif)$/i.test(file.name),
    );

    if (hasWebm && hasImages) {
      return res.status(400).json({
        error: "Cannot mix video and image files in the same conversion.",
      });
    }

    // Convert all files in parallel
    const conversionPromises = files.map((file) => convertFile(file, duration));

    const results = await Promise.all(
      conversionPromises.map((p) =>
        p.catch((err) => ({
          success: false,
          error: err.message,
        })),
      ),
    );

    // Check if all conversions failed
    if (results.every((result) => !result.success)) {
      return res.status(500).json({
        error: "All conversions failed",
        details: results.map((r) => r.error),
      });
    }

    // Return results
    res.json({
      success: true,
      results: results,
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/convert-download", async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: "No files were uploaded." });
    }

    const files = Array.isArray(req.files.files)
      ? req.files.files
      : [req.files.files];
    if (files.length !== 1) {
      return res
        .status(400)
        .json({
          error: "Please upload exactly one file for download conversion.",
        });
    }

    let duration = parseFloat(req.body.duration);
    const randomDuration = req.body.randomDuration === "true";
    if (randomDuration || Number.isNaN(duration)) {
      duration = null;
    }

    const file = files[0];
    const fileExt = path.extname(file.name).toLowerCase();
    const isWebm = fileExt === ".webm";
    const outputFilename = isWebm
      ? `${path.basename(file.name, ".webm")}.mp4`
      : `video_${path.basename(file.name, path.extname(file.name))}.mp4`;
    const safeFilename = outputFilename.replace(/[^a-zA-Z0-9-_.]/g, "_");
    const tempOutputPath = path.join(
      os.tmpdir(),
      `download_${Date.now()}_${Math.random().toString(36).slice(2)}.mp4`,
    );

    const tempPath = path.join(
      uploadsDir,
      `temp_${Date.now()}_${Math.random().toString(36).slice(2)}${fileExt}`,
    );

    await file.mv(tempPath);

    const ffmpegCommand = ffmpeg();
    const effectiveDuration = duration || getRandomDuration();

    if (isWebm) {
      ffmpegCommand.input(tempPath);
    } else {
      ffmpegCommand.input(tempPath).loop(effectiveDuration);
    }

    if (hasAudio && !isWebm) {
      ffmpegCommand.input(audioPath);
    }

    const outputOptions = [
      "-c:v libx264",
      "-pix_fmt yuv420p",
      "-preset medium",
      "-movflags +faststart",
      "-framerate 24",
    ];

    if (hasAudio && !isWebm) {
      outputOptions.push("-c:a aac", "-shortest");
    }

    if (!isWebm) {
      outputOptions.push(`-t ${effectiveDuration}`);
    }

    ffmpegCommand
      .outputOptions(outputOptions)
      .videoBitrate("2000k")
      .save(tempOutputPath)
      .on("end", async () => {
        try {
          const stats = fs.statSync(tempOutputPath);
          if (stats.size > 0) {
            res.setHeader("Content-Type", "video/mp4");
            res.setHeader(
              "Content-Disposition",
              `attachment; filename="${safeFilename}"`,
            );
            const stream = fs.createReadStream(tempOutputPath);
            stream.pipe(res);
            stream.on("close", async () => {
              await Promise.all([
                safeDeleteFile(tempPath),
                safeDeleteFile(tempOutputPath),
              ]);
            });
          } else {
            await Promise.all([
              safeDeleteFile(tempPath),
              safeDeleteFile(tempOutputPath),
            ]);
            res.status(500).json({ error: "Generated video file is invalid" });
          }
        } catch (err) {
          await Promise.all([
            safeDeleteFile(tempPath),
            safeDeleteFile(tempOutputPath),
          ]);
          res.status(500).json({ error: "Video generation failed" });
        }
      })
      .on("error", async (err) => {
        console.error("FFmpeg error:", err);
        await Promise.all([
          safeDeleteFile(tempPath),
          safeDeleteFile(tempOutputPath),
        ]);
        res.status(500).json({ error: "Conversion failed" });
      });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/output/:filename", (req, res) => {
  const filePath = path.join(outputDir, req.params.filename);
  res.sendFile(filePath);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
